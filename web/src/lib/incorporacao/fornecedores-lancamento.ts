// Contratação de Fornecedores do Lançamento — gestão dos fornecedores de
// marketing, estande de vendas, decoração e eventos. Função pura, portada
// do Grupo Santa Fé sem alteração de lógica.

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
  /** Ausente nos dados antigos: o valor único anterior é a referência de orçamento. */
  valorOrcado?: number;
  valorContratado: number;
  status: StatusFornecedor;
}

export interface ResumoFornecedoresLancamento {
  total: number;
  contratados: number;
  pctContratado: number;
  valorTotalOrcado: number;
  valorTotalContratado: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Valores inválidos nunca contaminam os indicadores financeiros. */
function valorSeguro(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

export function resumoFornecedoresLancamento(lista: FornecedorLancamento[]): ResumoFornecedoresLancamento {
  const total = lista.length;
  const contratados = lista.filter((f) => f.status === "contratado" || f.status === "entregue").length;
  return {
    total,
    contratados,
    pctContratado: total > 0 ? round1((contratados / total) * 100) : 0,
    valorTotalOrcado: round2(lista.reduce((s, f) => s + valorSeguro(f.valorOrcado ?? f.valorContratado), 0)),
    valorTotalContratado: round2(
      lista.filter((f) => f.status === "contratado").reduce((s, f) => s + valorSeguro(f.valorContratado), 0)
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
