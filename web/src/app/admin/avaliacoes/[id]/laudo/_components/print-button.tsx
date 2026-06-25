"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-[#1A1A1A] text-[#F5C400] font-bold text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-black transition-colors"
    >
      <Printer size={14} /> Imprimir / Salvar PDF
    </button>
  );
}
