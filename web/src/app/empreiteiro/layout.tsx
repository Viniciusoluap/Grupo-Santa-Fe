import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";
import { logoutAction } from "@/app/admin/logout-action";

// Acesso do Empreiteiro (EPIC-020 Lote 2, itens 17.2 e 22; redesenho de 15/10/2026).
// Todas as telas de /empreiteiro exigem empreiteiro ativo; cada obra é conferida
// na própria página (lib/obras/acesso-empreiteiro.ts).
export default async function EmpreiteiroLayout({ children }: { children: React.ReactNode }) {
  const u = await usuarioAtual();
  if (!u?.ativo) redirect("/login");
  if (u.perfil !== "empreiteiro") redirect(destinoDoUsuario(u));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[var(--brand-dark)] border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[var(--brand-yellow)] font-black tracking-wider uppercase text-sm">Grupo Santa Fé</span>
            <span className="text-white/20">|</span>
            <span className="text-gray-400 text-xs font-medium">Acesso do Empreiteiro</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-xs hidden sm:block">{u.nome}</span>
            <form action={logoutAction}>
              <button type="submit" className="flex items-center gap-1 text-gray-400 hover:text-[var(--brand-yellow)] text-xs font-medium transition-colors">
                <LogOut size={13} /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
