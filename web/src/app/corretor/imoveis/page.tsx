import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/modulos";
import { imoveisDoPortal } from "@/lib/corretor/portal";
import { ImoveisDoCorretor } from "./imoveis-do-corretor";

// Imóveis do Portal do Corretor (igual à Prospecta): catálogo aprovado + os
// próprios cadastros, com cadastro, edição e exclusão só do que ele cadastrou.
export default async function CorretorImoveisPage() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  return <ImoveisDoCorretor imoveis={await imoveisDoPortal(u.id)} />;
}
