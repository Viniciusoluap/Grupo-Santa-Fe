"use client";

import { useState } from "react";
import { maskCurrency, currencyToFloat } from "@/lib/utils";

interface PrecoInputProps {
  name: string;
  defaultValue?: number;
  required?: boolean;
}

export function PrecoInput({ name, defaultValue, required }: PrecoInputProps) {
  const [display, setDisplay] = useState(() =>
    defaultValue ? maskCurrency(String(Math.round(defaultValue * 100))) : ""
  );

  const rawValue = display ? currencyToFloat(display) : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplay(maskCurrency(e.target.value));
  };

  return (
    <>
      <input type="hidden" name={name} value={rawValue} />
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          R$
        </span>
        <input
          type="text"
          value={display}
          onChange={handleChange}
          placeholder="0,00"
          inputMode="numeric"
          required={required}
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
    </>
  );
}
