import "server-only";
// Estudos de massa salvos (Lote 2, correção 11 · AD-04) — persistência.
//
// Cada estudo salvo é uma linha própria (nome, versão, parâmetros, cenários,
// poligonal de referência, cenário escolhido, indicadores, quadro de áreas,
// autor, data, exclusão lógica). O estudo PRINCIPAL é espelhado nas colunas
// legadas do estudo (massaCenariosJson, cenarioEscolhidoId, mixJson) para
// Viabilidade/Orçamento/Relatório continuarem lendo de lá.
//
// `obterCenarioPrincipal(estudoId)` é a consulta do cenário principal (lotes e
// quadro de áreas) usada pelas ondas seguintes (unidades, viabilidade, orçamento).
import { prisma } from "@/lib/db";
import type { CenarioMassa, ParametrosMassa } from "@/lib/geo/massa";
import {
  cenarioEscolhido, cenarioPrincipalDe, indicadoresDoCenario, mixDoCenario, motivoBloqueioExclusao,
  proximaVersao, quadroAreasDoCenario, validarNomeEstudo, type CenarioPrincipal, type EstudoMassaSalvo,
} from "@/lib/incorporacao/estudos-massa";

type Linha = Awaited<ReturnType<typeof buscarLinha>>;

const LIMITE_JSON = 8 * 1024 * 1024;

function parse<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

async function buscarLinha(estudoId: string, id: string) {
  return prisma.estudoMassaSalvo.findFirst({
    where: { id, estudoId, excluidoEm: null },
    include: { criadoPor: { select: { nome: true } } },
  });
}

async function exigirLinha(estudoId: string, id: string) {
  const l = await buscarLinha(estudoId, id);
  if (!l) throw new Error("Estudo salvo não encontrado (pode ter sido excluído).");
  return l;
}

function paraEstudoSalvo(l: NonNullable<Linha>, completo: boolean): EstudoMassaSalvo {
  return {
    id: l.id,
    nome: l.nome,
    versao: l.versao,
    origemId: l.origemId,
    principal: l.principal,
    parametros: completo ? parse<ParametrosMassa>(l.parametrosJson) : null,
    cenarios: completo ? parse<CenarioMassa[]>(l.cenariosJson) ?? [] : [],
    poligonalReferencia: completo ? l.poligonalReferencia : null,
    cenarioEscolhidoId: l.cenarioEscolhidoId,
    indicadores: parse(l.indicadoresJson),
    quadroAreas: parse(l.quadroAreasJson),
    autorNome: l.criadoPor?.nome ?? null,
    criadoEm: l.criadoEm.toISOString(),
    atualizadoEm: l.atualizadoEm.toISOString(),
  };
}

async function exigirEstudo(estudoId: string) {
  const e = await prisma.estudoIncorporacao.findUnique({
    where: { id: estudoId },
    select: {
      id: true, geojson: true, areaM2: true, massaCenariosJson: true, cenarioEscolhidoId: true,
      semKml: true, lotesAvulsosJson: true, orcamentoParametrizadoJson: true, loteamentoJson: true, viabilidadeJson: true,
    },
  });
  if (!e) throw new Error("Estudo não encontrado.");
  return e;
}

/** Estudos anteriores à tabela: o conteúdo das colunas legadas vira o 1º estudo salvo (principal). */
async function importarLegado(e: Awaited<ReturnType<typeof exigirEstudo>>) {
  const legado = parse<{ params?: unknown; cenarios?: unknown }>(e.massaCenariosJson);
  if (!legado || !Array.isArray(legado.cenarios) || legado.cenarios.length === 0) return;
  const cenarios = legado.cenarios as CenarioMassa[];
  const params = (legado.params ?? null) as ParametrosMassa | null;
  const c = cenarioEscolhido(cenarios, e.cenarioEscolhidoId);
  await prisma.$transaction(async (tx) => {
    // trava a linha do estudo: chamadas concorrentes não duplicam a importação
    await tx.$queryRaw`SELECT id FROM estudos_incorporacao WHERE id = ${e.id} FOR UPDATE`;
    if (await tx.estudoMassaSalvo.count({ where: { estudoId: e.id } })) return;
    await tx.estudoMassaSalvo.create({
      data: {
        estudoId: e.id, nome: "Estudo anterior (importado)", versao: 1,
        parametrosJson: params ? JSON.stringify(params) : null, cenariosJson: JSON.stringify(cenarios),
        poligonalReferencia: e.geojson, cenarioEscolhidoId: c?.id ?? null,
        indicadoresJson: JSON.stringify(indicadoresDoCenario(c)),
        quadroAreasJson: c ? JSON.stringify(quadroAreasDoCenario(c, params, e.areaM2 || 0)) : null,
        principal: true,
      },
    });
  });
}

