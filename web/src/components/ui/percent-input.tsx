"use client";

import { NumeroInput } from "@/components/ui/numero-input";

interface Props {
  /** Nome do campo no FormData (uso em formulário nativo, como `CurrencyInput`). */
  name?: string;
  /** Valor inicial para uso não controlado (formulário nativo com `action`). */
  defaultValue?: number | null;
  /** Valor controlado — quando informado, o componente reflete esse número. */
  value?: number | null;
  /** Callback chamado com o número já convertido (padrão BR → `number`). */
  onValueChange?: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Campo de percentual compartilhado — mesma API de antes. Desde 27/10
 * (correção 21/AD-01) é um wrapper do `NumeroInput`: até 4 casas (exibe no
 * mínimo 2), ponto digitado/colado é decimal ("2.345" = 2,345%, igual a
 * `lerPercentualDigitado` e à Prospecta), zero exibido como campo vazio.
 * Funciona controlado (`value`/`onValueChange`) ou não controlado
 * (`name`/`defaultValue`, com input oculto para o `FormData`).
 */
export function PercentInput({
  name,
  defaultValue,
  value,
  onValueChange,
  placeholder = "0,00",
  className = "",
  required,
  disabled,
}: Props) {
  const modo = value != null ? { value } : { defaultValue: defaultValue ?? null };
  return (
    <NumeroInput
      {...modo}
      name={name}
      valorOcultoVazio="0"
      onChange={(v) => onValueChange?.(v ?? 0)}
      sufixo="%"
      casas={4}
      casasMinimas={2}
      pontoDecimal
      vazioQuandoZero
      placeholder={placeholder}
      className={className}
      required={required}
      disabled={disabled}
    />
  );
}
