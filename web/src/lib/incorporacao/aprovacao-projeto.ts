// Projeto Aprovado (3.2 Incorporação e Produto) — controle da aprovação do
// projeto legal junto à prefeitura e demais órgãos competentes (bombeiros,
// concessionárias de água/esgoto e energia, meio ambiente).

export type StatusAprovacao = "nao_protocolado" | "protocolado" | "em_analise" | "exigencia" | "aprovado" | "indeferido";

export const ORGAOS_APROVACAO = [
  "Prefeitura (projeto arquitetônico)",
  "Corpo de Bombeiros",
  "Concessionária de Água/Esgoto",
  "Concessionária de Energia",
  "Órgão Ambiental",
  "Cartório de Registro de Imóveis",
  "Outro",
] as const;
export type OrgaoAprovacao = (typeof ORGAOS_APROVACAO)[number];

export interface ProcessoAprovacao {
  id: string;
  orgao: OrgaoAprovacao;
  numeroProtocolo?: string;
  dataProtocolo?: string; // ISO yyyy-mm-dd
  prazoPrevisto?: string; // ISO yyyy-mm-dd
  status: StatusAprovacao;
  observacoes?: string;
}

export interface ResumoAprovacaoProjeto {
  total: number;
  protocolados: number;
  aprovados: number;
  comExigencia: ProcessoAprovacao[];
  atrasados: ProcessoAprovacao[];
  pctAprovado: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resumoAprovacaoProjeto(lista: ProcessoAprovacao[], hoje: Date = new Date()): ResumoAprovacaoProjeto {
  const total = lista.length;
  const protocolados = lista.filter((p) => p.status !== "nao_protocolado").length;
  const aprovados = lista.filter((p) => p.status === "aprovado").length;
  const comExigencia = lista.filter((p) => p.status === "exigencia");
  const atrasados = lista.filter((p) => {
    if (!p.prazoPrevisto) return false;
    if (p.status === "aprovado") return false;
    return new Date(p.prazoPrevisto) < hoje;
  });
  return {
    total,
    protocolados,
    aprovados,
    comExigencia,
    atrasados,
    pctAprovado: total > 0 ? round1((aprovados / total) * 100) : 0,
  };
}

/** Lê o JSON salvo e diz se todos os processos cadastrados já estão aprovados — usado no progresso automático. */
export function projetoTotalmenteAprovadoDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { processos?: ProcessoAprovacao[] };
    return Array.isArray(dados.processos) && dados.processos.length > 0 && dados.processos.every((p) => p.status === "aprovado");
  } catch {
    return false;
  }
}
