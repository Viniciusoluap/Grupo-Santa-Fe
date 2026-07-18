// Material Publicitário (4.3 Lançamento, Marketing e Vendas) — repositório
// e aprovação das peças publicitárias do lançamento (site, folder, vídeos,
// redes sociais).

export type StatusPeca = "em_producao" | "em_aprovacao" | "aprovado" | "reprovado";

export const TIPOS_PECA_PUBLICITARIA = [
  "Site",
  "Folder/Encarte",
  "Vídeo Institucional",
  "Redes Sociais",
  "Placa/Outdoor",
  "Anúncio Impresso",
  "Outro",
] as const;
export type TipoPecaPublicitaria = (typeof TIPOS_PECA_PUBLICITARIA)[number];

export interface PecaPublicitaria {
  id: string;
  tipo: TipoPecaPublicitaria;
  nome: string;
  url?: string;
  status: StatusPeca;
}

export interface ResumoMaterialPublicitario {
  total: number;
  aprovadas: number;
  emAprovacao: number;
  pctAprovado: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resumoMaterialPublicitario(pecas: PecaPublicitaria[]): ResumoMaterialPublicitario {
  const total = pecas.length;
  const aprovadas = pecas.filter((p) => p.status === "aprovado").length;
  const emAprovacao = pecas.filter((p) => p.status === "em_aprovacao").length;
  return {
    total,
    aprovadas,
    emAprovacao,
    pctAprovado: total > 0 ? round1((aprovadas / total) * 100) : 0,
  };
}

/** Lê o JSON salvo e diz se todas as peças cadastradas já estão aprovadas. */
export function materialPublicitarioAprovadoDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { pecas?: PecaPublicitaria[] };
    return Array.isArray(dados.pecas) && dados.pecas.length > 0 && dados.pecas.every((p) => p.status === "aprovado");
  } catch {
    return false;
  }
}
