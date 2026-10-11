// Regras puras do formulário de comissão (EPIC-008): o negócio é sempre um
// registro pré-cadastrado (imóvel, financiamento ou obra) e o valor sugerido é
// percentual × valor do negócio vinculado — editável depois.

export type NegocioItem = { id: string; label: string; valorBase: number | null };

export const TIPOS_COMISSAO = [
  { value: "venda", label: "Comissão de Venda", base: "valor do imóvel" },
  { value: "aluguel", label: "Comissão de Aluguel", base: "valor do aluguel" },
  { value: "financiamento", label: "Comissão de Financiamento", base: "valor do imóvel financiado" },
  { value: "obra", label: "Obra", base: "valor total da obra", somenteCorretor: true },
  { value: "extra", label: "Extra", base: null },
] as const;

/** Tipos gravados por versões antigas → tipo atual do formulário. */
const TIPO_LEGADO: Record<string, string> = { venda_imovel: "venda", imovel: "venda" };

export function normalizarTipoComissao(tipo: string | null | undefined): string {
  if (!tipo) return "venda";
  return TIPO_LEGADO[tipo] ?? tipo;
}

export function rotuloTipoComissao(tipo: string): string {
  return TIPOS_COMISSAO.find((t) => t.value === tipo)?.label ?? tipo;
}

/** Texto gravado em `Comissao.imovel` (mesmo formato já usado no histórico). */
export function rotuloNegocio(item: { label: string }, tipo: string): string {
  return `${item.label} [${rotuloTipoComissao(tipo)}]`;
}

/** Na edição, reencontra o negócio pré-cadastrado a partir do texto gravado. */
export function encontrarNegocio(itens: NegocioItem[], tipo: string, imovelGravado: string): NegocioItem | null {
  return (
    itens.find((i) => rotuloNegocio(i, tipo) === imovelGravado) ??
    itens.find((i) => i.label === imovelGravado) ??
    null
  );
}

/**
 * Valor sugerido da comissão: percentual × valor do negócio, arredondado em
 * centavos. `null` quando não há base para calcular (valor zerado/ausente ou
 * percentual inválido) — o usuário informa o valor manualmente.
 */
export function calcularValorComissao(valorBase: number | null | undefined, percentual: number): number | null {
  if (valorBase == null || !Number.isFinite(valorBase) || valorBase <= 0) return null;
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) return null;
  return Math.round(valorBase * percentual) / 100;
}
