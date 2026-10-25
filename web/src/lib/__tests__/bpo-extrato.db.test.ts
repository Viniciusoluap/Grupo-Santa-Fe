// LOTE C (25/10): extrato bancário alimentando o BPO Financeiro, com o banco real (TEST_DATABASE_URL).
// 1:1 sem duplicar, crédito/débito, transferência interna, backfill idempotente, saldo e DRE.
// APIs externas simuladas: nenhum teste chama Asaas/Pluggy de verdade.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ user: { id: "usuario-teste", role: "admin" } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const MARCA = "TESTE-BPO-EXTRATO-25-10";

describe.skipIf(!url)("LOTE C — extrato alimentando o BPO (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let bancos: typeof import("@/lib/bancos");
  let lanc: typeof import("@/lib/bancos/lancamentos-bpo");
  let acoes: typeof import("@/lib/actions/banco");
  let resultado: typeof import("@/lib/financeiro/bpo-resultado");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    bancos = await import("@/lib/bancos");
    lanc = await import("@/lib/bancos/lancamentos-bpo");
    acoes = await import("@/lib/actions/banco");
    resultado = await import("@/lib/financeiro/bpo-resultado");
  });
  const limpar = async () => {
    await prisma.contaBancaria.deleteMany({ where: { banco: { startsWith: MARCA } } });
    await prisma.bpoCliente.deleteMany({ where: { razaoSocial: { startsWith: MARCA } } });
  };
  beforeEach(limpar);
  afterAll(async () => { await limpar(); await prisma.$disconnect(); });

  const criarConta = (extra: Record<string, unknown> = {}) =>
    prisma.contaBancaria.create({ data: { banco: `${MARCA} Cora`, conta: "123", provedor: "manual", ...extra } });
  const lancamentosDa = (contaId: string) =>
    prisma.bpoLancamento.findMany({ where: { transacao: { contaId } }, include: { transacao: true }, orderBy: { valor: "asc" } });

  const CSV = Buffer.from([
    "Data;Descrição;Valor;Saldo",
    "01/10/2026;Pix recebido Cliente A;1.500,00;1.500,00",
    "02/10/2026;Pagamento depósito materiais de construção;-320,40;1.179,60",
    "03/10/2026;Transferência entre contas mesma titularidade;-1.000,00;179,60",
    "04/10/2026;Tarifa pacote de serviços;-19,60;160,00",
  ].join("\n"));

  it("importação gera 1 lançamento pago por movimentação (crédito → receita, débito → despesa) e reimportar não duplica", async () => {
    const conta = await criarConta();
    const previa = await bancos.previaImportacao(conta.id, "cora.csv", CSV);
    expect(previa.saldo).toEqual({ valor: 160, data: "2026-10-04" });
    const r = await bancos.confirmarImportacao(conta.id, previa.linhas, previa.saldo);
    expect(r.novos).toBe(4);
    expect(r.lancamentosCriados).toBe(4);

    const ls = await lancamentosDa(conta.id);
    expect(ls).toHaveLength(4);
    expect(ls.every((l) => l.pago && l.transacaoId)).toBe(true);
    const receita = ls.find((l) => l.valor === 1500)!;
    expect(receita).toMatchObject({ tipo: "recebimento", competencia: "2026-10", categoria: "Recebimento de cliente", descricao: "Pix recebido Cliente A" });
    expect(receita.vencimento.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(receita.pagoEm?.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(ls.find((l) => l.valor === 320.4)).toMatchObject({ tipo: "despesa", categoria: "Material" });
    expect(ls.find((l) => l.valor === 1000)).toMatchObject({ tipo: "despesa", categoria: "Transferência interna" });
    expect(ls.find((l) => l.valor === 19.6)).toMatchObject({ tipo: "despesa", categoria: "Tarifas bancárias" });
    // A categoria também fica na movimentação.
    expect(ls.find((l) => l.valor === 320.4)!.transacao!.categoria).toBe("Material");

    const deNovo = await bancos.previaImportacao(conta.id, "cora.csv", CSV);
    const r2 = await bancos.confirmarImportacao(conta.id, deNovo.linhas, deNovo.saldo);
    expect(r2.novos).toBe(0);
    expect(r2.lancamentosCriados).toBe(0);
    expect(await lancamentosDa(conta.id)).toHaveLength(4);
  });

  it("transferência interna fica fora do DRE e da contabilidade", async () => {
    const conta = await criarConta();
    const previa = await bancos.previaImportacao(conta.id, "cora.csv", CSV);
    await bancos.confirmarImportacao(conta.id, previa.linhas, previa.saldo);
    const ls = (await lancamentosDa(conta.id)).map((l) => ({ tipo: l.tipo, valor: l.valor, competencia: l.competencia, pago: l.pago, categoria: l.categoria }));
    expect(resultado.montarDre(ls)).toEqual([{ competencia: "2026-10", receitas: 1500, despesas: 340, resultado: 1160 }]);
    expect(resultado.resumoContabil(ls, "2026-01", "2026-12")).toMatchObject({ receitaRealizada: 1500, despesasPagas: 340 });
  });

  it("saldo: usa o saldo do arquivo; sem saldo no arquivo, soma as movimentações; saldo mais antigo não sobrescreve", async () => {
    const conta = await criarConta();
    const previa = await bancos.previaImportacao(conta.id, "cora.csv", CSV);
    const r = await bancos.confirmarImportacao(conta.id, previa.linhas, previa.saldo);
    expect(r.saldoAtual).toBe(160);
    // Arquivo seguinte, sem saldo: saldo do extrato + movimentações depois da data dele.
    const semSaldo = Buffer.from(["Data;Descrição;Valor", "05/10/2026;Pix recebido Cliente B;40,00"].join("\n"));
    const p2 = await bancos.previaImportacao(conta.id, "b.csv", semSaldo);
    expect(p2.saldo).toBeNull();
    expect((await bancos.confirmarImportacao(conta.id, p2.linhas, p2.saldo)).saldoAtual).toBe(200);
    // Arquivo antigo com saldo: não troca o saldo de referência mais recente.
    await lanc.recalcularSaldoConta(conta.id, { valor: 999, data: "2026-09-01" });
    expect((await prisma.contaBancaria.findUnique({ where: { id: conta.id } }))!.saldoAtual).toBe(200);

    const outra = await criarConta();
    const p3 = await bancos.previaImportacao(outra.id, "b.csv", semSaldo);
    expect((await bancos.confirmarImportacao(outra.id, p3.linhas, p3.saldo)).saldoAtual).toBe(40);
  });

  it("sincronização por API também gera os lançamentos (gravarMovimentos)", async () => {
    const conta = await criarConta({ provedor: "asaas", banco: `${MARCA} Asaas` });
    const r = await bancos.gravarMovimentos(conta, [
      { externalId: `${conta.id}-a1`, data: "2026-10-02", descricao: "Cobrança recebida", valor: 500, tipo: "credito", categoria: "PAYMENT_RECEIVED" },
      { externalId: `${conta.id}-a2`, data: "2026-10-03", descricao: "Taxa do boleto", valor: 2.99, tipo: "debito", categoria: "PAYMENT_FEE" },
    ], "asaas");
    expect(r.lancamentosCriados).toBe(2);
    const ls = await lancamentosDa(conta.id);
    // Categoria do provedor fora da lista padrão é trocada pela sugestão.
    expect(ls.map((l) => l.categoria)).toEqual(["Tarifas bancárias", "Recebimento de cliente"]);
  });

  it("backfill idempotente: movimentações antigas sem lançamento ganham o seu, uma única vez", async () => {
    const conta = await criarConta();
    await prisma.transacaoBancaria.createMany({
      data: [
        { contaId: conta.id, data: new Date("2026-09-10T12:00:00Z"), descricao: "Pix recebido antigo", valor: 700, tipo: "credito", externalId: `${conta.id}-old1`, origem: "importacao" },
        { contaId: conta.id, data: new Date("2026-09-11T12:00:00Z"), descricao: "DARF", valor: 70, tipo: "debito", externalId: `${conta.id}-old2`, origem: "importacao" },
      ],
    });
    expect(await lancamentosDa(conta.id)).toHaveLength(0);
    const r1 = await acoes.reprocessarMovimentacoesAcao();
    if ("erroAcao" in r1) throw new Error(r1.erroAcao);
    expect(r1.criados).toBeGreaterThanOrEqual(2);
    const ls = await lancamentosDa(conta.id);
    expect(ls).toHaveLength(2);
    expect(ls.map((l) => [l.tipo, l.categoria, l.competencia])).toEqual([["despesa", "Impostos", "2026-09"], ["recebimento", "Recebimento de cliente", "2026-09"]]);
    expect((await prisma.contaBancaria.findUnique({ where: { id: conta.id } }))!.saldoAtual).toBe(630);

    const r2 = await lanc.reprocessarMovimentacoes();
    expect(r2.criados).toBe(0);
    expect(await lancamentosDa(conta.id)).toHaveLength(2);
  });

  it("editar categoria e cliente BPO da movimentação atualiza o lançamento vinculado", async () => {
    const conta = await criarConta();
    const previa = await bancos.previaImportacao(conta.id, "cora.csv", CSV);
    await bancos.confirmarImportacao(conta.id, previa.linhas, previa.saldo);
    const cliente = await prisma.bpoCliente.create({
      data: { razaoSocial: `${MARCA} Cliente`, responsavel: "Fulano", telefone: "0", honorarios: 0, dataInicio: new Date() },
    });
    const t = await prisma.transacaoBancaria.findFirstOrThrow({ where: { contaId: conta.id, valor: 1000 } });
    const r = await acoes.classificarTransacaoAcao(t.id, { categoria: "Mão de obra", clienteId: cliente.id });
    if ("erroAcao" in r) throw new Error(r.erroAcao);
    const l = await prisma.bpoLancamento.findUniqueOrThrow({ where: { transacaoId: t.id } });
    expect(l).toMatchObject({ categoria: "Mão de obra", clienteId: cliente.id });
    expect((await prisma.transacaoBancaria.findUniqueOrThrow({ where: { id: t.id } })).categoria).toBe("Mão de obra");

    const lista = await acoes.listarTransacoesConta(conta.id);
    if ("erroAcao" in lista) throw new Error(lista.erroAcao);
    expect(lista.find((x) => x.id === t.id)).toMatchObject({ categoria: "Mão de obra", clienteId: cliente.id });

    const ruim = await acoes.classificarTransacaoAcao(t.id, { categoria: "Inventada" });
    expect("erroAcao" in ruim && ruim.erroAcao).toMatch(/Categoria inválida/);
    // Remover o cliente.
    await acoes.classificarTransacaoAcao(t.id, { clienteId: null });
    expect((await prisma.bpoLancamento.findUniqueOrThrow({ where: { transacaoId: t.id } })).clienteId).toBeNull();
  });

  it("apagar a conta apaga as movimentações e os lançamentos gerados por elas", async () => {
    const conta = await criarConta();
    const previa = await bancos.previaImportacao(conta.id, "cora.csv", CSV);
    await bancos.confirmarImportacao(conta.id, previa.linhas, previa.saldo);
    const ids = (await lancamentosDa(conta.id)).map((l) => l.id);
    await prisma.contaBancaria.delete({ where: { id: conta.id } });
    expect(await prisma.bpoLancamento.count({ where: { id: { in: ids } } })).toBe(0);
  });
});
