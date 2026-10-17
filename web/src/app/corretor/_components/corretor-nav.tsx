"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, DollarSign, Home, MessageCircle } from "lucide-react";

const NAV = [
  { href: "/corretor", label: "Início", icon: Home },
  { href: "/corretor/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/corretor/comissoes", label: "Minhas Comissões", icon: DollarSign },
  // Item 06: Agenda e WhatsApp do corretor (só os próprios registros, no servidor).
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

export function CorretorNav() {
  const pathname = usePathname();
  return (
    <nav className="overflow-x-auto border-b bg-white" aria-label="Portal do Corretor">
      <div className="mx-auto flex max-w-6xl min-w-max px-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const ativo = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${ativo ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "border-transparent text-slate-600 hover:text-[var(--brand-dark)]"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
