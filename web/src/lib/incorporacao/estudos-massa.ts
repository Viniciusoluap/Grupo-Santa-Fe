// Estudos de massa salvos (correção 11 do Lote 02 · AD-04) — regras puras,
// idênticas nos dois sistemas.
//
// Cada estudo salvo guarda nome, versão, parâmetros, cenários (lotes/planta),
// poligonal de referência, cenário escolhido, indicadores e quadro de áreas.
// O estudo PRINCIPAL é espelhado nas colunas legadas do estudo de incorporação
// (cenários + cenário escolhido + mix) para Viabilidade/Orçamento/Relatório.
//
// `cenarioPrincipalDe` é a consulta única do "cenário principal do estudo"
// usada pelas ondas seguintes (unidades 15, viabilidade 20, orçamento 12).

import type { CenarioMassa, LoteGerado, ParametrosMassa, TipologiaMassa } from "@/lib/geo/massa";
import { restricoesDosParametros } from "@/lib/geo/massa";
import { calcularQuadroAreasMassa, RESTRICOES_VAZIAS, type QuadroAreasMassa } from "@/lib/incorporacao/massa-quadro-areas";
import { parseLotesAvulsos } from "@/lib/incorporacao/lotes-avulsos";

export interface IndicadoresEstudoMassa {
  cenarioId: string | null;
  tipologia: TipologiaMassa;
  lotesVendaveis: number;
  areaVendavelM2: number;
  aproveitamento: number;
  vgv: number;
}

