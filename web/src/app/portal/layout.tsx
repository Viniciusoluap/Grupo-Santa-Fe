import Link from "next/link";
import { redirect } from "next/navigation";
import { Home, FileText, CalendarDays, MessageSquare, LogOut } from "lucide-react";
import { auth } from "@/auth";

const portalNav = [
  { href: "/portal", label: "Início", icon: Home },
  { href: "/portal/documentos", label: "Documentos", icon: FileText },
  { href: "/portal/visitas", label: "Visitas", icon: CalendarDays },
  { href: "/portal/acompanhamento", label: "Acompanhamento", icon: MessageSquare },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[var(--brand-dark)] border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[var(--brand-yellow)] font-black tracking-wider uppercase text-sm">Grupo Santa Fé</span>
            <span className="text-white/20">|</span>
            <span className="text-gray-400 text-xs font-medium">Portal do Cliente</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-xs hidden sm:block">{session.user?.name}</span>
            <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-[var(--brand-yellow)] text-xs font-medium transition-colors">
              <LogOut size={13} /> Sair
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar nav */}
          <aside className="hidden md:block w-52 shrink-0">
            <nav className="bg-white border border-gray-100 overflow-hidden">
              {portalNav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-[var(--brand-dark)] border-b border-gray-50 last:border-0 transition-colors"
                >
                  <Icon size={15} className="text-[var(--brand-yellow)]" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 bg-[var(--brand-yellow)] p-4">
              <p className="text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wide mb-2">Seu Corretor</p>
              <p className="text-[var(--brand-dark)] font-bold text-sm">Grupo Santa Fé</p>
              <a href="tel:+5594993044689" className="text-[var(--brand-dark)]/70 text-xs hover:text-[var(--brand-dark)] mt-1 block">(94) 99304-4689</a>
              <a
                href="https://wa.me/5594993044689"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1 bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-wider py-2 hover:bg-[var(--brand-dark)]/80 transition-colors"
              >
                <MessageSquare size={12} /> WhatsApp
              </a>
            </div>
          </aside>

          {/* Mobile nav */}
          <div className="md:hidden w-full mb-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {portalNav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-100 text-xs font-bold text-gray-500 whitespace-nowrap hover:border-[var(--brand-yellow)] hover:text-[var(--brand-dark)] transition-colors"
                >
                  <Icon size={13} /> {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
