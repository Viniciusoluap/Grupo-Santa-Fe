"use client";

import { useState } from "react";
import { maskCurrency, currencyToFloat } from "@/lib/utils";

interface Props {
  name: string;
  defaultValue?: number | null;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function CurrencyInput({ name, defaultValue, placeholder = "0,00", className = "", required }: Props) {
  const [display, setDisplay] = useState(() =>
    defaultValue ? maskCurrency(String(Math.round(defaultValue * 100))) : ""
  );

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">R$</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={(e) => setDisplay(maskCurrency(e.target.value))}
        required={required}
        className={`pl-9 ${className}`}
      />
      <input type="hidden" name={name} value={currencyToFloat(display)} />
    </div>
  );
}
