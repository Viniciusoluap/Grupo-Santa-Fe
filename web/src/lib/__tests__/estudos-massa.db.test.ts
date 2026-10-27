// Lote 2, correções 06 e 11 (AD-03, AD-04): estudos de massa salvos e cenário principal (banco real).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Position } from "geojson";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("estudos de massa salvos — banco", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let db: typeof import("@/lib/incorporacao/estudos-massa-db");
  let massa: typeof import("@/lib/geo/massa");
  let estudoId = "";
  let usuarioId = "";
  let cenariosJson = "";
  let params: import("@/lib/geo/massa").ParametrosMassa;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    db = await import("@/lib/incorporacao/estudos-massa-db");
    massa = await import("@/lib/geo/massa");
    usuarioId = (await prisma.usuario.create({ data: { nome: "Autor Massa", email: `massa-${Date.now()}@teste.local`, senha: "x", papel: "colaborador" } })).id;
    const centro: [number, number] = [-49.879, -6.5];
    const proj = massa.criarProjecao(centro);
    const anel: Position[] = [[-200, -125], [200, -125], [200, 125], [-200, 125], [-200, -125]].map((p) => proj.paraGeo(p));
    params = { larguraViaM: 12, testadaLoteM: 10, profundidadeLoteM: 25, loteMinimoM2: 250, comprimentoMaxQuadraM: 120, percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500 };
    cenariosJson = JSON.stringify(massa.gerarCenariosMassa(anel, centro, params, { populacao: 6, geracoes: 3, seed: 5, nCenarios: 2 }));
  });
  beforeEach(async () => {
    if (estudoId) await prisma.estudoIncorporacao.delete({ where: { id: estudoId } });
    estudoId = (await prisma.estudoIncorporacao.create({ data: { nome: "Loteamento Teste 11", municipio: "Canaã dos Carajás", areaM2: 100_000, geojson: "{}" } })).id;
  });
  afterAll(async () => {
    if (estudoId) await prisma.estudoIncorporacao.deleteMany({ where: { id: estudoId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  const salvar = (modo: "novo" | "nova_versao" | "atualizar", nome: string, extra: { id?: string; principal?: boolean; escolhido?: string | null } = {}) =>
    db.salvarEstudoMassaDb(estudoId, { modo, id: extra.id, nome, parametrosJson: JSON.stringify(params), cenariosJson, cenarioEscolhidoId: extra.escolhido ?? null, principal: extra.principal }, usuarioId);

  it("primeiro estudo vira principal e espelha massa, cenário escolhido e mix nas colunas legadas", async () => {
    const cenarios = JSON.parse(cenariosJson);
    const r = await salvar("novo", "Estudo base", { escolhido: cenarios[1].id });
    expect(r).toMatchObject({ nome: "Estudo base", versao: 1, principal: true, autorNome: "Autor Massa" });
    const e = await prisma.estudoIncorporacao.findUniqueOrThrow({ where: { id: estudoId } });
    expect(e.cenarioEscolhidoId).toBe(cenarios[1].id);
    expect(JSON.parse(e.massaCenariosJson!).cenarios).toHaveLength(2);
    expect(JSON.parse(e.mixJson!)[0].quantidade).toBe(cenarios[1].kpis.lotesVendaveis);
    expect(r.indicadores?.lotesVendaveis).toBe(cenarios[1].kpis.lotesVendaveis);
    expect(r.quadroAreas?.nLotes).toBe(cenarios[1].kpis.lotesVendaveis);
  });

  it("nova versão incrementa, mantém origem; marcar principal troca só um; atualizar edita no lugar", async () => {
    const v1 = await salvar("novo", "Base");
    const v2 = await salvar("nova_versao", "Base", { id: v1.id });
    expect(v2).toMatchObject({ versao: 2, origemId: v1.id, principal: false });
    const outro = await salvar("novo", "Alternativo");
    expect(outro.versao).toBe(1);
    await db.marcarPrincipalDb(estudoId, v2.id);
    const lista = await db.listarEstudosMassaDb(estudoId);
    expect(lista.filter((s) => s.principal).map((s) => s.id)).toEqual([v2.id]);
    const editado = await salvar("atualizar", "Base revisado", { id: v2.id });
    expect(editado).toMatchObject({ id: v2.id, nome: "Base revisado", versao: 2, principal: true });
    const completo = await db.obterEstudoMassaDb(estudoId, v2.id);
    expect(completo.cenarios).toHaveLength(2);
    expect(completo.poligonalReferencia).toBe("{}");
  });

  it("exclusão lógica: preserva os demais; principal com dependentes é bloqueado", async () => {
    const a = await salvar("novo", "A");
    const b = await salvar("novo", "B");
    await db.excluirEstudoMassaDb(estudoId, b.id, usuarioId);
    const linhaB = await prisma.estudoMassaSalvo.findUniqueOrThrow({ where: { id: b.id } });
    expect(linhaB.excluidoEm).not.toBeNull();
    expect((await db.listarEstudosMassaDb(estudoId)).map((s) => s.id)).toEqual([a.id]);
    await prisma.estudoIncorporacao.update({ where: { id: estudoId }, data: { orcamentoParametrizadoJson: "{\"itens\":[]}" } });
    await expect(db.excluirEstudoMassaDb(estudoId, a.id, usuarioId)).rejects.toThrow(/estudo principal.*orçamento/);
    await prisma.estudoIncorporacao.update({ where: { id: estudoId }, data: { orcamentoParametrizadoJson: null } });
    await db.excluirEstudoMassaDb(estudoId, a.id, usuarioId);
    const e = await prisma.estudoIncorporacao.findUniqueOrThrow({ where: { id: estudoId } });
    expect(e.massaCenariosJson).toBeNull();
    await expect(db.excluirEstudoMassaDb(estudoId, a.id, usuarioId)).rejects.toThrow(/não encontrado/);
  });

  it("importa as colunas legadas como estudo principal uma única vez", async () => {
    await prisma.estudoIncorporacao.update({ where: { id: estudoId }, data: { massaCenariosJson: JSON.stringify({ params, cenarios: JSON.parse(cenariosJson) }) } });
    const [l1, l2] = await Promise.all([db.listarEstudosMassaDb(estudoId), db.listarEstudosMassaDb(estudoId)]);
    expect(l1.length + l2.length).toBe(2);
    expect(await prisma.estudoMassaSalvo.count({ where: { estudoId } })).toBe(1);
    expect(l1[0]).toMatchObject({ nome: "Estudo anterior (importado)", principal: true });
  });

  it("cenário principal: estudo salvo; sem KML usa os lotes avulsos", async () => {
    expect(await db.obterCenarioPrincipal(estudoId)).toBeNull();
    await prisma.estudoIncorporacao.update({
      where: { id: estudoId },
      data: { semKml: true, lotesAvulsosJson: JSON.stringify([{ id: "1", quadra: "A", lote: "1", areaM2: 300, testadaM: 12, profundidadeM: 25 }]) },
    });
    expect(await db.obterCenarioPrincipal(estudoId)).toMatchObject({ origem: "lotes_avulsos", lotes: [{ quadra: "A", lote: "1", areaM2: 300 }] });
    const s = await salvar("novo", "Principal");
    const p = await db.obterCenarioPrincipal(estudoId);
    expect(p).toMatchObject({ origem: "estudo_salvo", estudoSalvoId: s.id });
    expect(p?.lotes.length).toBe(p?.quadroAreas?.nLotes);
  });
});
