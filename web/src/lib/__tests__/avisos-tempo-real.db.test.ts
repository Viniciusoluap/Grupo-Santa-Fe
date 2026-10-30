// Pedido de 25/10: avisos em tempo real (webhooks Asaas e Pluggy). Mesmos cenários de
// Prospecta/server/avisos-tempo-real.test.ts, mais o webhook do Asaas (novo no Santa Fé).
// Banco real (TEST_DATABASE_URL); Asaas e Pluggy simulados: nada externo é chamado.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { garantirWebhookPluggy } from "@/lib/bancos/pluggy";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ user: { id: "usuario-teste", role: "admin" } as { id: string; role: string } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const MARCA = "TESTE-AVISOS-25-10";
const resp = (corpo: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => corpo } as Response);

describe("registro do webhook na Pluggy", () => {
  it("cria uma vez com o cabeçalho secreto e não duplica", async () => {
    const criar = vi.fn((u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ event: "all", url: "https://site/api/pluggy/webhook", headers: { "x-webhook-token": "s" } });
        return resp({ id: "w1" });
      }
      expect(u).toBe("https://api.pluggy.ai/webhooks");
      return resp({ results: [] });
    });
    expect(await garantirWebhookPluggy("tok", "https://site/api/pluggy/webhook", "s", criar as never)).toBe("criado");
    const existe = vi.fn(() => resp({ results: [{ url: "https://site/api/pluggy/webhook" }] }));
    expect(await garantirWebhookPluggy("tok", "https://site/api/pluggy/webhook", "s", existe as never)).toBe("existente");
    expect(existe).toHaveBeenCalledTimes(1);
  });
});

