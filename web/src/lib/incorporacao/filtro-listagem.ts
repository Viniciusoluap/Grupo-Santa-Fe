// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-07 (`shared/incorporacao/filtro-listagem.ts`): filtros combinados da
// listagem de Incorporação (situação, nome e tipo). Todos valem ao mesmo tempo (E lógico); o nome ignora maiúsculas
// e acentos. Diferença de stack: campos do Santa Fé (`nome`, `status`, `tipoIncorporacao`) e situação "pendente"
// (classificação pendente), que o Santa Fé já tinha na listagem.
import { normalizarTexto } from "@/lib/obras-filtro";
import { SITUACOES_ESTUDO } from "@/lib/incorporacao/status-estudo";

export interface EstudoFiltravel {
  nome: string | null;
  status: string | null;
  /** Estudos sem tipo (null) só aparecem em "Todos os tipos". */
  tipoIncorporacao: string | null;
}

export interface FiltrosIncorporacao {
  /** "todas" = todas as situações; "pendente" = situação fora da lista oficial. */
  status: string;
  nome: string;
  /** "todos" = todos os tipos (inclusive sem tipo). */
  tipo: string;
}

export const FILTROS_INCORPORACAO_VAZIOS: FiltrosIncorporacao = { status: "todas", nome: "", tipo: "todos" };

export function filtrarEstudosIncorporacao<T extends EstudoFiltravel>(estudos: T[], f: FiltrosIncorporacao): T[] {
  const busca = normalizarTexto(f.nome);
  const oficiais = new Set<string>(SITUACOES_ESTUDO.map((s) => s.value));
  return estudos.filter((e) => {
    if (f.status === "pendente") { if (e.status && oficiais.has(e.status)) return false; }
    else if (f.status !== "todas" && e.status !== f.status) return false;
    if (f.tipo !== "todos" && e.tipoIncorporacao !== f.tipo) return false;
    return !busca || normalizarTexto(e.nome).includes(busca);
  });
}

export function filtrosIncorporacaoAtivos(f: FiltrosIncorporacao): boolean {
  return f.status !== "todas" || f.tipo !== "todos" || f.nome.trim() !== "";
}
