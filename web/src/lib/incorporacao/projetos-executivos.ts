// Projetos Executivos (5.1 Projetos Executivos e Obras) — repositório dos
// projetos executivos de engenharia liberados para obra, por disciplina.

export type StatusProjetoExecutivo = "nao_iniciado" | "em_elaboracao" | "em_revisao" | "liberado_para_obra";

export const DISCIPLINAS_EXECUTIVO = [
  "Arquitetura Executiva",
  "Estrutural Executivo",
  "Instalações Elétricas Executivo",
  "Instalações Hidrossanitárias Executivo",
  "Instalações de Gás Executivo",
  "Terraplenagem/Drenagem Executivo",
  "Impermeabilização",
  "Outro",
] as const;
export type DisciplinaExecutivo = (typeof DISCIPLINAS_EXECUTIVO)[number];

export interface ProjetoExecutivo {
  id: string;
  disciplina: DisciplinaExecutivo;
  url?: string;
  dataLiberacao?: string; // ISO yyyy-mm-dd
  status: StatusProjetoExecutivo;
}

export interface ResumoProjetosExecutivos {
  total: number;
  liberados: number;
  pctLiberado: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resumoProjetosExecutivos(lista: ProjetoExecutivo[]): ResumoProjetosExecutivos {
  const total = lista.length;
  const liberados = lista.filter((p) => p.status === "liberado_para_obra").length;
  return { total, liberados, pctLiberado: total > 0 ? round1((liberados / total) * 100) : 0 };
}

/** Lê o JSON salvo e diz se todos os projetos executivos cadastrados já estão liberados para obra. */
export function projetosExecutivosTodosLiberadosDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { projetos?: ProjetoExecutivo[] };
    return Array.isArray(dados.projetos) && dados.projetos.length > 0 && dados.projetos.every((p) => p.status === "liberado_para_obra");
  } catch {
    return false;
  }
}
