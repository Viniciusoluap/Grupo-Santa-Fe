// Pedido de 18/10 — ciclo da medição (solicitar, confirmar recebimento), valor
// estimado (opção B), edição, exclusão e filtro da lista, com banco real.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/lib/obras/acesso-empreiteiro", () => ({ exigirObraOuEmpreiteiro: async () => sessao.usuarioId }));
// O ciclo testa a transação sem enviar solicitações fictícias ao e-mail real.
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true), adminNotificationTemplate: () => ({ subject: "Teste", html: "<p>Teste</p>" }) }));
vi.mock("@/lib/obras/medicao-gerar", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/obras/medicao-gerar")>(),
  gerarArquivoMedicao: vi.fn(async (_id: string, formato: string) => ({ ok: true, bytes: new Uint8Array([1]), nome: `teste.${formato}`, mime: "application/octet-stream" })),
}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("medições (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let acoes: typeof import("@/lib/actions/obra-progresso");
  let dados: typeof import("@/lib/obras/progresso-dados");
  let lista: typeof import("@/lib/obras/lista-dados");
  let SERVICOS: typeof import("@/lib/financeiro/progresso").SERVICOS_PROGRESSO;
  let obraId = "";
  const itens = (execucoes: Record<string, string>) => SERVICOS.map((s) => ({ chave: s.chave, incidencia: s.incidenciaPadrao, execucao: execucoes[s.chave] ?? "0" }));

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    acoes = await import("@/lib/actions/obra-progresso");
    dados = await import("@/lib/obras/progresso-dados");
    lista = await import("@/lib/obras/lista-dados");
    ({ SERVICOS_PROGRESSO: SERVICOS } = await import("@/lib/financeiro/progresso"));
    sessao.usuarioId = (await prisma.usuario.findFirstOrThrow({ where: { papel: "admin" }, select: { id: true } })).id;
    obraId = (await prisma.obra.create({
      data: { nome: "Obra Medições", clienteNome: "C", clienteTel: "1", financiamentoCef: "200000", fgts: "30000", subsidio: "20000", custoTerreno: "50000" },
    })).id;
  });
  afterAll(async () => {
    await prisma.obra.delete({ where: { id: obraId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("valor estimado = Y × avanço da medição (Y = financiado + FGTS + subsídio − terreno)", async () => {
    expect((await acoes.salvarProgressoObra(obraId, itens({ preliminares: "100" }))).ok).toBe(true); // 3,10%
    expect((await acoes.salvarProgressoObra(obraId, itens({ preliminares: "100", infraestrutura: "100" }))).ok).toBe(true); // 10,10%
    const p = (await dados.carregarProgressoObra(obraId))!;
    expect(p.baseMedicao).toEqual({ ok: true, centavos: 20_000_000 });
    const [segunda, primeira] = p.historico;
    expect(primeira.estimativa).toMatchObject({ valorCentavos: 620_000 }); // 3,10% de R$ 200.000
    expect(segunda.estimativa).toMatchObject({ valorCentavos: 1_400_000 }); // +7,00%
  });

  it("solicitar → confirmar recebimento; confirmar antes de solicitar é recusado", async () => {
    const [ultima] = (await dados.carregarProgressoObra(obraId))!.historico;
    expect(await acoes.confirmarRecebimentoMedicao(ultima.id)).toMatchObject({ ok: false });
    expect((await acoes.solicitarMedicao(ultima.id)).ok).toBe(true);
    expect(await acoes.solicitarMedicao(ultima.id)).toMatchObject({ ok: false });
    let obras = await lista.carregarListaObras({ id: obraId });
    expect(obras[0]).toMatchObject({ medicoesSolicitadas: 1, medicoesRecebidas: 0 });
    expect((await acoes.confirmarRecebimentoMedicao(ultima.id)).ok).toBe(true);
    obras = await lista.carregarListaObras({ id: obraId });
    expect(obras[0]).toMatchObject({ medicoesSolicitadas: 0, medicoesRecebidas: 1 });
    expect((await dados.carregarProgressoObra(obraId))!.historico[0].situacao).toBe("recebida");
  });

  it("editar a medição vigente corrige o histórico e o progresso da obra", async () => {
    const [ultima] = (await dados.carregarProgressoObra(obraId))!.historico;
    expect((await acoes.editarMedicao(ultima.id, itens({ preliminares: "100", infraestrutura: "50" }))).ok).toBe(true);
    const p = (await dados.carregarProgressoObra(obraId))!;
    expect(p.historico[0].progresso).toBeCloseTo(6.6, 4);
    expect(p.historico[0].editadaEm).not.toBeNull();
    expect(Number((await prisma.obra.findUniqueOrThrow({ where: { id: obraId } })).progressoMedido)).toBeCloseTo(6.6, 4);
  });

  it("excluir a medição vigente volta a obra para a anterior", async () => {
    const [ultima] = (await dados.carregarProgressoObra(obraId))!.historico;
    expect((await acoes.excluirMedicao(ultima.id)).ok).toBe(true);
    const p = (await dados.carregarProgressoObra(obraId))!;
    expect(p.historico).toHaveLength(1);
    expect(Number((await prisma.obra.findUniqueOrThrow({ where: { id: obraId } })).progressoMedido)).toBeCloseTo(3.1, 4);
    expect((await acoes.excluirMedicao(p.historico[0].id)).ok).toBe(true);
    const obra = await prisma.obra.findUniqueOrThrow({ where: { id: obraId } });
    expect(obra.progressoMedido).toBeNull();
    expect(await prisma.obraProgressoItem.count({ where: { obraId } })).toBe(0);
  });

  it("sem os quatro valores o estimado fica indisponível", async () => {
    await prisma.obra.update({ where: { id: obraId }, data: { fgts: null } });
    expect((await dados.carregarProgressoObra(obraId))!.baseMedicao).toEqual({ ok: false, motivo: "Dados incompletos: FGTS" });
  });
});
