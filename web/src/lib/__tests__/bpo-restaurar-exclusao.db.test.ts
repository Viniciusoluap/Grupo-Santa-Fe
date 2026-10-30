// Lote 4 (30/10/2026) — "Restaurar" exclusões em lote do BPO com o banco real (TEST_DATABASE_URL).
// Gêmeo da Prospecta: server/bpo-restauracao.test.ts. Nenhum serviço externo.
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

const MARCA = "TESTE-BPO-RESTAURAR";

describe.skipIf(!url)("Lote 4 — restaurar exclusão em lote do BPO (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let lote: typeof import("@/lib/actions/bpo-lote");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    lote = await import("@/lib/actions/bpo-lote");
  });
  const limpar = async () => {
    const ids = (await prisma.bpoLancamento.findMany({ where: { OR: [{ descricao: { startsWith: MARCA } }, { clienteNomeLivre: { startsWith: MARCA } }] }, select: { id: true } })).map((l) => l.id);
    await prisma.bpoLancamento.deleteMany({ where: { id: { in: ids } } });
    await prisma.bpoLancamentoHistorico.deleteMany({ where: { OR: [{ lancamentoReferencia: { in: ids } }, { antesJson: { contains: MARCA } }, { depoisJson: { contains: MARCA } }] } });
    await prisma.bpoLancamentoExclusaoBackup.deleteMany({ where: { snapshotJson: { contains: MARCA } } });
    await prisma.bpoCliente.deleteMany({ where: { razaoSocial: { startsWith: MARCA } } });
    await prisma.obra.deleteMany({ where: { nome: { startsWith: MARCA } } });
  };
  beforeEach(limpar);
  afterAll(async () => { await limpar(); await prisma.$disconnect(); });

  const novo = (descricao: string, extra: Record<string, unknown> = {}) => prisma.bpoLancamento.create({ data: {
    clienteNomeLivre: null, tipo: "recebimento", descricao: `${MARCA} ${descricao}`, valor: 100,
    vencimento: new Date("2026-10-10T12:00:00Z"), competencia: "2026-10", ...extra,
  } });

  async function excluir(ids: string[]) {
    const r = await lote.excluirLancamentosEmLote({ aba: "cobrancas", modo: "selecionados", ids, confirmacao: "EXCLUIR" });
    if ("erro" in r) throw new Error(r.erro);
    return r.backupId as string;
  }

  it("prévia, restauração em transação, vínculos que sumiram, histórico e sem restaurar duas vezes", async () => {
    const cli = await prisma.bpoCliente.create({ data: { razaoSocial: `${MARCA} Cliente`, responsavel: "x", telefone: "1", honorarios: 0, dataInicio: new Date() } });
    const obra = await prisma.obra.create({ data: { nome: `${MARCA} Obra`, clienteNome: "x", clienteTel: "0", status: "em_andamento", dataInicio: new Date("2026-03-01T12:00:00Z") } });
    const comCliente = await novo("Com cliente", { clienteId: cli.id, valor: 1234.56 });
    const comObra = await novo("Com obra", { categoriaOperacional: "obras", vinculoOperacionalId: obra.id, vinculoOperacionalRotulo: `${MARCA} Obra` });
    const comChave = await novo("Com chave", { requestKey: `${MARCA}-rk` });
    const backupId = await excluir([comCliente.id, comObra.id, comChave.id]);

    // Depois da exclusão, os vínculos externos somem e a chave única é reutilizada.
    await prisma.bpoCliente.delete({ where: { id: cli.id } });
    await prisma.obra.delete({ where: { id: obra.id } });
    const reuso = await novo("Reuso da chave", { requestKey: `${MARCA}-rk` });

    const lista = await lote.listarExclusoesEmLote();
    if ("erro" in lista) throw new Error(lista.erro);
    expect(lista.find((b) => b.id === backupId)).toMatchObject({ aba: "cobrancas", quantidade: 3, usuario: expect.any(String), restauradoEm: null });

    const previa = await lote.previaRestauracaoExclusao(backupId);
    if ("erro" in previa) throw new Error(previa.erro);
    expect(previa).toMatchObject({ restaurar: 3, jaExistem: 0, comAviso: 3 });
    expect(previa.itens.find((i) => i.id === comCliente.id)?.avisos.join(" ")).toMatch(/cliente BPO .* não existe mais/);
    expect(previa.itens.find((i) => i.id === comObra.id)?.avisos.join(" ")).toMatch(/registro operacional .* não existe mais/);
    expect(previa.itens.find((i) => i.id === comChave.id)?.avisos.join(" ")).toMatch(/requestKey/);

    expect(await lote.restaurarExclusaoEmLote({ backupId, confirmacao: "restaurar" })).toEqual({ erro: expect.stringMatching(/RESTAURAR/) });
    const r = await lote.restaurarExclusaoEmLote({ backupId, confirmacao: "RESTAURAR" });
    if ("erro" in r) throw new Error(r.erro);
    expect(r).toMatchObject({ restaurados: 3, jaExistiam: 0, comAviso: 3 });
    expect(r.avisos).toHaveLength(3);

    const volta = await prisma.bpoLancamento.findMany({ where: { id: { in: [comCliente.id, comObra.id, comChave.id] } } });
    expect(volta).toHaveLength(3);
    const c = volta.find((l) => l.id === comCliente.id)!;
    expect(c).toMatchObject({ clienteId: null, clienteNomeLivre: `${MARCA} Cliente`, valor: 1234.56, version: comCliente.version + 1 });
    expect(c.vencimento.toISOString()).toBe("2026-10-10T12:00:00.000Z");
    expect(c.criadoEm.toISOString()).toBe(comCliente.criadoEm.toISOString());
    expect(volta.find((l) => l.id === comObra.id)).toMatchObject({ vinculoOperacionalId: null, vinculoOperacionalRotulo: null, categoriaOperacional: "obras" });
    expect(volta.find((l) => l.id === comChave.id)).toMatchObject({ requestKey: null });
    expect(await prisma.bpoLancamento.findUnique({ where: { id: reuso.id } })).toMatchObject({ requestKey: `${MARCA}-rk` });
    expect(await prisma.bpoLancamentoHistorico.count({ where: { lancamentoReferencia: { in: [comCliente.id, comObra.id, comChave.id] }, motivo: { contains: `Restaurado da exclusão em lote (backup ${backupId})` }, alteradoPorUsuarioId: "usuario-teste" } })).toBe(3);

    const backup = await prisma.bpoLancamentoExclusaoBackup.findUniqueOrThrow({ where: { id: backupId } });
    expect(backup.restauradoEm).toBeInstanceOf(Date);
    expect(backup.restauradoPorUsuarioId).toBe("usuario-teste");
    expect(JSON.parse(backup.restauracaoJson!)).toEqual({ restaurados: 3, jaExistiam: 0, comAviso: 3 });

    expect(await lote.restaurarExclusaoEmLote({ backupId, confirmacao: "RESTAURAR" })).toEqual({ erro: expect.stringMatching(/já foi restaurada/) });
    expect(await prisma.bpoLancamento.count({ where: { descricao: { startsWith: MARCA } } })).toBe(4);
  });

  it("não duplica lançamento que já existe com o mesmo ID; os demais voltam", async () => {
    const a = await novo("A"), b = await novo("B");
    const backupId = await excluir([a.id, b.id]);
    // Alguém recriou o A com o mesmo ID (ex.: restauração manual por SQL).
    await prisma.bpoLancamento.create({ data: { id: a.id, tipo: "recebimento", descricao: `${MARCA} A recriado`, valor: 1, vencimento: new Date(), competencia: "2026-10" } });
    const previa = await lote.previaRestauracaoExclusao(backupId);
    if ("erro" in previa) throw new Error(previa.erro);
    expect(previa).toMatchObject({ restaurar: 1, jaExistem: 1 });
    const r = await lote.restaurarExclusaoEmLote({ backupId, confirmacao: "RESTAURAR" });
    expect(r).toMatchObject({ restaurados: 1, jaExistiam: 1 });
    expect((await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: a.id } })).descricao).toBe(`${MARCA} A recriado`);
    expect(await prisma.bpoLancamento.count({ where: { id: b.id } })).toBe(1);
  });
});
