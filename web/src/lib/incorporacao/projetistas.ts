// Contratação de Projetistas (3.1 Incorporação e Produto) — gestão dos
// projetistas contratados (arquitetura, estrutural, instalações etc.), com
// prazo de entrega e status de compatibilização técnica entre disciplinas.

export type StatusProjetista = "nao_contratado" | "contratado" | "em_desenvolvimento" | "entregue" | "compatibilizado";

export const DISCIPLINAS = [
  "Arquitetura",
  "Estrutural",
  "Instalações Hidrossanitárias",
  "Instalações Elétricas",
  "Instalações de Gás",
  "Terraplenagem/Drenagem",
  "Paisagismo",
  "Interiores",
  "Outra",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export interface Projetista {
  id: string;
  disciplina: Disciplina;
  empresaOuProfissional: string;
  contato?: string;
  dataContratacao?: string; // ISO yyyy-mm-dd
  prazoEntrega?: string; // ISO yyyy-mm-dd
  status: StatusProjetista;
}

export interface ResumoProjetistas {
  total: number;
  contratados: number;
  entregues: number;
  compatibilizados: number;
  pctCompatibilizado: number;
  atrasados: Projetista[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function resumoProjetistas(lista: Projetista[], hoje: Date = new Date()): ResumoProjetistas {
  const total = lista.length;
  const contratados = lista.filter((p) => p.status !== "nao_contratado").length;
  const entregues = lista.filter((p) => p.status === "entregue" || p.status === "compatibilizado").length;
  const compatibilizados = lista.filter((p) => p.status === "compatibilizado").length;
  const atrasados = lista.filter((p) => {
    if (!p.prazoEntrega) return false;
    if (p.status === "entregue" || p.status === "compatibilizado") return false;
    return new Date(p.prazoEntrega) < hoje;
  });
  return {
    total,
    contratados,
    entregues,
    compatibilizados,
    pctCompatibilizado: total > 0 ? round1((compatibilizados / total) * 100) : 0,
    atrasados,
  };
}

/** Lê o JSON salvo e diz se todos os projetistas cadastrados já estão compatibilizados — usado no progresso automático. */
export function projetistasCompatibilizadosDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { projetistas?: Projetista[] };
    return Array.isArray(dados.projetistas) && dados.projetistas.length > 0 && dados.projetistas.every((p) => p.status === "compatibilizado");
  } catch {
    return false;
  }
}
