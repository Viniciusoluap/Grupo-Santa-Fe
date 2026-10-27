// Lote 2, correção 07 (AD-07): Projeto Aprovado ↔ Projetos (banco real; mesmos cenários do Prospecta).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("correção 07 — sincronização com o banco", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let sync: typeof import("@/lib/projeto-incorporacao-sync");
  let ler: typeof import("@/lib/incorporacao/projeto-sincronizacao").lerProcessosAprovacao;
  let estudoId = "";
  let engId = "";
  let corretorId = "";
  const json = (processos: unknown[]) => JSON.stringify({ processos });
  const projetos = () => prisma.projeto.findMany({ where: { estudoIncorporacaoId: estudoId }, orderBy: { criadoEm: "asc" } });
  const processos = async () => ler((await prisma.estudoIncorporacao.findUniqueOrThrow({ where: { id: estudoId } })).aprovacaoProjetoJson);

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    sync = await import("@/lib/projeto-incorporacao-sync");
    ({ lerProcessosAprovacao: ler } = await import("@/lib/incorporacao/projeto-sincronizacao"));
    const sufixo = Date.now();
    engId = (await prisma.usuario.create({ data: { nome: "Eng. Carla", email: `eng-07-${sufixo}@teste.local`, senha: "x", papel: "colaborador" } })).id;
    corretorId = (await prisma.usuario.create({ data: { nome: "Corretor", email: `cor-07-${sufixo}@teste.local`, senha: "x", papel: "corretor" } })).id;
  });
  beforeEach(async () => {
    if (estudoId) {
      await prisma.projeto.deleteMany({ where: { estudoIncorporacaoId: estudoId } });
      await prisma.estudoIncorporacao.delete({ where: { id: estudoId } });
    }
    estudoId = (await prisma.estudoIncorporacao.create({ data: { nome: "Residencial Teste 07", municipio: "Imperatriz" } })).id;
  });
  afterAll(async () => {
    await prisma.projeto.deleteMany({ where: { estudoIncorporacaoId: estudoId } });
    await prisma.estudoIncorporacao.deleteMany({ where: { id: estudoId } });
    await prisma.usuario.deleteMany({ where: { id: { in: [engId, corretorId] } } });
    await prisma.$disconnect();
  });

  it("salvar cria um projeto por processo (sem lead), e salvar/reabrir de novo não duplica", async () => {
    const lista = [
      { id: "p1", orgao: "Prefeitura (projeto arquitetônico)", status: "protocolado", numeroProtocolo: "PM-1", prazoPrevisto: "2026-12-10", observacoes: "Obs", engenheiroId: engId, engenheiroRegistro: "CREA-MA 123" },
      { id: "p2", orgao: "Corpo de Bombeiros", status: "nao_protocolado" },
    ];
    const r = await sync.salvarAprovacaoProjetoSincronizado(estudoId, json(lista));
    expect(r.vinculos).toHaveLength(2);
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json(lista));
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json(lista));
    const rows = await projetos();
    expect(rows).toHaveLength(2);
    const p1 = rows.find((p) => p.processoAprovacaoId === "p1")!;
    expect(p1).toMatchObject({
      nome: "Prefeitura (projeto arquitetônico) — Residencial Teste 07", status: "solicitado", clienteNome: "Residencial Teste 07", leadId: null,
      engenheiro: "Eng. Carla", engenheiroId: engId, engenheiroRegistro: "CREA-MA 123",
      aprovacaoOrgao: "Prefeitura (projeto arquitetônico)", aprovacaoProtocolo: "PM-1", aprovacaoStatus: "protocolado", aprovacaoObservacoes: "Obs",
      tipo: JSON.stringify(["projeto_arquitetonico"]),
    });
    expect(p1.prazoEntrega?.toISOString().slice(0, 10)).toBe("2026-12-10");
    expect(JSON.parse(p1.checklist)).toEqual([{ id: "projeto_arquitetonico", type: "projeto_arquitetonico", texto: "Projeto Arquitetônico", feito: false }]);
    expect(rows.find((p) => p.processoAprovacaoId === "p2")).toMatchObject({ tipo: null, engenheiro: null, engenheiroId: null });
    expect((await processos())[0].engenheiro).toBe("Eng. Carla");
    // O índice único barra duplicata mesmo fora do fluxo.
    await expect(prisma.projeto.create({ data: { nome: "x", clienteNome: "x", clienteTel: "", estudoIncorporacaoId: estudoId, processoAprovacaoId: "p1" } })).rejects.toThrow();
  });

  it("recusa engenheiro que não é colaborador/admin ativo", async () => {
    await expect(sync.salvarAprovacaoProjetoSincronizado(estudoId, json([{ id: "p1", orgao: "Outro", status: "protocolado", engenheiroId: corretorId }]))).rejects.toThrow(/colaborador ativo/);
    expect(await projetos()).toHaveLength(0);
  });

  it("edição na Incorporação atualiza o projeto e aplica o mapeamento externo → interno", async () => {
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json([{ id: "p1", orgao: "Outro", status: "em_analise" }]));
    await prisma.projeto.updateMany({ where: { estudoIncorporacaoId: estudoId }, data: { status: "em_elaboracao" } });
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json([{ id: "p1", orgao: "Corpo de Bombeiros", status: "exigencia", numeroProtocolo: "CB-9" }]));
    let [p] = await projetos();
    expect(p).toMatchObject({ status: "revisao", aprovacaoStatus: "exigencia", aprovacaoProtocolo: "CB-9", aprovacaoOrgao: "Corpo de Bombeiros", nome: "Corpo de Bombeiros — Residencial Teste 07" });
    await prisma.projeto.updateMany({ where: { estudoIncorporacaoId: estudoId }, data: { nome: "Nome manual", status: "entregue" } });
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json([{ id: "p1", orgao: "Corpo de Bombeiros", status: "aprovado" }]));
    [p] = await projetos();
    expect(p).toMatchObject({ nome: "Nome manual", status: "entregue", aprovacaoStatus: "aprovado", aprovacaoProtocolo: null });
  });

  it("edição em Projetos volta ao processo (órgão, protocolo, prazo, situação, observações, engenheiro)", async () => {
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, JSON.stringify({ extra: 1, processos: [{ id: "p1", orgao: "Outro", status: "protocolado", dataProtocolo: "2026-01-05" }, { id: "p2", orgao: "Outro", status: "aprovado" }] }));
    const p = (await projetos()).find((x) => x.processoAprovacaoId === "p1")!;
    // Mesmo que editarProjeto grava: dados do formulário + reflexo no estudo.
    await prisma.projeto.update({ where: { id: p.id }, data: {
      status: "em_elaboracao", engenheiroId: engId, engenheiro: "Eng. Carla", engenheiroRegistro: "CREA-MA 9", prazoEntrega: new Date("2027-02-03T12:00:00Z"),
      aprovacaoOrgao: "Órgão Ambiental", aprovacaoProtocolo: "AMB-7", aprovacaoStatus: "em_analise", aprovacaoObservacoes: "Aguardando vistoria",
    } });
    await sync.refletirProjetoNoEstudo(p.id);
    const lista = await processos();
    expect(lista[0]).toEqual({ id: "p1", orgao: "Órgão Ambiental", status: "em_analise", dataProtocolo: "2026-01-05", numeroProtocolo: "AMB-7", prazoPrevisto: "2027-02-03", observacoes: "Aguardando vistoria", engenheiroId: engId, engenheiro: "Eng. Carla", engenheiroRegistro: "CREA-MA 9" });
    expect(lista[1]).toMatchObject({ id: "p2", status: "aprovado" });
    expect(JSON.parse((await prisma.estudoIncorporacao.findUniqueOrThrow({ where: { id: estudoId } })).aprovacaoProjetoJson!).extra).toBe(1);
    expect(await prisma.projeto.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ status: "em_elaboracao", aprovacaoStatus: "em_analise" });
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json(lista));
    expect(await projetos()).toHaveLength(2);
  });

  it("processo excluído na Incorporação → projeto desvinculado e cancelado, com documentos preservados", async () => {
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json([{ id: "p1", orgao: "Outro", status: "protocolado", observacoes: "Obs" }, { id: "p2", orgao: "Outro", status: "aprovado" }]));
    const arquivos = '[{"nome":"planta.pdf","url":"https://x/y"}]';
    await prisma.projeto.updateMany({ where: { estudoIncorporacaoId: estudoId, processoAprovacaoId: "p1" }, data: { arquivos } });
    const r = await sync.salvarAprovacaoProjetoSincronizado(estudoId, json([{ id: "p2", orgao: "Outro", status: "aprovado" }]));
    expect(r.vinculos.map((v) => v.processoId)).toEqual(["p2"]);
    const rows = await projetos();
    expect(rows).toHaveLength(2);
    const p1 = rows.find((p) => p.processoAprovacaoId === null)!;
    expect(p1).toMatchObject({ status: "cancelado", arquivos, estudoIncorporacaoId: estudoId });
    expect(p1.aprovacaoObservacoes).toMatch(/^Obs\nProcesso de aprovação excluído na Incorporação em/);
  });

  it("projeto excluído em Projetos → processo sai do Projeto Aprovado e não renasce", async () => {
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json([{ id: "p1", orgao: "Outro", status: "protocolado" }, { id: "p2", orgao: "Outro", status: "aprovado" }]));
    const p = (await projetos()).find((x) => x.processoAprovacaoId === "p1")!;
    const vinculo = await sync.vinculoDoProjeto(p.id);
    expect(vinculo).toEqual({ estudoIncorporacaoId: estudoId, processoAprovacaoId: "p1" });
    await prisma.projeto.delete({ where: { id: p.id } });
    await sync.removerProcessoDoEstudo(vinculo!);
    const lista = await processos();
    expect(lista.map((x) => x.id)).toEqual(["p2"]);
    await sync.salvarAprovacaoProjetoSincronizado(estudoId, json(lista));
    expect(await projetos()).toHaveLength(1);
    await sync.refletirProjetoNoEstudo("inexistente");
    await sync.removerProcessoDoEstudo({ estudoIncorporacaoId: null, processoAprovacaoId: null });
  });
});