export async function listarEstudosMassaDb(estudoId: string): Promise<EstudoMassaSalvo[]> {
  await importarLegado(await exigirEstudo(estudoId));
  const linhas = await prisma.estudoMassaSalvo.findMany({
    where: { estudoId, excluidoEm: null },
    include: { criadoPor: { select: { nome: true } } },
    orderBy: [{ nome: "asc" }, { versao: "asc" }],
  });
  return linhas.map((l) => paraEstudoSalvo(l, false));
}

export async function obterEstudoMassaDb(estudoId: string, id: string): Promise<EstudoMassaSalvo> {
  return paraEstudoSalvo(await exigirLinha(estudoId, id), true);
}

/** Marca o principal e espelha nas colunas legadas — numa transação. */
export async function marcarPrincipalDb(estudoId: string, id: string) {
  const l = await exigirLinha(estudoId, id);
  const cenarios = parse<CenarioMassa[]>(l.cenariosJson) ?? [];
  const params = parse<ParametrosMassa>(l.parametrosJson);
  const c = cenarioEscolhido(cenarios, l.cenarioEscolhidoId);
  await prisma.$transaction(async (tx) => {
    const alvo = await tx.estudoMassaSalvo.updateMany({ where: { id, estudoId, excluidoEm: null }, data: { principal: true } });
    if (alvo.count === 0) throw new Error("O estudo salvo foi excluído por outra operação. Atualize a lista.");
    await tx.estudoMassaSalvo.updateMany({ where: { estudoId, principal: true, NOT: { id } }, data: { principal: false } });
    await tx.estudoIncorporacao.update({
      where: { id: estudoId },
      data: {
        massaCenariosJson: JSON.stringify({ params, cenarios }),
        cenarioEscolhidoId: c?.id ?? null,
        ...(c && params ? { mixJson: JSON.stringify(mixDoCenario(c, params.precoM2Lote)) } : {}),
      },
    });
  });
}

export interface EntradaSalvarEstudoMassa {
  modo: "novo" | "nova_versao" | "atualizar";
  id?: string | null;
  nome: string;
  parametrosJson: string | null;
  cenariosJson: string;
  cenarioEscolhidoId: string | null;
  principal?: boolean;
}

function erroVersao(e: unknown): never {
  if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
    throw new Error("Já existe um estudo salvo com este nome e versão. Atualize a lista e tente de novo.");
  }
  const msg = e instanceof Error ? e.message : "";
  if (/estudos_massa_salvos_nome_versao_ativos_key|unique constraint/i.test(msg)) {
    throw new Error("Já existe um estudo salvo com este nome e versão. Atualize a lista e tente de novo.");
  }
  throw e;
}

