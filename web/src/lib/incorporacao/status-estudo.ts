export const SITUACOES_ESTUDO = [
  { value: "em_estudo", label: "Em estudo" },
  { value: "inviavel", label: "Inviável" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
] as const;

export type SituacaoEstudo = (typeof SITUACOES_ESTUDO)[number]["value"];

export function situacaoEstudoValida(value: unknown): value is SituacaoEstudo {
  return typeof value === "string" && SITUACOES_ESTUDO.some((item) => item.value === value);
}
