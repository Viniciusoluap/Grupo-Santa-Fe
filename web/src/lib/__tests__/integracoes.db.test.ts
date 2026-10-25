// LOTE B/D (25/10): chave central do Asaas (tabela `configuracoes`) e credenciais da Pluggy com o banco
// real (TEST_DATABASE_URL). Mesmos cenários de Prospecta/server/bancos-chave-central.test.ts.
// Asaas e Pluggy simulados: nada externo é chamado.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ user: { id: "usuario-teste", role: "admin" } as { id: string; role: string } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const MARCA = "TESTE-INTEGRACOES-25-10";
const CHAVES = ["asaas.apiKey", "asaas.webhookToken"];
const resp = (corpo: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => corpo } as Response);

describe.skipIf(!url)("Integrações — chave central do Asaas e Pluggy (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let bancos: typeof import("@/lib/bancos");
  let central: typeof import("@/lib/bancos/asaas-central");
  let integracoes: typeof import("@/lib/integracoes");
  let acoesBanco: typeof import("@/lib/actions/banco");
  let acoes: typeof import("@/lib/actions/integracoes");
  let segredo: typeof import("@/lib/segredo");
  let configAntes: { chave: string; valor: string; grupo: string }[] = [];
  let pluggyAntes: Awaited<ReturnType<typeof prisma.configuracaoPluggy.findFirst>> = null;
  const env = { ASAAS_API_KEY: process.env.ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN, PLUGGY_CLIENT_ID: process.env.PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET: process.env.PLUGGY_CLIENT_SECRET };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    bancos = await import("@/lib/bancos");
    central = await import("@/lib/bancos/asaas-central");
    integracoes = await import("@/lib/integracoes");
    acoesBanco = await import("@/lib/actions/banco");
    acoes = await import("@/lib/actions/integracoes");
    segredo = await import("@/lib/segredo");
    configAntes = await prisma.configuracao.findMany({ where: { chave: { in: CHAVES } }, select: { chave: true, valor: true, grupo: true } });
    pluggyAntes = await prisma.configuracaoPluggy.findFirst();
  });
  const limpar = async () => {
    await prisma.contaBancaria.deleteMany({ where: { banco: { startsWith: MARCA } } });
    await prisma.configuracao.deleteMany({ where: { chave: { in: CHAVES } } });
    await prisma.configuracaoPluggy.deleteMany();
    for (const k of Object.keys(env)) delete process.env[k];
  };
  beforeEach(limpar);
  afterEach(() => { vi.unstubAllGlobals(); sessao.user.role = "admin"; });
  afterAll(async () => {
    await limpar();
    for (const c of configAntes) await prisma.configuracao.create({ data: c });
    if (pluggyAntes) await prisma.configuracaoPluggy.create({ data: pluggyAntes });
    for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
    await prisma.$disconnect();
  });

  it("chave salva em Integrações fica criptografada; plain: é recriptografado; ASAAS_API_KEY tem precedência", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resp({ balance: 5 })));
    expect(await acoes.salvarAsaasIntegracaoAcao({ apiKey: "$aact_prod_central_1234" })).toEqual({ ambiente: "production" });
    const linha = await prisma.configuracao.findUniqueOrThrow({ where: { chave: "asaas.apiKey" } });
    expect(linha.valor).not.toContain("aact");
    expect(await central.chaveAsaasCentral()).toEqual({ apiKey: "$aact_prod_central_1234", environment: "production", fonte: "banco" });

    await prisma.configuracao.update({ where: { chave: "asaas.apiKey" }, data: { valor: "plain:$aact_hmlg_carga_0001" } });
    expect(await central.chaveAsaasCentral()).toMatchObject({ apiKey: "$aact_hmlg_carga_0001", environment: "sandbox" });
    expect((await prisma.configuracao.findUniqueOrThrow({ where: { chave: "asaas.apiKey" } })).valor).not.toContain("plain:");

    process.env.ASAAS_API_KEY = "$aact_prod_env_9999";
    expect(await central.chaveAsaasCentral()).toEqual({ apiKey: "$aact_prod_env_9999", environment: "production", fonte: "env" });
    const s = await integracoes.statusIntegracoes();
    expect(s.asaas).toMatchObject({ fonte: "env", final: "…9999", salvaNoBancoIgnorada: true });
    expect(JSON.stringify(s)).not.toContain("aact");
  });

  it("conta Asaas sem chave própria usa a central; conta antiga continua com a dela; sem central pede Integrações", async () => {
    const semChave = await prisma.contaBancaria.create({ data: { banco: `${MARCA} Asaas`, conta: "Asaas", provedor: "asaas" } });
    await expect(bancos.credencialDaConta(semChave)).rejects.toThrow("Cadastre a chave do Asaas em Configurações › Integrações.");
    const r0 = await bancos.sincronizarConta(semChave.id, vi.fn() as never);
    expect(r0).toEqual({ ok: false, mensagem: "Cadastre a chave do Asaas em Configurações › Integrações." });

    await central.salvarAsaasCentral({ apiKey: "$aact_prod_central_1234" });
    expect(await bancos.credencialDaConta(semChave)).toBe("$aact_prod_central_1234");
    const usadas: string[] = [];
    const f = vi.fn((u: string, init?: RequestInit) => {
      usadas.push((init?.headers as Record<string, string>).access_token);
      return String(u).includes("/finance/balance") ? resp({ balance: 7 }) : resp({ hasMore: false, data: [] });
    });
    expect(await bancos.sincronizarConta(semChave.id, f as never)).toMatchObject({ ok: true, saldo: 7 });
    expect(new Set(usadas)).toEqual(new Set(["$aact_prod_central_1234"]));

    const antiga = await prisma.contaBancaria.create({ data: { banco: `${MARCA} Asaas antiga`, conta: "Asaas", provedor: "asaas", credencialEncrypted: "plain:$aact_prod_propria" } });
    expect(await bancos.credencialDaConta(antiga)).toBe("$aact_prod_propria");
  });

  it("nova conta Asaas sem chave: valida pela central e não grava chave na conta", async () => {
    expect(await acoesBanco.criarContaBancaria({ provedor: "asaas", banco: `${MARCA} Asaas` })).toEqual({ erroAcao: "Cadastre a chave do Asaas em Configurações › Integrações." });
    await central.salvarAsaasCentral({ apiKey: "$aact_prod_central_1234" });
    const f = vi.fn((_u: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).access_token).toBe("$aact_prod_central_1234");
      return resp({ balance: 42 });
    });
    vi.stubGlobal("fetch", f);
    const r = await acoesBanco.criarContaBancaria({ provedor: "asaas", banco: `${MARCA} Asaas`, dataInicial: "2026-10-05" });
    if ("erroAcao" in r) throw new Error(r.erroAcao);
    expect(await prisma.contaBancaria.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ provedor: "asaas", saldoAtual: 42, credencialEncrypted: null });
  });

  it("Pluggy: salva em Integrações (validando), usa PLUGGY_* só sem nada salvo e mostra o motivo real", async () => {
    process.env.PLUGGY_CLIENT_ID = "cid-da-env-0001";
    process.env.PLUGGY_CLIENT_SECRET = "sec-da-env-0002";
    expect(await bancos.credenciaisPluggy()).toEqual({ clientId: "cid-da-env-0001", clientSecret: "sec-da-env-0002", fonte: "env" });
    expect((await integracoes.statusIntegracoes()).pluggy).toEqual({ configurado: true, clientIdFinal: "…0001", secretFinal: "…0002", fonte: "env" });

    vi.stubGlobal("fetch", vi.fn(() => resp({ message: "Trial period expired" }, 403)));
    expect(await acoes.salvarPluggyIntegracaoAcao({ clientId: "cid-nova", clientSecret: "sec-nova" }))
      .toEqual({ erro: "A Pluggy recusou (HTTP 403): Trial period expired — o plano gratuito da Pluggy não libera a API; use Importar extrato." });
    expect(await prisma.configuracaoPluggy.count()).toBe(0);
    await expect(bancos.tokenPluggy(vi.fn(() => resp({ message: "Trial period expired" }, 403)) as never))
      .rejects.toThrow("A Pluggy recusou (HTTP 403): Trial period expired — o plano gratuito da Pluggy não libera a API; use Importar extrato.");

    vi.stubGlobal("fetch", vi.fn(() => resp({ apiKey: "tok" })));
    expect(await acoes.salvarPluggyIntegracaoAcao({ clientId: "cid-nova-1111", clientSecret: "sec-nova-2222" })).toEqual({});
    const cfg = await prisma.configuracaoPluggy.findFirstOrThrow();
    expect(cfg.clientIdEncrypted).not.toContain("cid-nova");
    expect(segredo.descriptografarSegredo(cfg.clientSecretEncrypted)).toBe("sec-nova-2222");
    expect(await bancos.credenciaisPluggy()).toMatchObject({ clientId: "cid-nova-1111", fonte: "banco" });

    await prisma.configuracaoPluggy.deleteMany();
    delete process.env.PLUGGY_CLIENT_ID;
    await expect(bancos.tokenPluggy(vi.fn() as never)).rejects.toThrow("Configure o Client ID e o Client Secret da Pluggy em Configurações › Integrações.");
  });

  it("status pela action nunca devolve segredo (nem criptografado)", async () => {
    await central.salvarAsaasCentral({ apiKey: "$aact_prod_central_1234", webhookToken: "token-webhook-5678" });
    const r = await acoes.statusIntegracoesAcao();
    expect(r.status?.asaas).toMatchObject({ configurado: true, final: "…1234", webhookFinal: "…5678", fonte: "banco", webhookFonte: "banco" });
    const json = JSON.stringify(r);
    const cifradas = await prisma.configuracao.findMany({ where: { chave: { in: CHAVES } } });
    for (const s of ["$aact_prod_central_1234", "token-webhook-5678", ...cifradas.map((c) => c.valor)]) expect(json).not.toContain(s);
  });
});
