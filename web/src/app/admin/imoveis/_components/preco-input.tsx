"use client";

import { useState } from "react";

function toDisplay(centavos: string): string {
  const digits = centavos.replace(/\D/g, "");
  if (!digits || digits === "0") return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PrecoInputProps {
  name: string;
  defaultValue?: number;
  required?: boolean;
}

export function PrecoInput({ name, defaultValue, required }: PrecoInputProps) {
  const [display, setDisplay] = useState(() => {
    if (!defaultValue) return "";
    const num = defaultValue;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  const rawValue = display
    ? parseFloat(display.replace(/\./g, "").replace(",", "."))
    : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplay(toDisplay(e.target.value));
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
