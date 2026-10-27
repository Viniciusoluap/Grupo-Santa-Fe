"use client";

import { NumeroInput } from "@/components/ui/numero-input";

interface Props {
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  /** Máximo de casas decimais aceitas/exibidas (padrão 2; coeficientes usam 4). */
  decimals?: number;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Campo de número (moeda, medida ou decimal) controlado das abas do Estudo de
 * Incorporação. Desde 27/10 (correção 21/AD-01) é um wrapper do `NumeroInput`
 * (máscara pt-BR "1.000.000,00" durante a digitação, cursor estável) — mesma
 * API e mesmo número entregue em `onValueChange`; zero continua exibido como
 * campo vazio.
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
  return (
    <NumeroInput
      value={Number.isFinite(value) ? value : 0}
      onChange={(v) => onValueChange(v ?? 0)}
      casas={decimals}
      casasMinimas={Math.min(2, decimals)}
      vazioQuandoZero
      placeholder={placeholder}
      className={className}
      required={required}
      disabled={disabled}
    />
  );
}
