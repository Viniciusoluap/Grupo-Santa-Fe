"use client";

import { useState } from "react";
import { parseNumeroBR } from "@/lib/utils";

interface Props {
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  /** Máximo de casas decimais exibidas ao reformatar (padrão 2). */
  decimals?: number;
  required?: boolean;
  disabled?: boolean;
}

function formatarCampo(v: number, decimals: number): string {
  return Number.isFinite(v) && v !== 0 ? v.toLocaleString("pt-BR", { maximumFractionDigits: decimals }) : "";
}

/**
 * Campo de número (moeda, medida ou decimal) controlado — mesmo padrão já
 * usado em `massa-tab.tsx` (Lote 5): buffer de texto livre que aceita o
 * separador decimal brasileiro (vírgula), convertido a cada digitação com
 * `parseNumeroBR` e reformatado no blur a partir do valor numérico já
 * validado. Substitui `<input type="number">` nos campos de valor/área das
 * abas do Estudo de Incorporação, que não usam o padrão de formulário nativo
 * (name/FormData) do `CurrencyInput`/`PercentInput`.
 */
export function NumeroBRField({
  value,
  onValueChange,
  className = "",
  placeholder = "0,00",
  decimals = 2,
  required,
  disabled,
}: Props) {
  const [texto, setTexto] = useState(() => formatarCampo(value, decimals));

  function handleChange(novoTexto: string) {
    setTexto(novoTexto);
    onValueChange(parseNumeroBR(novoTexto));
  }

  function handleBlur() {
    setTexto(formatarCampo(value, decimals));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={texto}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      required={required}
      disabled={disabled}
      className={className}
    />
  );
}
