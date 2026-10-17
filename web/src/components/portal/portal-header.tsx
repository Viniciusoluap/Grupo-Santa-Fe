"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/logout-action";

/**
 * Cabeçalho único dos portais (Cliente e Empreiteiro) — pedido de 18/10:
 * "Voltar" à esquerda, logo e nome da empresa no centro, "Sair" à direita.
 * Gêmeo de client/src/components/PortalHeader.tsx da Prospecta.
 */
export function PortalHeader({ subtitulo, voltarPara }: { subtitulo: string; voltarPara: string }) {
  const router = useRouter();
  const voltar = () => {
    if (window.history.length > 1) router.back();
    else router.push(voltarPara);
  };
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--brand-dark)]">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 sm:px-4">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={voltar}
            aria-label="Voltar à página anterior"
            className="inline-flex items-center gap-1 px-2 py-2 text-sm font-medium text-[var(--brand-yellow)] transition-colors hover:text-white"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
        </div>
        <div className="min-w-0 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-on-dark.png" alt="Grupo Santa Fé" className="mx-auto h-8 w-auto" />
          <p className="truncate text-[11px] text-gray-300">{subtitulo}</p>
        </div>
        <div className="flex justify-end">
          <form action={logoutAction}>
            <button type="submit" className="inline-flex items-center gap-1 px-2 py-2 text-sm font-medium text-white transition-colors hover:text-[var(--brand-yellow)]">
              <LogOut size={16} /> Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