export interface EstudoMassaSalvo {
  id: string;
  nome: string;
  versao: number;
  origemId: string | null;
  principal: boolean;
  parametros: ParametrosMassa | null;
  cenarios: CenarioMassa[];
  poligonalReferencia: string | null;
  cenarioEscolhidoId: string | null;
  indicadores: IndicadoresEstudoMassa | null;
  quadroAreas: QuadroAreasMassa | null;
  autorNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export const NOME_ESTUDO_MAX = 120;

function parse<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

/** Cenário escolhido (ou o primeiro, como no relatório executivo). */
export function cenarioEscolhido(cenarios: CenarioMassa[], id: string | null | undefined): CenarioMassa | undefined {
  return cenarios.find((c) => c.id === id) ?? cenarios[0];
}

export function indicadoresDoCenario(c: CenarioMassa | undefined): IndicadoresEstudoMassa | null {
  if (!c) return null;
  return {
    cenarioId: c.id,
    tipologia: c.tipologia ?? "grid",
    lotesVendaveis: c.kpis.lotesVendaveis,
    areaVendavelM2: c.kpis.areaVendavelM2,
    aproveitamento: c.kpis.aproveitamento,
    vgv: c.kpis.vgv,
  };
}

/** Mix de produtos derivado do cenário (mesmo formato do botão "Usar na Viabilidade"). */
export function mixDoCenario(c: CenarioMassa, precoM2Lote: number) {
  const areaMedia = c.kpis.lotesVendaveis > 0 ? Math.round(c.kpis.areaVendavelM2 / c.kpis.lotesVendaveis) : 0;
  return [{
    nome: `Lote ${areaMedia}m² (massa ${c.id})`,
    quantidade: c.kpis.lotesVendaveis,
    areaUnidadeM2: areaMedia,
    precoM2: precoM2Lote,
  }];
}

/** Próxima versão para um nome (1 quando o nome é novo). */
export function proximaVersao(existentes: { nome: string; versao: number }[], nome: string): number {
  const chave = nome.trim().toLowerCase();
  const versoes = existentes.filter((e) => e.nome.trim().toLowerCase() === chave).map((e) => e.versao);
  return versoes.length ? Math.max(...versoes) + 1 : 1;
}

export function validarNomeEstudo(nome: string): string | null {
  const n = nome.trim();
  if (!n) return "Informe o nome do estudo.";
  if (n.length > NOME_ESTUDO_MAX) return `Nome com no máximo ${NOME_ESTUDO_MAX} caracteres.`;
  return null;
}

export interface DependentesEstudoPrincipal {
  unidades: number;
  orcamento: boolean;
  viabilidade: boolean;
}

/**
 * Exclusão lógica: só bloqueia quando o estudo é o PRINCIPAL e já há unidades,
 * orçamento ou viabilidade que dependem dele. Os demais estudos são livres.
 */
export function motivoBloqueioExclusao(principal: boolean, d: DependentesEstudoPrincipal): string | null {
  if (!principal) return null;
  const itens: string[] = [];
  if (d.unidades > 0) itens.push(`${d.unidades} unidade(s) à venda`);
  if (d.orcamento) itens.push("orçamento parametrizado");
  if (d.viabilidade) itens.push("estudo de viabilidade");
  if (itens.length === 0) return null;
  return `Este é o estudo principal e há ${itens.join(", ")} que dependem dele. Marque outro estudo como principal antes de excluir.`;
}

// ─── Cenário principal do estudo (consulta para as ondas seguintes) ─────────

export interface LoteCenarioPrincipal {
  quadra: string;
  lote: string;
  areaM2: number;
  testadaM: number | null;
  profundidadeM: number | null;
}

export interface CenarioPrincipal {
  origem: "estudo_salvo" | "legado" | "lotes_avulsos";
  estudoSalvoId: string | null;
  nome: string | null;
  versao: number | null;
  cenarioId: string | null;
  tipologia: TipologiaMassa | null;
  precoM2Lote: number | null;
  lotes: LoteCenarioPrincipal[];
  quadroAreas: QuadroAreasMassa | null;
}

export interface FontesCenarioPrincipal {
  /** Estudo salvo marcado como principal (não excluído), quando houver. */
  principal?: {
    id: string;
    nome: string;
    versao: number;
    parametrosJson: string | null;
    cenariosJson: string | null;
    cenarioEscolhidoId: string | null;
  } | null;
  /** Colunas legadas do estudo de incorporação. */
  massaCenariosJson: string | null;
  cenarioEscolhidoId: string | null;
  semKml: boolean;
  lotesAvulsosJson: string | null;
  areaBrutaM2: number;
}

/** Lotes vendáveis numerados (cenários antigos sem quadra/nº recebem quadra "1"). */
function lotesVendaveis(c: CenarioMassa): LoteCenarioPrincipal[] {
  let seq = 0;
  return c.lotes.filter((l) => l.tipo === "vendavel").map((l: LoteGerado) => {
    seq++;
    return {
      quadra: l.quadra ?? "1",
      lote: l.numero ?? String(seq),
      areaM2: l.areaM2,
      testadaM: null,
      profundidadeM: null,
    };
  });
}

export function quadroAreasDoCenario(c: CenarioMassa, params: ParametrosMassa | null, areaBrutaM2: number): QuadroAreasMassa {
  if (c.quadroAreas) return c.quadroAreas;
  // Cenário salvo antes do quadro de áreas: reconstrói sem inventar — as
  // doações sem destinação são repartidas pela proporção dos percentuais.
  const publicos = c.lotes.filter((l) => l.tipo === "area_publica");
  const inst = publicos.filter((l) => l.uso === "institucional").reduce((s, l) => s + l.areaM2, 0);
  const verde = publicos.filter((l) => l.uso === "verde").reduce((s, l) => s + l.areaM2, 0);
  const semUso = publicos.filter((l) => !l.uso).reduce((s, l) => s + l.areaM2, 0);
  const pI = params?.percentInstitucional ?? 0;
  const pV = params?.percentAreaVerde ?? 0;
  const fI = pI + pV > 0 ? pI / (pI + pV) : 0;
  return calcularQuadroAreasMassa({
    areaBrutaM2: areaBrutaM2 > 0 ? areaBrutaM2 : c.kpis.aproveitamento > 0 ? c.kpis.areaVendavelM2 / c.kpis.aproveitamento : 0,
    restricoes: params ? restricoesDosParametros(params) : RESTRICOES_VAZIAS,
    areaVendavelM2: c.kpis.areaVendavelM2,
    nLotesVendaveis: c.kpis.lotesVendaveis,
    areaInstitucionalM2: inst + semUso * fI,
    areaVerdeM2: verde + semUso * (1 - fI),
    precoM2Lote: params?.precoM2Lote ?? (c.kpis.areaVendavelM2 > 0 ? c.kpis.vgv / c.kpis.areaVendavelM2 : 0),
  });
}

export function cenarioPrincipalDe(f: FontesCenarioPrincipal): CenarioPrincipal | null {
  const deCenarios = (
    origem: CenarioPrincipal["origem"],
    meta: { id: string | null; nome: string | null; versao: number | null },
    paramsJson: string | null,
    cenariosJson: string | null,
    escolhidoId: string | null,
  ): CenarioPrincipal | null => {
    const bruto = parse<{ params?: ParametrosMassa; cenarios?: CenarioMassa[] } | CenarioMassa[]>(cenariosJson);
    const cenarios = Array.isArray(bruto) ? bruto : bruto?.cenarios ?? [];
    const params = parse<ParametrosMassa>(paramsJson) ?? (Array.isArray(bruto) ? null : bruto?.params ?? null);
    const c = cenarioEscolhido(cenarios, escolhidoId);
    if (!c) return null;
    return {
      origem,
      estudoSalvoId: meta.id,
      nome: meta.nome,
      versao: meta.versao,
      cenarioId: c.id,
      tipologia: c.tipologia ?? "grid",
      precoM2Lote: params?.precoM2Lote ?? null,
      lotes: lotesVendaveis(c),
      quadroAreas: quadroAreasDoCenario(c, params, f.areaBrutaM2),
    };
  };

  if (f.principal) {
    const r = deCenarios("estudo_salvo", { id: f.principal.id, nome: f.principal.nome, versao: f.principal.versao },
      f.principal.parametrosJson, f.principal.cenariosJson, f.principal.cenarioEscolhidoId);
    if (r) return r;
  }
  const legado = deCenarios("legado", { id: null, nome: null, versao: null }, null, f.massaCenariosJson, f.cenarioEscolhidoId);
  if (legado) return legado;

  if (f.semKml) {
    const avulsos = parseLotesAvulsos(f.lotesAvulsosJson);
    if (avulsos.length === 0) return null;
    const area = avulsos.reduce((s, l) => s + l.areaM2, 0);
    return {
      origem: "lotes_avulsos",
      estudoSalvoId: null,
      nome: null,
      versao: null,
      cenarioId: null,
      tipologia: null,
      precoM2Lote: null,
      lotes: avulsos.map((l) => ({ quadra: l.quadra, lote: l.lote, areaM2: l.areaM2, testadaM: l.testadaM, profundidadeM: l.profundidadeM })),
      quadroAreas: calcularQuadroAreasMassa({
        areaBrutaM2: f.areaBrutaM2 > 0 ? f.areaBrutaM2 : area,
        restricoes: RESTRICOES_VAZIAS,
        areaVendavelM2: area,
        nLotesVendaveis: avulsos.length,
        areaInstitucionalM2: 0,
        areaVerdeM2: 0,
        precoM2Lote: 0,
      }),
    };
  }
  return null;
}
