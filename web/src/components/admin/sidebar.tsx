"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/logout-action";
import {
  Building2,
  Users,
  UserCheck,
  LogOut,
  ChevronRight,
  Settings,
  Calculator,
  CalendarDays,
  BadgeDollarSign,
  HardHat,
  Ruler,
  FileCheck,
  MessageCircle,
  Map,
  X,
  Scale,
  Briefcase,
  ClipboardList,
  Mountain,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Meus clientes",
    href: "/admin/meus-clientes",
    icon: UserCheck,
  },
  {
    label: "Imóveis",
    href: "/admin/imoveis",
    icon: Building2,
  },
  {
    label: "Leads",
    href: "/admin/leads",
    icon: Users,
  },
  {
    label: "Agenda",
    href: "/admin/agenda",
    icon: CalendarDays,
  },
  {
    label: "Corretores",
    href: "/admin/corretores",
    icon: UserCheck,
  },
  {
    label: "Comissões",
    href: "/admin/comissoes",
    icon: BadgeDollarSign,
  },
  {
    label: "Financiamentos",
    href: "/admin/financiamentos",
    icon: Calculator,
  },
  {
    label: "Obras",
    href: "/admin/obras",
    icon: HardHat,
  },
  {
    label: "Projetos",
    href: "/admin/projetos",
    icon: Ruler,
  },
  {
    label: "Regularização",
    href: "/admin/regularizacao",
    icon: FileCheck,
  },
  {
    label: "Mapa",
    href: "/admin/mapa",
    icon: Map,
  },
  {
    label: "WhatsApp",
    href: "/admin/whatsapp",
    icon: MessageCircle,
  },
  {
    label: "BPO Financeiro",
    href: "/admin/bpo",
    icon: Briefcase,
  },
  {
    label: "Avaliações",
    href: "/admin/avaliacoes",
    icon: ClipboardList,
  },
  {
    label: "Jurídico",
    href: "/admin/juridico",
    icon: Scale,
  },
  {
    label: "Incorporação",
    href: "/admin/incorporacao",
    icon: Mountain,
  },
  {
    label: "Configurações",
    href: "/admin/configuracoes",
    icon: Settings,
  },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  /** Item 06: rotas liberadas pelo servidor (perfil + permissões). */
  rotasPermitidas: string[];
  userFoto?: string | null;
  onClose?: () => void;
}

export function Sidebar({ userName, userRole, rotasPermitidas, userFoto, onClose }: SidebarProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => rotasPermitidas.includes(item.href));

  return (
    <aside className="h-full flex flex-col bg-[var(--brand-dark)] w-64">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <span className="text-[var(--brand-yellow)] font-black text-base tracking-wider uppercase block leading-none">
            Grupo Santa Fé
          </span>
          <span className="text-gray-300 text-[9px] tracking-widest uppercase">
            Painel Admin
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Fechar menu" className="text-gray-300 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center mb-2 bg-[var(--brand-yellow)]">
          {userFoto ? (
            <img src={userFoto} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[var(--brand-dark)] font-black text-sm">
              {userName?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-white text-sm font-medium leading-none">{userName}</p>
        <p className="text-gray-300 text-xs mt-0.5 capitalize">{userRole}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {visibleNavItems.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all group",
                    active
                      ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} />
                    {label}
                  </div>
                  {active && <ChevronRight size={13} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2.5 px-3 py-2.5 w-full text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 transition-all"
          >
            <LogOut size={16} />
            Sair do sistema
          </button>
        </form>
      </div>
    </aside>
  );
}
