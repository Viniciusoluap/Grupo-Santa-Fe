// Pedido de 25/10: sincronização por API (Asaas, Pluggy) e importação de extrato.
// Mesmos cenários de Prospecta/server/bancos-sync.test.ts, aqui com o banco real (TEST_DATABASE_URL).
// APIs externas simuladas: nenhum teste chama Asaas/Pluggy de verdade.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ user: { id: "usuario-teste", role: "admin" } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const MARCA = "TESTE-BANCOS-25-10";

function resposta(corpo: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => corpo } as Response);
}

describe.skipIf(!url)("BPO › Bancos (banco real, APIs simuladas)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let bancos: typeof import("@/lib/bancos");
  let segredo: typeof import("@/lib/segredo");
  let acoes: typeof import("@/lib/actions/banco");
  let pluggyAntes: Awaited<ReturnType<typeof prisma.configuracaoPluggy.findFirst>> = null;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    bancos = await import("@/lib/bancos");
    segredo = await import("@/lib/segredo");
    acoes = await import("@/lib/actions/banco");
    pluggyAntes = await prisma.configuracaoPluggy.findFirst();
  });
  const limpar = () => prisma.contaBancaria.deleteMany({ where: { banco: { startsWith: MARCA } } });
  beforeEach(limpar);
  afterEach(() => { vi.unstubAllGlobals(); });
  afterAll(async () => {
    await limpar();
    await prisma.configuracaoPluggy.deleteMany();
    if (pluggyAntes) await prisma.configuracaoPluggy.create({ data: pluggyAntes });
    await prisma.$disconnect();
  });

  const criarConta = (extra: Record<string, unknown> = {}) =>
    prisma.contaBancaria.create({
      data: { banco: `${MARCA} Asaas`, conta: "Asaas", provedor: "asaas", credencialEncrypted: "plain:$aact_prod_teste", dataInicial: new Date("2026-10-01T00:00:00Z"), ...extra },
    });

  it("Asaas: lê a partir da data inicial, descarta o anterior, grava saldo e recriptografa a chave", async () => {
    const conta = await criarConta();
    const chamadas: string[] = [];
    const fetchFake = vi.fn((u: string, init?: RequestInit) => {
      chamadas.push(u);
      expect((init?.headers as Record<string, string>).access_token).toBe("$aact_prod_teste");
      if (u.includes("/finance/balance")) return resposta({ balance: 1234.5 });
      return resposta({
        hasMore: false,
        data: [
          { id: `${conta.id}-ft1`, value: 500, date: "2026-10-02", description: "Pix recebido" },
          { id: `${conta.id}-ft2`, value: -40, date: "2026-10-03", description: "Taxa" },
          { id: `${conta.id}-ft0`, value: 99, date: "2026-09-30", description: "De outra empresa" },
        ],
      });
    });
    const r = await bancos.sincronizarConta(conta.id, fetchFake as never);
    expect(r).toMatchObject({ ok: true, novos: 2, saldo: 1234.5 });
    expect(chamadas[0]).toContain("https://api.asaas.com/v3/financialTransactions?startDate=2026-10-01");
    const tx = await prisma.transacaoBancaria.findMany({ where: { contaId: conta.id }, orderBy: { data: "asc" } });
    expect(tx.map((t) => [t.externalId, t.tipo, t.valor, t.origem])).toEqual([
      [`asaas:${conta.id}-ft1`, "credito", 500, "asaas"],
      [`asaas:${conta.id}-ft2`, "debito", 40, "asaas"],
    ]);
    const depois = await prisma.contaBancaria.findUniqueOrThrow({ where: { id: conta.id } });
    expect(depois.credencialEncrypted).not.toContain("plain:");
    expect(segredo.descriptografarSegredo(depois.credencialEncrypted!)).toBe("$aact_prod_teste");
    expect(depois).toMatchObject({ saldoAtual: 1234.5, ultimoErro: null });
    expect(depois.ultimaSincronizacao).toBeInstanceOf(Date);

    // Sincronizar de novo não duplica.
    expect(await bancos.sincronizarConta(conta.id, fetchFake as never)).toMatchObject({ ok: true, novos: 0 });
  });

  it("Pluggy: credenciais 'plain:' do banco, from = data inicial, saldo atualizado e segredos recriptografados", async () => {
    await prisma.configuracaoPluggy.deleteMany();
    await prisma.configuracaoPluggy.create({ data: { id: 1, clientIdEncrypted: "plain:cid", clientSecretEncrypted: "plain:csec" } });
    const conta = await prisma.contaBancaria.create({
      data: { banco: `${MARCA} Pluggy`, conta: "1", provedor: "pluggy", pluggyAccountId: "acc-1", dataInicial: new Date("2026-08-15T00:00:00Z") },
    });
    const fetchFake = vi.fn((u: string, init?: RequestInit) => {
      if (u.endsWith("/auth")) {
        expect(JSON.parse(String(init?.body))).toEqual({ clientId: "cid", clientSecret: "csec" });
        return resposta({ apiKey: "tok" });
      }
      if (u.includes("/transactions?")) {
        expect(u).toContain("from=2026-08-15");
        return resposta({ totalPages: 1, results: [{ id: `${conta.id}-t1`, date: "2026-09-01T00:00:00Z", description: "Pix", amount: 70, type: "CREDIT" }] });
      }
      return resposta({ balance: 70 });
    });
    const r = await bancos.sincronizarConta(conta.id, fetchFake as never);
    expect(r).toMatchObject({ ok: true, novos: 1, saldo: 70 });
    const tx = await prisma.transacaoBancaria.findFirstOrThrow({ where: { contaId: conta.id } });
    expect(tx).toMatchObject({ externalId: `${conta.id}-t1`, origem: "pluggy", valor: 70 });
    const cfg = await prisma.configuracaoPluggy.findFirstOrThrow();
    expect(cfg.clientIdEncrypted).not.toContain("plain:");
    expect(segredo.descriptografarSegredo(cfg.clientSecretEncrypted)).toBe("csec");
  });

  it("erro da API fica registrado na conta e volta como mensagem (sem estourar)", async () => {
    const conta = await criarConta();
    // LOTE D (25/10): o motivo real do Asaas (errors[].description) + a dica de restrição de IP no 401.
    const r = await bancos.sincronizarConta(conta.id, vi.fn(() => resposta({ errors: [{ code: "invalid_access_token", description: "A chave de API fornecida é inválida" }] }, 401)) as never);
    expect(r.ok).toBe(false);
    expect(r.mensagem).toBe("O Asaas recusou o acesso (HTTP 401): A chave de API fornecida é inválida. Confira se a chave está ativa e se há restrição de IP no Asaas (Integrações › Chave de API).");
    expect((await prisma.contaBancaria.findUniqueOrThrow({ where: { id: conta.id } })).ultimoErro).toMatch(/HTTP 401\): A chave de API fornecida é inválida/);
  });

  it("conta de importação não sincroniza por API; o cron diário só pega contas Asaas/Pluggy ativas", async () => {
    const manual = await criarConta({ banco: `${MARCA} Cora`, provedor: "manual", credencialEncrypted: null });
    const fetchFake = vi.fn();
    expect((await bancos.sincronizarConta(manual.id, fetchFake as never)).ok).toBe(false);
    expect(fetchFake).not.toHaveBeenCalled();
    const inativa = await criarConta({ ativo: false });
    const r = await bancos.sincronizarTodasContas(vi.fn(() => resposta({}, 401)) as never);
    const ids = r.resultados.map((x) => x.contaId);
    expect(ids).not.toContain(manual.id);
    expect(ids).not.toContain(inativa.id);
  });

  describe("importação de extrato", () => {
    const csv = Buffer.from("Data;Descrição;Valor\n30/09/2026;Antes;10,00\n01/10/2026;Pix;10,00\n01/10/2026;Pix;10,00\n02/10/2026;Tarifa;-5,00");

    it("prévia aplica a data inicial e marca o que já foi importado; confirmação usa as mesmas chaves", async () => {
      const conta = await criarConta({ banco: `${MARCA} Cora`, provedor: "manual", credencialEncrypted: null });
      const previa = await bancos.previaImportacao(conta.id, "cora.csv", csv);
      expect(previa.antesDaDataInicial).toBe(1);
      expect(previa.dataInicial).toBe("2026-10-01");
      expect(previa.linhas).toHaveLength(3);
      expect(previa.linhas.every((l) => !l.jaImportada)).toBe(true);

      const r = await bancos.confirmarImportacao(conta.id, previa.linhas.map((l) => ({ data: l.data, descricao: l.descricao, valor: l.valor, tipo: l.tipo })));
      expect(r.novos).toBe(3);
      const tx = await prisma.transacaoBancaria.findMany({ where: { contaId: conta.id } });
      expect(new Set(tx.map((t) => t.externalId)).size).toBe(3);
      expect(tx.every((t) => t.externalId!.startsWith(`imp:${conta.id}:`))).toBe(true);
      expect(tx.map((t) => t.origem)).toEqual(["importacao", "importacao", "importacao"]);

      // Reimportar o mesmo arquivo: a prévia acusa as linhas já gravadas e nada duplica.
      const deNovo = await bancos.previaImportacao(conta.id, "cora.csv", csv);
      expect(deNovo.linhas.every((l) => l.jaImportada)).toBe(true);
      expect((await bancos.confirmarImportacao(conta.id, deNovo.linhas)).novos).toBe(0);
    });

    it("formato desconhecido dá erro claro", async () => {
      const conta = await criarConta({ banco: `${MARCA} Cora`, provedor: "manual", credencialEncrypted: null, dataInicial: null });
      await expect(bancos.previaImportacao(conta.id, "extrato.docx", Buffer.from("x"))).rejects.toThrow(/Formato não suportado/);
    });

    it("pela action: prévia via FormData e confirmação gravam na conta", async () => {
      const conta = await criarConta({ banco: `${MARCA} Cora`, provedor: "manual", credencialEncrypted: null });
      const fd = new FormData();
      fd.set("contaId", conta.id);
      fd.set("arquivo", new File([csv], "cora.csv", { type: "text/csv" }));
      const previa = await acoes.previaImportacaoExtrato(fd);
      if ("erroAcao" in previa) throw new Error(previa.erroAcao);
      expect(previa.linhas).toHaveLength(3);
      const r = await acoes.confirmarImportacaoExtrato(conta.id, previa.linhas);
      expect(r).toMatchObject({ novos: 3 });
    });
  });

  it("action: conta Asaas valida a chave pelo saldo, guarda criptografada e não devolve a chave", async () => {
    vi.stubGlobal("fetch", vi.fn((u: string) => (String(u).includes("/finance/balance") ? resposta({ balance: 42 }) : resposta({}, 404))));
    const r = await acoes.criarContaBancaria({ provedor: "asaas", banco: `${MARCA} Asaas`, apiKey: "$aact_prod_nova", dataInicial: "2026-10-05" });
    if ("erroAcao" in r) throw new Error(r.erroAcao);
    expect(Object.keys(r)).toEqual(["id"]);
    const conta = await prisma.contaBancaria.findUniqueOrThrow({ where: { id: r.id } });
    expect(conta).toMatchObject({ provedor: "asaas", saldoAtual: 42, conta: "Asaas" });
    expect(conta.dataInicial?.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(conta.credencialEncrypted).not.toContain("aact");
    expect(segredo.descriptografarSegredo(conta.credencialEncrypted!)).toBe("$aact_prod_nova");

    // Chave recusada: erro em português, nada criado.
    vi.stubGlobal("fetch", vi.fn(() => resposta({}, 401)));
    const recusada = await acoes.criarContaBancaria({ provedor: "asaas", banco: `${MARCA} Asaas 2`, apiKey: "$aact_x" });
    expect(recusada).toEqual({ erroAcao: expect.stringMatching(/^O Asaas recusou o acesso \(HTTP 401\)\. Confira se a chave está ativa e se há restrição de IP/) });

    // Lote 3, item 13B: sem digitar EXCLUIR (case-sensitive) nada é alterado.
    for (const errado of [undefined, "excluir", "EXCLUÍR", conta.banco]) {
      expect(await acoes.excluirContaBancaria(r.id, errado)).toEqual({ erroAcao: expect.stringMatching(/EXCLUIR/) });
    }
    expect((await prisma.contaBancaria.findUniqueOrThrow({ where: { id: r.id } })).ativo).toBe(true);
    // Com EXCLUIR: backup com usuário e data; a conta fica inativa.
    expect(await acoes.excluirContaBancaria(r.id, "EXCLUIR")).toMatchObject({ success: true, transacoes: 0, excluidaEm: expect.any(String) });
    expect(await prisma.bpoContaLimpezaBackup.count({ where: { contaReferencia: r.id, criadoPorUsuarioId: { not: null } } })).toBe(1);
    await prisma.bpoContaLimpezaBackup.deleteMany({ where: { contaReferencia: r.id } });
    expect((await prisma.contaBancaria.findUniqueOrThrow({ where: { id: r.id } })).ativo).toBe(false);
  });
});

describe("PDF de verdade (gerado no teste)", () => {
  it("extrai as linhas do PDF e lê os lançamentos", async () => {
    const { jsPDF } = await import("jspdf");
    const { lerArquivoExtrato } = await import("@/lib/bancos");
    const doc = new jsPDF();
    doc.text("Extrato Conta PJ - outubro/2026", 10, 10);
    doc.text("01/10/2026  PIX RECEBIDO CLIENTE  1.200,00  3.200,00", 10, 20);
    doc.text("02/10/2026  PAGAMENTO BOLETO  -350,75  2.849,25", 10, 30);
    const r = await lerArquivoExtrato("extrato.pdf", Buffer.from(doc.output("arraybuffer")));
    expect(r.formato).toBe("PDF");
    expect(r.linhas).toEqual([
      { data: "2026-10-01", descricao: "PIX RECEBIDO CLIENTE", valor: 1200, tipo: "credito", titular: "CLIENTE", original: "PIX RECEBIDO CLIENTE 1.200,00 3.200,00" },
      { data: "2026-10-02", descricao: "PAGAMENTO BOLETO", valor: 350.75, tipo: "debito", original: "PAGAMENTO BOLETO -350,75 2.849,25" },
    ]);
  });
});
