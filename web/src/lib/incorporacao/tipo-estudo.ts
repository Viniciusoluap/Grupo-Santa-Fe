export const TIPOS_INCORPORACAO = [
  { value: "desmembramento_simples", label: "Desmembramento Simples" },
  { value: "residencial", label: "Residencial" },
  { value: "vertical", label: "Vertical" },
  { value: "loteamento", label: "Loteamento" },
] as const;

export type TipoIncorporacao = (typeof TIPOS_INCORPORACAO)[number]["value"];
export function tipoIncorporacaoValido(value: unknown): value is TipoIncorporacao {
  return TIPOS_INCORPORACAO.some((tipo) => tipo.value === value);
}
