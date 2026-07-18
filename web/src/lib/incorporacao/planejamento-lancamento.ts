// Planejamento do Lançamento (4.1 Lançamento, Marketing e Vendas) —
// cronograma de marcos e estratégia comercial do evento de lançamento.

export type StatusMarco = "pendente" | "em_andamento" | "concluido";

export interface MarcoLancamento {
  id: string;
  nome: string;
  dataPrevista?: string; // ISO yyyy-mm-dd
  dataRealizada?: string; // ISO yyyy-mm-dd
  status: StatusMarco;
}

export const MARCOS_PADRAO_LANCAMENTO: string[] = [
  "Definição da data do evento de lançamento",
  "Definição da tabela de vendas e condições",
  "Contratação da equipe/imobiliária de vendas",
  "Produção do material publicitário",
  "Montagem do estande/decorado",
  "Divulgação em mídia (pré-lançamento)",
  "Evento de lançamento",
  "Follow-up dos leads gerados no evento",
];

export interface ResumoPlanejamentoLancamento {
  total: number;
  concluidos: number;
  pctConcluido: number;
  atrasados: MarcoLancamento[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resumoPlanejamentoLancamento(marcos: MarcoLancamento[], hoje: Date = new Date()): ResumoPlanejamentoLancamento {
  const total = marcos.length;
  const concluidos = marcos.filter((m) => m.status === "concluido").length;
  const atrasados = marcos.filter((m) => {
    if (!m.dataPrevista || m.status === "concluido") return false;
    return new Date(m.dataPrevista) < hoje;
  });
  return {
    total,
    concluidos,
    pctConcluido: total > 0 ? round1((concluidos / total) * 100) : 0,
    atrasados,
  };
}

/** Lê o JSON salvo e diz se todos os marcos do cronograma já foram concluídos. */
export function planejamentoLancamentoCompletoDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { marcos?: MarcoLancamento[] };
    return Array.isArray(dados.marcos) && dados.marcos.length > 0 && dados.marcos.every((m) => m.status === "concluido");
  } catch {
    return false;
  }
}
