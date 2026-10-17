import { redirect } from "next/navigation";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";
import { PortalHeader } from "@/components/portal/portal-header";
import { CorretorNav } from "./_components/corretor-nav";

export const dynamic = "force-dynamic";

// Pedido de 18/10: Portal do Corretor igual ao da Prospecta (client/src/pages/
// BrokerPortal.tsx) — cabeçalho dos portais, abas Início, Imóveis, Minhas
// Comissões, Agenda e WhatsApp (as duas últimas abrem no painel, só com os
// registros do corretor).
export default async function CorretorLayout({ children }: { children: React.ReactNode }) {
  const u = await usuarioAtual();
  if (!u?.ativo) redirect("/login");
  if (u.perfil !== "corretor") redirect(destinoDoUsuario(u));
  return (
    <div className="min-h-screen bg-slate-100 text-[var(--brand-dark)]">
      <PortalHeader subtitulo={`Portal do Corretor · ${u.nome ?? ""}`} voltarPara="/corretor" />
      <CorretorNav />
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">{children}</main>
    </div>
  );
}
