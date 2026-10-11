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

/**
 * Na edição, reencontra o negócio pré-cadastrado da comissão.
 *
 * Com `negocioId` gravado, a busca é SÓ pelo ID — rótulos não são únicos
 * (dois imóveis com o mesmo título, dois financiamentos do mesmo cliente...) e
 * casar pelo texto escolhia sempre o primeiro, recalculando a comissão sobre o
 * valor de outro registro. Se o ID não existe mais (registro excluído), devolve
 * `null` em vez de "chutar" outro com o mesmo rótulo.
 *
 * Sem ID (comissões gravadas antes da coluna), cai no texto gravado, mas só
 * aceita quando exatamente UM negócio bate; ambíguo → `null` (o formulário
 * mostra como registro antigo e o usuário escolhe o negócio certo).
 */
export function encontrarNegocio(
  itens: NegocioItem[],
  tipo: string,
  imovelGravado: string,
  negocioId?: string | null,
): NegocioItem | null {
  if (negocioId) return itens.find((i) => i.id === negocioId) ?? null;

  const unico = (candidatos: NegocioItem[]) => (candidatos.length === 1 ? candidatos[0] : null);
  const porRotulo = itens.filter((i) => rotuloNegocio(i, tipo) === imovelGravado);
  if (porRotulo.length > 0) return unico(porRotulo);
  return unico(itens.filter((i) => i.label === imovelGravado));
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
