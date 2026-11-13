export const dynamic = "force-dynamic";

import { exigirModuloPagina } from "@/lib/auth/modulos";
import { CentralVendasClient } from "./_components/central-vendas-client";

// Central de Vendas (paridade com a Prospecta, 13/11): parte do módulo CRM (leads). Corretor não entra;
// configurações só para o administrador (conferido de novo em cada ação no servidor).
export default async function CentralVendasPage() {
  const u = await exigirModuloPagina("leads");
  if (u.perfil !== "admin" && u.perfil !== "colaborador") {
    const { redirect } = await import("next/navigation");
    redirect("/admin");
  }
  return <CentralVendasClient admin={u.perfil === "admin"} />;
}
