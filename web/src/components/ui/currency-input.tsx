"use client";

import { NumeroInput } from "@/components/ui/numero-input";

interface Props {
  name?: string;
  defaultValue?: number | null;
  value?: number | null;
  onValueChange?: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}

// Pedido de 15/10: valor sempre exibido como "R$ 1.000.000,00" — pontos de
// milhar já durante a digitação ("180000" -> "180.000") e duas casas ao sair do
// campo. Desde 27/10 (correção 21/AD-01) é um wrapper do `NumeroInput` (máscara
// única, cursor estável, colagem de "R$ 1.234,56") — mesma API e mesmo número
// entregue/enviado no `FormData` (vazio → ""). Mesmo comportamento do
// CurrencyInput da Prospecta.
export function CurrencyInput({ name, defaultValue, value, onValueChange, placeholder = "0,00", className = "", required, id }: Props) {
  const modo = value !== undefined ? { value: value ?? 0 } : { defaultValue: defaultValue ?? 0 };
  return (
    <NumeroInput
      {...modo}
      id={id}
      name={name}
      onChange={(v) => onValueChange?.(v ?? 0)}
      prefixo="R$"
      casas={2}
      vazioQuandoZero
      placeholder={placeholder}
      required={required}
      className={`w-full min-w-0 ${className}`}
    />
  );
}
