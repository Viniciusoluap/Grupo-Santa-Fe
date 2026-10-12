"use client";

import { useState } from "react";
import { parseNumeroBR } from "@/lib/utils";

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

/** Formata um número para exibição no padrão brasileiro, sem o símbolo "%". */
function formatarCampo(v: number): string {
  return Number.isFinite(v) && v !== 0 ? v.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "";
}

/**
 * Campo de percentual compartilhado — mesma API/estilo visual do
 * `CurrencyInput`: buffer de texto livre (aceita vírgula), convertido com
 * `parseNumeroBR` a cada digitação e reformatado no blur. Funciona tanto em
 * formulários nativos não controlados (via `name`/`defaultValue`, com input
 * oculto para o `FormData`) quanto em estado React controlado (via
 * `value`/`onValueChange`).
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
  const inicial = value ?? defaultValue ?? null;
  const [display, setDisplay] = useState(() => (inicial != null ? formatarCampo(inicial) : ""));

  function handleChange(texto: string) {
    setDisplay(texto);
    onValueChange?.(parseNumeroBR(texto));
  }

  function handleBlur() {
    const numero = value ?? parseNumeroBR(display);
    setDisplay(formatarCampo(numero));
  }

  const numeroAtual = value ?? parseNumeroBR(display);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        className={`pr-7 ${className}`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
      {name && <input type="hidden" name={name} value={String(numeroAtual)} />}
    </div>
  );
}