describe.skipIf(!url)("webhooks Pluggy e Asaas (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let bancos: typeof import("@/lib/bancos");
  let acoes: typeof import("@/lib/actions/banco");
  let integracoes: typeof import("@/lib/actions/integracoes");
  let pluggyWebhook: typeof import("@/app/api/pluggy/webhook/route").POST;
  let asaasWebhook: typeof import("@/app/api/asaas/webhook/route").POST;
  let pluggyAntes: Awaited<ReturnType<typeof prisma.configuracaoPluggy.findFirst>> = null;
  let tokenAsaasAntes: { valor: string; grupo: string } | null = null;
  const envAsaas = process.env.ASAAS_WEBHOOK_TOKEN;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    bancos = await import("@/lib/bancos");
    acoes = await import("@/lib/actions/banco");
    integracoes = await import("@/lib/actions/integracoes");
    ({ POST: pluggyWebhook } = await import("@/app/api/pluggy/webhook/route"));
    ({ POST: asaasWebhook } = await import("@/app/api/asaas/webhook/route"));
    pluggyAntes = await prisma.configuracaoPluggy.findFirst();
    tokenAsaasAntes = await prisma.configuracao.findUnique({ where: { chave: "asaas.webhookToken" }, select: { valor: true, grupo: true } });
    delete process.env.ASAAS_WEBHOOK_TOKEN;
  });
  const limpar = async () => {
    await prisma.contaBancaria.deleteMany({ where: { banco: { startsWith: MARCA } } });
    await prisma.notificacao.deleteMany({ where: { titulo: { contains: MARCA } } });
    await prisma.configuracao.deleteMany({ where: { chave: "asaas.webhookToken" } });
    await prisma.configuracaoPluggy.deleteMany();
  };
  beforeEach(limpar);
  afterEach(() => { vi.unstubAllGlobals(); });
  afterAll(async () => {
    await limpar();
    if (pluggyAntes) await prisma.configuracaoPluggy.create({ data: pluggyAntes });
    if (tokenAsaasAntes) await prisma.configuracao.create({ data: { chave: "asaas.webhookToken", ...tokenAsaasAntes } });
    if (envAsaas !== undefined) process.env.ASAAS_WEBHOOK_TOKEN = envAsaas;
    await prisma.$disconnect();
  });

  const post = (rota: string, headers: Record<string, string>, corpo: unknown) =>
    new Request(`https://www.gruposantafee.com.br${rota}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(corpo) });

  async function prepararPluggy() {
    await prisma.configuracaoPluggy.create({ data: { id: 1, clientIdEncrypted: "plain:cid", clientSecretEncrypted: "plain:csec" } });
    return prisma.contaBancaria.create({ data: { banco: `${MARCA} C6`, conta: "1", provedor: "pluggy", pluggyItemId: "item-1", pluggyAccountId: "acc-1" } });
  }
  function fetchPluggy(contaId: string) {
    return vi.fn((u: string) => {
      if (String(u).endsWith("/auth")) return resp({ apiKey: "tok" });
      if (String(u).includes("/transactions?")) return resp({ totalPages: 1, results: [{ id: `${contaId}-t1`, date: "2026-10-20T00:00:00Z", description: "Pix", amount: 70, type: "CREDIT" }] });
      return resp({ balance: 70 });
    });
  }

  it("Pluggy: recusa sem o cabeçalho secreto", async () => {
    const conta = await prepararPluggy();
    const f = fetchPluggy(conta.id);
    vi.stubGlobal("fetch", f);
    const r = await pluggyWebhook(post("/api/pluggy/webhook", { "x-webhook-token": "errado" }, { event: "item/updated", itemId: "item-1" }));
    expect(r.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("Pluggy: evento de dados novos sincroniza as contas daquela conexão e avisa os admins", async () => {
    const conta = await prepararPluggy();
    vi.stubGlobal("fetch", fetchPluggy(conta.id));
    const r = await pluggyWebhook(post("/api/pluggy/webhook", { "x-webhook-token": bancos.segredoWebhookPluggy() }, { event: "transactions/created", itemId: "item-1" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, contas: 1 });
    expect(await prisma.transacaoBancaria.count({ where: { contaId: conta.id } })).toBe(1);
    const avisos = await prisma.notificacao.findMany({ where: { titulo: { contains: MARCA } } });
    const admins = await prisma.usuario.count({ where: { papel: "admin", ativo: true } });
    expect(avisos).toHaveLength(admins);
    expect(avisos[0]).toMatchObject({ tipo: "sistema", link: "/admin/bpo?aba=bancos", titulo: `1 movimentação(ões) nova(s) — ${MARCA} C6` });

    // Outro aviso em menos de 30 s não sincroniza de novo (trava).
    const f2 = fetchPluggy(conta.id);
    vi.stubGlobal("fetch", f2);
    const r2 = await pluggyWebhook(post("/api/pluggy/webhook", { "x-webhook-token": bancos.segredoWebhookPluggy() }, { event: "item/updated", itemId: "item-1" }));
    expect(await r2.json()).toEqual({ ok: true, contas: 0 });
    expect(f2).not.toHaveBeenCalled();
  });

  it("Pluggy: evento irrelevante é ignorado com 200", async () => {
    const r = await pluggyWebhook(post("/api/pluggy/webhook", { "x-webhook-token": bancos.segredoWebhookPluggy() }, { event: "connector/status_updated" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ignorado: true });
  });

  it("Asaas: sem token configurado recusa (falha fechado)", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await asaasWebhook(post("/api/asaas/webhook", { "asaas-access-token": "qualquer" }, { event: "PAYMENT_RECEIVED" }));
    expect(r.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("Asaas: token salvo como plain: é recriptografado; token errado 401; certo sincroniza as contas Asaas", async () => {
    await prisma.configuracao.create({ data: { chave: "asaas.webhookToken", valor: "plain:token-do-asaas", grupo: "bancos" } });
    const conta = await prisma.contaBancaria.create({ data: { banco: `${MARCA} Asaas`, conta: "Asaas", provedor: "asaas", credencialEncrypted: "plain:$aact_prod_x" } });
    const f = vi.fn((u: string) => (String(u).includes("/finance/balance") ? resp({ balance: 10 })
      : resp({ hasMore: false, data: [{ id: `${conta.id}-a1`, value: 10, date: "2026-10-20", description: "Pix" }] })));
    vi.stubGlobal("fetch", f);

    expect((await asaasWebhook(post("/api/asaas/webhook", { "asaas-access-token": "errado" }, { event: "PAYMENT_RECEIVED" }))).status).toBe(401);
    const cfg = await prisma.configuracao.findUniqueOrThrow({ where: { chave: "asaas.webhookToken" } });
    expect(cfg.valor).not.toContain("plain:");
    expect(f).not.toHaveBeenCalled();

    const r = await asaasWebhook(post("/api/asaas/webhook", { "asaas-access-token": "token-do-asaas" }, { event: "TRANSFER_DONE" }));
    expect(r.status).toBe(200);
    expect(await prisma.transacaoBancaria.count({ where: { contaId: conta.id, origem: "asaas" } })).toBe(1);
  });

  it("Asaas: token salvo em Integrações (só admin); ASAAS_WEBHOOK_TOKEN tem precedência", async () => {
    // LOTE B (25/10): o token sai do BPO › Bancos e passa a ser salvo em Configurações › Integrações.
    for (const role of ["corretor", "colaborador"]) {
      sessao.user.role = role;
      expect(await integracoes.salvarAsaasIntegracaoAcao({ webhookToken: "token-novo-123" })).toEqual({ erro: "Não autorizado." });
    }
    sessao.user.role = "admin";
    expect(await integracoes.salvarAsaasIntegracaoAcao({ webhookToken: "curto" })).toEqual({ erro: expect.stringMatching(/inválido/) });
    expect(await integracoes.salvarAsaasIntegracaoAcao({ webhookToken: "token-novo-123" })).toEqual({ ambiente: null });
    expect(await bancos.tokenWebhookAsaas()).toBe("token-novo-123");
    expect((await prisma.configuracao.findUniqueOrThrow({ where: { chave: "asaas.webhookToken" } })).valor).not.toContain("token-novo");

    process.env.ASAAS_WEBHOOK_TOKEN = "token-da-env-1";
    try {
      vi.stubGlobal("fetch", vi.fn());
      expect(await bancos.tokenWebhookAsaas()).toBe("token-da-env-1");
      expect((await asaasWebhook(post("/api/asaas/webhook", { "asaas-access-token": "token-novo-123" }, {}))).status).toBe(401);
      await prisma.configuracao.deleteMany({ where: { chave: "asaas.webhookToken" } });
      expect((await asaasWebhook(post("/api/asaas/webhook", { "asaas-access-token": "token-da-env-1" }, { event: "TRANSFER_DONE" }))).status).toBe(200);
    } finally { delete process.env.ASAAS_WEBHOOK_TOKEN; }
  });

  it("testar e importar conexão da Pluggy registram o webhook; falha no registro vira aviso", async () => {
    await prisma.configuracaoPluggy.create({ data: { id: 1, clientIdEncrypted: "plain:cid", clientSecretEncrypted: "plain:csec" } });
    const registrados: unknown[] = [];
    const fetchOk = vi.fn((u: string, init?: RequestInit) => {
      const s = String(u);
      if (s.endsWith("/auth")) return resp({ apiKey: "tok" });
      if (s.endsWith("/webhooks") && init?.method === "POST") { registrados.push(JSON.parse(String(init.body))); return resp({ id: "w1" }); }
      if (s.endsWith("/webhooks")) return resp({ results: [] });
      if (s.includes("/accounts?itemId=")) return resp({ results: [{ id: "acc-9", name: "Conta PJ", number: "123", balance: 5 }] });
      if (s.includes("/items/")) return resp({ connector: { name: `${MARCA} C6` } });
      return resp({}, 404);
    });
    vi.stubGlobal("fetch", fetchOk);
    expect(await acoes.testarPluggy()).toEqual({ ok: true, mensagem: "Pluggy conectada. Avisos em tempo real ativos." });
    expect(registrados[0]).toEqual({ event: "all", url: "https://www.gruposantafee.com.br/api/pluggy/webhook", headers: { "x-webhook-token": bancos.segredoWebhookPluggy() } });

    expect(await acoes.importarItemPluggy({ itemId: "item-novo-1" })).toEqual({ encontradas: 1, criadas: 1 });
    expect(registrados).toHaveLength(2);

    vi.stubGlobal("fetch", vi.fn((u: string, init?: RequestInit) =>
      String(u).endsWith("/auth") ? resp({ apiKey: "tok" }) : init?.method === "POST" ? resp({}, 500) : resp({ results: [] })));
    const r = await acoes.testarPluggy();
    expect(r).toMatchObject({ ok: true });
    expect((r as { mensagem: string }).mensagem).toMatch(/^Pluggy conectada\. \(Avisos em tempo real: .*HTTP 500/);
  });
});
