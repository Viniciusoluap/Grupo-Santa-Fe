import { redirect } from "next/navigation";
import { destinoDoUsuario, usuarioAtual } from "@/lib/auth/modulos";
import { PortalHeader } from "@/components/portal/portal-header";

// Acesso do Empreiteiro (EPIC-020 Lote 2, itens 17.2 e 22; redesenho de 15/10/2026).
// Todas as telas de /empreiteiro exigem empreiteiro ativo; cada obra é conferida
// na própria página (lib/obras/acesso-empreiteiro.ts).
export default async function EmpreiteiroLayout({ children }: { children: React.ReactNode }) {
  const u = await usuarioAtual();
  if (!u?.ativo) redirect("/login");
  if (u.perfil !== "empreiteiro") redirect(destinoDoUsuario(u));

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader subtitulo={`Acesso do Empreiteiro · ${u.nome ?? ""}`} voltarPara="/empreiteiro" />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
