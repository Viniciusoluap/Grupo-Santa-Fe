// Contratação de Fornecedores (4.2 Lançamento, Marketing e Vendas) — gestão
// dos fornecedores de marketing, estande de vendas, decoração e eventos do
// lançamento.

export type StatusFornecedor = "nao_contratado" | "orcamento" | "contratado" | "entregue";

export const CATEGORIAS_FORNECEDOR = [
  "Agência de Publicidade",
  "Estande/Decorado",
  "Fotografia/Vídeo",
  "Buffet/Eventos",
  "Brindes",
  "Mídia/Ads",
  "Outro",
] as const;
export type CategoriaFornecedor = (typeof CATEGORIAS_FORNECEDOR)[number];

export interface FornecedorLancamento {
  id: string;
  categoria: CategoriaFornecedor;
  nome: string;
  contato?: string;
  valorContratado: number;
  status: StatusFornecedor;
}

export interface ResumoFornecedoresLancamento {
  total: number;
  contratados: number;
  pctContratado: number;
  valorTotalContratado: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resumoFornecedoresLancamento(lista: FornecedorLancamento[]): ResumoFornecedoresLancamento {
  const total = lista.length;
  const contratados = lista.filter((f) => f.status === "contratado" || f.status === "entregue").length;
  return {
    total,
    contratados,
    pctContratado: total > 0 ? round1((contratados / total) * 100) : 0,
    valorTotalContratado: round2(
      lista.filter((f) => f.status === "contratado" || f.status === "entregue").reduce((s, f) => s + f.valorContratado, 0)
    ),
  };
}

/** Lê o JSON salvo e diz se todos os fornecedores cadastrados já estão contratados. */
export function fornecedoresTodosContratadosDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { fornecedores?: FornecedorLancamento[] };
    return (
      Array.isArray(dados.fornecedores) &&
      dados.fornecedores.length > 0 &&
      dados.fornecedores.every((f) => f.status === "contratado" || f.status === "entregue")
    );
  } catch {
    return false;
  }
}
