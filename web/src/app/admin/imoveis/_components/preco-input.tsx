"use client";

import { CurrencyInput } from "@/components/ui/currency-input";

interface PrecoInputProps {
  name: string;
  defaultValue?: number;
  required?: boolean;
}

// Pedido de 15/10: mesmo campo de dinheiro do resto do sistema (R$ 1.000.000,00).
export function PrecoInput({ name, defaultValue, required }: PrecoInputProps) {
  return (
    <CurrencyInput
      name={name}
      defaultValue={defaultValue}
      required={required}
      className="w-full pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
    />
  );
}
