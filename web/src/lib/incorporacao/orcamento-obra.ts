// Orçamentos (5.2 Projetos Executivos e Obras) — orçamento executivo real
// da obra, comparado ao orçamento preliminar (3.5) e ao parametrizado
// (2.4) já calculados anteriormente.

import { CATEGORIAS_ORCAMENTO_PRELIMINAR, type CategoriaOrcamentoPreliminar } from "./orcamento-preliminar";

export type CategoriaOrcamentoObra = CategoriaOrcamentoPreliminar;
export const CATEGORIAS_ORCAMENTO_OBRA = CATEGORIAS_ORCAMENTO_PRELIMINAR;

export interface ItemOrcamentoObra {
  id: string;
  categoria: CategoriaOrcamentoObra;
  valorOrcado: number;
  valorRealizado: number;
}

export interface ResumoOrcamentoObra {
  totalOrcado: number;
  totalRealizado: number;
  pctExecutado: number; // realizado / orçado × 100
  totalOrcamentoPreliminarReferencia: number | null;
  variacaoVsPreliminarPct: number | null; // (orçado - preliminar) / preliminar × 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resumoOrcamentoObra(
  itens: ItemOrcamentoObra[],
  totalOrcamentoPreliminarReferencia?: number | null
): ResumoOrcamentoObra {
  const totalOrcado = round2(itens.reduce((s, i) => s + i.valorOrcado, 0));
  const totalRealizado = round2(itens.reduce((s, i) => s + i.valorRealizado, 0));
  const referencia = totalOrcamentoPreliminarReferencia && totalOrcamentoPreliminarReferencia > 0 ? totalOrcamentoPreliminarReferencia : null;
  return {
    totalOrcado,
    totalRealizado,
    pctExecutado: totalOrcado > 0 ? round1((totalRealizado / totalOrcado) * 100) : 0,
    totalOrcamentoPreliminarReferencia: referencia,
    variacaoVsPreliminarPct: referencia ? round1(((totalOrcado - referencia) / referencia) * 100) : null,
  };
}

/** Lê o JSON salvo e diz se o orçamento da obra já tem itens com valor realizado lançado. */
export function orcamentoObraPreenchidoDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { itens?: ItemOrcamentoObra[] };
    return Array.isArray(dados.itens) && dados.itens.some((i) => i.valorRealizado > 0);
  } catch {
    return false;
  }
}
