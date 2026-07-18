"use client";

import { Clock } from "lucide-react";

// Placeholder para etapas da metodologia (Carolina Caribé / Incorporação na
// Prática) já mapeadas na estrutura do módulo, mas cuja funcionalidade ainda
// será construída — uma de cada vez, com a lógica correta de cada etapa.

export function EmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="bg-white border border-dashed border-gray-200 p-10 text-center">
      <Clock size={28} className="text-gray-200 mx-auto mb-3" />
      <p className="font-bold text-[var(--brand-dark)]">{titulo}</p>
      <p className="text-gray-400 text-sm mt-1.5 max-w-lg mx-auto leading-relaxed">{descricao}</p>
      <span className="inline-block mt-4 text-[10px] font-black bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-2.5 py-1 uppercase tracking-widest">
        Em breve
      </span>
    </div>
  );
}
