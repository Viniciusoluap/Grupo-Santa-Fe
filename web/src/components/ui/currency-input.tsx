"use client";

import { useState } from "react";
import { maskCurrency, currencyToFloat } from "@/lib/utils";

interface Props {
  name?: string;
  defaultValue?: number | null;
  value?: number | null;
  onValueChange?: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function CurrencyInput({ name, defaultValue, value, onValueChange, placeholder = "0,00", className = "", required }: Props) {
  const [display, setDisplay] = useState(() =>
    defaultValue ? maskCurrency(String(Math.round(defaultValue * 100))) : ""
  );

  const controlled = value !== undefined;
  const shown = controlled
    ? value ? maskCurrency(String(Math.round(value * 100))) : ""
    : display;

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">R$</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          const next = maskCurrency(e.target.value);
          if (!controlled) setDisplay(next);
          onValueChange?.(Number(currencyToFloat(next)));
        }}
        required={required}
        className={`pl-9 ${className}`}
      />
      {name && <input type="hidden" name={name} value={currencyToFloat(shown)} />}
    </div>
  );
}
