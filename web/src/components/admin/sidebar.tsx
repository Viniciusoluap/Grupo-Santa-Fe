"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  LogOut,
  ChevronRight,
  Settings,
  FileText,
  Calculator,
  CalendarDays,
  BadgeDollarSign,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
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
    label: "Contratos",
    href: "/admin/contratos",
    icon: FileText,
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
  onClose?: () => void;
}

export function Sidebar({ userName, userRole, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="h-full flex flex-col bg-[var(--brand-dark)] w-64">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <span className="text-[var(--brand-yellow)] font-black text-base tracking-wider uppercase block leading-none">
            Grupo Santa Fé
          </span>
          <span className="text-gray-500 text-[9px] tracking-widest uppercase">
            Painel Admin
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="w-9 h-9 bg-[var(--brand-yellow)] rounded-full flex items-center justify-center mb-2">
          <span className="text-[var(--brand-dark)] font-black text-sm">
            {userName?.[0]?.toUpperCase()}
          </span>
        </div>
        <p className="text-white text-sm font-medium leading-none">{userName}</p>
        <p className="text-gray-500 text-xs mt-0.5 capitalize">{userRole}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map(({ label, href, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
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
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2.5 px-3 py-2.5 w-full text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 transition-all"
        >
          <LogOut size={16} />
          Sair do sistema
        </button>
      </div>
    </aside>
  );
}
