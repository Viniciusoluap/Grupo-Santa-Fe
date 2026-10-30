// Lote 3 (29/10/2026) — BPO itens 12, 16 e 17 com o banco real (TEST_DATABASE_URL). Nenhum serviço externo.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "usuario-teste", role: "admin" } }) }));
vi.mock("@/lib/auth/modulos", () => ({
  exigirModuloAcao: async () => ({ id: "usuario-teste", nome: "Teste" }),
  exigirAdminAtivo: async () => ({ id: "usuario-teste", nome: "Teste" }),
}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const MARCA = "TESTE-BPO-LOTE3";

describe.skipIf(!url)("Lote 3 — BPO (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let lote: typeof import("@/lib/actions/bpo-lote");
  let vinculo: typeof import("@/lib/actions/bpo-vinculo");
  let bpo: typeof import("@/lib/actions/bpo");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    lote = await import("@/lib/actions/bpo-lote");
    vinculo = await import("@/lib/actions/bpo-vinculo");
    bpo = await import("@/lib/actions/bpo");
  });
  const limpar = async () => {
    const ids = (await prisma.bpoLancamento.findMany({ where: { OR: [{ clienteNomeLivre: { startsWith: MARCA } }, { descricao: { startsWith: MARCA } }, { cliente: { razaoSocial: { startsWith: MARCA } } }] }, select: { id: true } })).map((l) => l.id);
    await prisma.bpoBaixa.deleteMany({ where: { lancamentoId: { in: ids } } });
    await prisma.bpoLancamento.updateMany({ where: { id: { in: ids } }, data: { combinadaEmId: null } });
    await prisma.bpoLancamento.deleteMany({ where: { id: { in: ids } } });
    await prisma.bpoLancamentoHistorico.deleteMany({ where: { lancamentoReferencia: { in: ids } } });
    await prisma.bpoLancamentoExclusaoBackup.deleteMany({ where: { snapshotJson: { contains: MARCA } } });
    await prisma.bpoCliente.deleteMany({ where: { razaoSocial: { startsWith: MARCA } } });
    await prisma.lead.deleteMany({ where: { nome: { startsWith: MARCA } } });
    await prisma.contaBancaria.deleteMany({ where: { banco: { startsWith: MARCA } } });
  };
  beforeEach(limpar);
  afterAll(async () => { await limpar(); await prisma.$disconnect(); });

  const novo = (descricao: string, extra: Record<string, unknown> = {}) => prisma.bpoLancamento.create({ data: {
    clienteNomeLivre: `${MARCA} Ana`, tipo: "recebimento", descricao: `${MARCA} ${descricao}`, valor: 100,
    vencimento: new Date("2026-10-10T12:00:00Z"), competencia: "2026-10", ...extra,
  } });

  it("item 12: cobrança sem classificação contábil grava a categoria derivada; Impostos não exige vínculo", async () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ tipo: "despesa", categoriaOperacional: "impostos", requestKey: `${MARCA}-rk1`, valor: "321.45", vencimento: "2026-10-20", competencia: "2026-10", descricao: `${MARCA} DAS`, clienteNomeLivre: `${MARCA} Receita` })) f.set(k, v);
    await bpo.criarCobranca(f);
    const l = await prisma.bpoLancamento.findUniqueOrThrow({ where: { requestKey: `${MARCA}-rk1` } });
    expect(l).toMatchObject({ categoria: "Impostos", categoriaContabil: "Impostos", categoriaOperacional: "impostos", vinculoOperacionalId: null, centroCustos: null });
  });

  it("item 16: Excluir tudo (filtro) apaga só excluíveis, preserva protegidos, grava backup e histórico", async () => {
    const conta = await prisma.contaBancaria.create({ data: { banco: `${MARCA} Cora`, conta: "1" } });
    const tx = await prisma.transacaoBancaria.create({ data: { contaId: conta.id, data: new Date(), descricao: "Pix", valor: 10, tipo: "credito" } });
    const livre1 = await novo("Livre 1"), livre2 = await novo("Livre 2");
    await novo("Asaas", { asaasPaymentId: `${MARCA}-pay` });
    await novo("Extrato", { transacaoId: tx.id, pago: true, valorRecebido: 10 });
    const parcial = await novo("Parcial", { valorRecebido: 30 });
    await prisma.bpoBaixa.create({ data: { lancamentoId: parcial.id, requestKey: `${MARCA}-b1`, valor: 30, data: new Date(), motivo: "x", usuarioId: "usuario-teste" } });
    const filtros = { busca: MARCA };
    expect(await lote.previaExclusaoLote({ aba: "cobrancas", modo: "tudo", filtros })).toMatchObject({ alcancados: 5, excluiveis: 2, protegidos: 3, porMotivo: { asaas: 1, extrato: 1, baixa: 2 } });
    expect(await lote.excluirLancamentosEmLote({ aba: "cobrancas", modo: "tudo", filtros, confirmacao: "Excluir" })).toEqual({ erro: expect.stringMatching(/EXCLUIR/) });
    const r = await lote.excluirLancamentosEmLote({ aba: "cobrancas", modo: "tudo", filtros, confirmacao: "EXCLUIR" });
    expect(r).toMatchObject({ excluidos: 2, protegidos: 3 });
    expect(await prisma.bpoLancamento.count({ where: { id: { in: [livre1.id, livre2.id] } } })).toBe(0);
    expect(await prisma.bpoLancamento.count({ where: { descricao: { startsWith: MARCA } } })).toBe(3);
    const backup = await prisma.bpoLancamentoExclusaoBackup.findUniqueOrThrow({ where: { id: (r as { backupId: string }).backupId } });
    expect(backup).toMatchObject({ quantidade: 2, protegidos: 3, criadoPorUsuarioId: "usuario-teste", modo: "tudo" });
    expect(JSON.parse(backup.snapshotJson)).toHaveLength(2);
    expect(await prisma.bpoLancamentoHistorico.count({ where: { lancamentoReferencia: { in: [livre1.id, livre2.id] }, motivo: { contains: "Excluído em lote" } } })).toBe(2);
  });

  it("item 16: combinar válido soma e marca as originais; bloqueado (Asaas) não altera nada", async () => {
    const a = await novo("A", { valor: 100.1, vencimento: new Date("2026-11-10T12:00:00Z") });
    const b = await novo("B", { valor: 200.2, vencimento: new Date("2026-10-20T12:00:00Z") });
    const c = await novo("C", { asaasPaymentId: `${MARCA}-pay2` });
    const bloq = await lote.combinarPagamentos({ ids: [a.id, c.id], requestKey: `${MARCA}-c1` });
    expect(bloq).toEqual({ erro: expect.stringMatching(/Asaas/) });
    expect(await prisma.bpoLancamento.count({ where: { combinadaEmId: { not: null }, descricao: { startsWith: MARCA } } })).toBe(0);
    const r = await lote.combinarPagamentos({ ids: [a.id, b.id], requestKey: `${MARCA}-c2` });
    if ("erro" in r) throw new Error(r.erro);
    expect(r).toMatchObject({ total: 300.3, combinadas: 2 });
    const nova = await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: r.novaId } });
    expect(nova).toMatchObject({ valor: 300.3, clienteNomeLivre: `${MARCA} Ana`, tipo: "recebimento" });
    expect(nova.vencimento.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect((await prisma.bpoLancamento.findMany({ where: { id: { in: [a.id, b.id] } } })).every((l) => l.combinadaEmId === r.novaId)).toBe(true);
  });

  it("revisão PR (P1): original já combinada recusa quitar, baixar, editar e vincular (lista antiga aberta)", async () => {
    const a = await novo("Orig A"), b = await novo("Orig B");
    const r = await lote.combinarPagamentos({ ids: [a.id, b.id], requestKey: `${MARCA}-c3` });
    if ("erro" in r) throw new Error(r.erro);
    const atual = await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: a.id } });
    const msg = new RegExp(`combinada na cobrança #${r.novaId}`);
    await expect(bpo.pagarLancamento(a.id)).rejects.toThrow(msg);
    await expect(bpo.registrarBaixaBpo({ id: a.id, version: atual.version, requestKey: `${MARCA}-bx`, valor: 50, data: "2026-10-30T12:00:00Z", motivo: "baixa velha" })).rejects.toThrow(msg);
    await expect(bpo.editarLancamentoBpo({ id: a.id, version: atual.version, motivo: "editar velha", descricao: "x", valor: 100, competencia: "2026-10", vencimento: "2026-10-10T12:00:00Z" })).rejects.toThrow(msg);
    const cli = await prisma.bpoCliente.create({ data: { razaoSocial: `${MARCA} Cli`, responsavel: "x", telefone: "1", honorarios: 0, diaVencimento: 10, dataInicio: new Date() } });
    expect(await vinculo.vincularClienteLancamento({ id: a.id, version: atual.version, clienteId: cli.id })).toEqual({ erro: expect.stringMatching(msg) });
    const depois = await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: a.id } });
    expect(depois).toMatchObject({ pago: false, valorRecebido: 0, version: atual.version, clienteId: null, combinadaEmId: r.novaId });
    expect(await prisma.bpoBaixa.count({ where: { lancamentoId: a.id } })).toBe(0);
    // A cobrança combinada continua aceitando a baixa normalmente.
    await bpo.pagarLancamento(r.novaId);
    expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: r.novaId } })).toMatchObject({ pago: true });
  });

  it("item 17: um único candidato forte (telefone) é sugerido; confirmar cria cliente do lead sem duplicar e audita", async () => {
    const lead = await prisma.lead.create({ data: { nome: `${MARCA} Maria`, telefone: "(91) 98888-7777", servico: "obras" } });
    const l = await novo("Pix 91988887777", { clienteNomeLivre: `${MARCA} Maria S` });
    const s = await vinculo.sugestoesClienteLancamento(l.id);
    expect(s.automatico?.candidato).toMatchObject({ leadId: lead.id, clienteId: null });
    const r = await vinculo.vincularClienteLancamento({ id: l.id, version: l.version, leadId: lead.id });
    if ("erro" in r) throw new Error(r.erro);
    expect(r.clienteCriado).toBe(true);
    const depois = await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: l.id } });
    expect(depois).toMatchObject({ clienteId: r.clienteId, clienteNomeLivre: null, version: l.version + 1 });
    const h = await prisma.bpoLancamentoHistorico.findFirstOrThrow({ where: { lancamentoReferencia: l.id } });
    expect(h.motivo).toMatch(/Vínculo com cliente do CRM/);
    expect(JSON.parse(h.antesJson).clienteNomeLivre).toBe(`${MARCA} Maria S`);
    const l2 = await novo("Outra", { clienteNomeLivre: `${MARCA} Maria` });
    const r2 = await vinculo.vincularClienteLancamento({ id: l2.id, version: l2.version, leadId: lead.id });
    expect(r2).toMatchObject({ clienteCriado: false, clienteId: r.clienteId });
    expect(await prisma.bpoCliente.count({ where: { leadId: lead.id } })).toBe(1);
    expect(await vinculo.vincularClienteLancamento({ id: l2.id, version: 1, leadId: lead.id })).toEqual({ erro: expect.stringMatching(/alterado/) });
  });
});