export async function salvarEstudoMassaDb(estudoId: string, d: EntradaSalvarEstudoMassa, usuarioId: string): Promise<EstudoMassaSalvo> {
  const erroNome = validarNomeEstudo(d.nome);
  if (erroNome) throw new Error(erroNome);
  if (d.cenariosJson.length > LIMITE_JSON || (d.parametrosJson?.length ?? 0) > LIMITE_JSON) throw new Error("Estudo grande demais para salvar.");
  const e = await exigirEstudo(estudoId);
  const cenarios = parse<CenarioMassa[]>(d.cenariosJson);
  if (!Array.isArray(cenarios) || cenarios.length === 0) throw new Error("Gere ao menos um cenário antes de salvar.");
  const params = parse<ParametrosMassa>(d.parametrosJson);
  const c = cenarioEscolhido(cenarios, d.cenarioEscolhidoId)!;
  const derivados = {
    parametrosJson: d.parametrosJson,
    cenariosJson: d.cenariosJson,
    poligonalReferencia: e.geojson,
    cenarioEscolhidoId: c.id,
    indicadoresJson: JSON.stringify(indicadoresDoCenario(c)),
    quadroAreasJson: JSON.stringify(quadroAreasDoCenario(c, params, e.areaM2 || 0)),
  };
  const nome = d.nome.trim();
  let id: string;
  let principal = !!d.principal;
  try {
    if (d.modo === "atualizar") {
      if (!d.id) throw new Error("Estudo salvo não informado.");
      const atual = await exigirLinha(estudoId, d.id);
      principal = principal || atual.principal;
      await prisma.estudoMassaSalvo.update({ where: { id: atual.id }, data: { nome, ...derivados } });
      id = atual.id;
    } else {
      const todas = await prisma.estudoMassaSalvo.findMany({ where: { estudoId }, select: { nome: true, versao: true, principal: true, excluidoEm: true } });
      const origemId = d.modo === "nova_versao" ? (d.id ? (await exigirLinha(estudoId, d.id)).id : null) : null;
      if (d.modo === "nova_versao" && !origemId) throw new Error("Estudo de origem não informado.");
      // o primeiro estudo salvo vira principal automaticamente
      if (!todas.some((t) => t.principal && !t.excluidoEm)) principal = true;
      const nova = await prisma.estudoMassaSalvo.create({
        data: { estudoId, nome, versao: proximaVersao(todas, nome), origemId, criadoPorId: usuarioId, ...derivados },
      });
      id = nova.id;
    }
  } catch (err) { erroVersao(err); }
  if (principal) await marcarPrincipalDb(estudoId, id);
  return paraEstudoSalvo(await exigirLinha(estudoId, id), false);
}

export async function excluirEstudoMassaDb(estudoId: string, id: string, usuarioId: string) {
  const alvo = await exigirLinha(estudoId, id);
  const e = await exigirEstudo(estudoId);
  if (alvo.principal) {
    const unidades = await prisma.estudoUnidade.count({ where: { estudoId } });
    const motivo = motivoBloqueioExclusao(true, {
      unidades,
      orcamento: !!e.orcamentoParametrizadoJson?.trim(),
      viabilidade: !!e.loteamentoJson?.trim() || !!e.viabilidadeJson?.trim(),
    });
    if (motivo) throw new Error(motivo);
  }
  // Exclusão lógica; se era o principal (sem dependentes), o espelho legado é limpo
  // na mesma transação — os demais estudos salvos e a geometria do terreno ficam.
  await prisma.$transaction(async (tx) => {
    const r = await tx.estudoMassaSalvo.updateMany({
      where: { id, estudoId, excluidoEm: null },
      data: { excluidoEm: new Date(), excluidoPorId: usuarioId, principal: false },
    });
    if (r.count === 0) throw new Error("O estudo já havia sido excluído.");
    if (alvo.principal) {
      await tx.estudoIncorporacao.update({ where: { id: estudoId }, data: { massaCenariosJson: null, cenarioEscolhidoId: null } });
    }
  });
}

/** Cenário principal do estudo (lotes + quadro de áreas) — base das ondas 12, 15 e 20. */
export async function obterCenarioPrincipal(estudoId: string): Promise<CenarioPrincipal | null> {
  const e = await exigirEstudo(estudoId);
  const p = await prisma.estudoMassaSalvo.findFirst({
    where: { estudoId, principal: true, excluidoEm: null },
    select: { id: true, nome: true, versao: true, parametrosJson: true, cenariosJson: true, cenarioEscolhidoId: true },
  });
  return cenarioPrincipalDe({
    principal: p ? { id: p.id, nome: p.nome, versao: p.versao, parametrosJson: p.parametrosJson, cenariosJson: p.cenariosJson, cenarioEscolhidoId: p.cenarioEscolhidoId } : null,
    massaCenariosJson: e.massaCenariosJson,
    cenarioEscolhidoId: e.cenarioEscolhidoId,
    semKml: e.semKml,
    lotesAvulsosJson: e.lotesAvulsosJson,
    areaBrutaM2: e.areaM2 || 0,
  });
}
