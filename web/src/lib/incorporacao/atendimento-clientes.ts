// Atendimento aos Clientes (5.4 Projetos Executivos e Obras) — central de
// atendimento pós-venda: repasses bancários, assembleias de condomínio,
// entrega de chaves, assistência técnica e documentação.

export type StatusChamado = "aberto" | "em_andamento" | "concluido";

export const TIPOS_CHAMADO = [
  "Repasse Bancário",
  "Assembleia de Condomínio",
  "Entrega de Chaves",
  "Assistência Técnica",
  "Documentação",
  "Outro",
] as const;
export type TipoChamado = (typeof TIPOS_CHAMADO)[number];

export interface ChamadoAtendimento {
  id: string;
  cliente: string;
  clienteLeadId?: string;
  unidadeId?: string;
  unidade?: string;
  tipo: TipoChamado;
  status: StatusChamado;
  dataAbertura?: string; // ISO yyyy-mm-dd
  dataConclusao?: string; // ISO yyyy-mm-dd
}

export interface ResumoAtendimentoClientes {
  total: number;
  abertos: number;
  emAndamento: number;
  concluidos: number;
  pctConcluido: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resumoAtendimentoClientes(chamados: ChamadoAtendimento[]): ResumoAtendimentoClientes {
  const total = chamados.length;
  const abertos = chamados.filter((c) => c.status === "aberto").length;
  const emAndamento = chamados.filter((c) => c.status === "em_andamento").length;
  const concluidos = chamados.filter((c) => c.status === "concluido").length;
  return { total, abertos, emAndamento, concluidos, pctConcluido: total > 0 ? round1((concluidos / total) * 100) : 0 };
}

/** Lê o JSON salvo e diz se todos os chamados cadastrados já estão concluídos. */
export function atendimentoTodosConcluidosDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { chamados?: ChamadoAtendimento[] };
    return Array.isArray(dados.chamados) && dados.chamados.length > 0 && dados.chamados.every((c) => c.status === "concluido");
  } catch {
    return false;
  }
}

/** Somente referências: nunca muda o status comercial das unidades consultadas. */
export function referenciasAtendimento(json: string) {
  const dados = JSON.parse(json) as { chamados?: ChamadoAtendimento[] };
  if (!Array.isArray(dados.chamados)) throw new Error("Lista de atendimentos inválida.");
  return { dados, clientes: Array.from(new Set(dados.chamados.map((c) => c.clienteLeadId).filter((id): id is string => !!id))), unidades: Array.from(new Set(dados.chamados.map((c) => c.unidadeId).filter((id): id is string => !!id))) };
}
export function vincularAtendimento(json: string, clientes: { id: string; nome: string }[], unidades: { id: string; codigo: string }[]): string {
  const { dados } = referenciasAtendimento(json);
  const cs = new Map(clientes.map((c) => [c.id, c.nome])); const us = new Map(unidades.map((u) => [u.id, u.codigo]));
  return JSON.stringify({ ...dados, chamados: dados.chamados!.map((c) => {
    if (c.clienteLeadId && !cs.has(c.clienteLeadId)) throw new Error("Cliente do CRM não encontrado ou sem acesso.");
    if (c.unidadeId && !us.has(c.unidadeId)) throw new Error("Unidade não encontrada neste empreendimento ou foi excluída.");
    return { ...c, cliente: c.clienteLeadId ? cs.get(c.clienteLeadId)! : c.cliente, unidade: c.unidadeId ? us.get(c.unidadeId)! : c.unidade };
  }) });
}
