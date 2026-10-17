"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { assinarEnvio, textoEnvio, type EstadoEnvio } from "@/lib/envio-progresso";

/** Item 4 (18/10): "Enviando foto 2 de 4 — 65%" com barra, fixa no rodapé, em qualquer envio. */
export function BarraEnvioGlobal() {
  const [estado, setEstado] = useState<EstadoEnvio>(null);
  useEffect(() => assinarEnvio(setEstado), []);
  if (!estado) return null;
  const pct = Math.round(Math.min(1, Math.max(0, estado.fracao)) * 100);
  const geral = Math.round(((estado.atual - 1 + Math.min(1, estado.fracao)) / Math.max(1, estado.total)) * 100);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4">
      <div role="status" aria-live="polite" className="w-full max-w-md border border-[var(--brand-yellow)] bg-[var(--brand-dark)] p-3 text-white shadow-2xl">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 size={16} className="shrink-0 animate-spin text-[var(--brand-yellow)]" />
          <span className="min-w-0 break-words">{textoEnvio(estado)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-white/20" aria-hidden>
          <div className="h-full bg-[var(--brand-yellow)] transition-[width] duration-200" style={{ width: `${estado.total > 1 ? geral : pct}%` }} />
        </div>
      </div>
    </div>
  );
}
