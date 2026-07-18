// Negociação do Terreno (2.7 Novos Negócios) — registro e acompanhamento das
// propostas trocadas com o proprietário/terreneiro até o fechamento (compra
// à vista/parcelada ou permuta física/financeira).

export type TipoProposta =
  | "compra_avista"
  | "compra_parcelada"
  | "permuta_fisica"
  | "permuta_financeira"
  | "misto";

export type StatusProposta = "enviada" | "em_analise" | "contraproposta" | "aceita" | "recusada";

export interface Proposta {
  id: string;
  data: string; // ISO yyyy-mm-dd
  autor: "grupo_santa_fe" | "proprietario";
  tipo: TipoProposta;
  valorTotal?: number; // compra à vista/parcelada ou parcela fixa da permuta física/mista
  entradaPct?: number; // compra parcelada
  prazoParcelamentoMeses?: number; // compra parcelada
  permutaPctVgv?: number; // permuta financeira: % do VGV bruto
  unidadesPermuta?: number; // permuta física: nº de unidades/lotes entregues
  condicoes?: string;
  status: StatusProposta;
}

export interface DadosNegociacao {
  proprietarioNome: string;
  proprietarioContato: string;
  propostas: Proposta[];
}

export interface ResumoNegociacao {
  totalPropostas: number;
  propostaAtual: Proposta | null; // mais recente por data
  fechada: boolean;
  valorEstimadoAtual: number;
}

/** Valor estimado da proposta — usa o VGV bruto do estudo para a permuta financeira. */
export function valorEstimadoProposta(p: Proposta, vgvGross: number): number {
  switch (p.tipo) {
    case "permuta_financeira":
      return vgvGross > 0 && p.permutaPctVgv ? vgvGross * (p.permutaPctVgv / 100) : 0;
    case "compra_avista":
    case "compra_parcelada":
    case "permuta_fisica":
    case "misto":
      return p.valorTotal ?? 0;
    default:
      return 0;
  }
}

export function resumoNegociacao(dados: DadosNegociacao, vgvGross = 0): ResumoNegociacao {
  const propostas = [...dados.propostas].sort((a, b) => a.data.localeCompare(b.data));
  const propostaAtual = propostas.length > 0 ? propostas[propostas.length - 1] : null;
  const fechada = propostas.some((p) => p.status === "aceita");
  return {
    totalPropostas: propostas.length,
    propostaAtual,
    fechada,
    valorEstimadoAtual: propostaAtual ? valorEstimadoProposta(propostaAtual, vgvGross) : 0,
  };
}

/** Lê o JSON salvo do estudo e diz se a negociação já foi fechada — usado no progresso automático. */
export function negociacaoFechadaDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as Partial<DadosNegociacao>;
    return Array.isArray(dados.propostas) && dados.propostas.some((p) => p.status === "aceita");
  } catch {
    return false;
  }
}
