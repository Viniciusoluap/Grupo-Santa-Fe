export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AdminShell } from "./_components/admin-shell";
import { destinoDoUsuario, MODULOS_PAINEL, usuarioAtual } from "@/lib/auth/modulos";
import { areaDoPerfil, podeAcessarModulo, podeAdministrarSeguranca } from "@/lib/perfis-acesso";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Itens 02 e 06: perfil, situação e permissões vêm do banco a cada acesso.
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.ativo) redirect("/login");
  const area = areaDoPerfil(usuario.perfil);
  // O corretor usa o Portal do Corretor; no painel abre só Agenda e WhatsApp
  // (igual à Prospecta, pedido de 18/10).
  if (area !== "painel" && area !== "corretor") redirect(destinoDoUsuario(usuario));

  const rotasPermitidas = usuario.perfil === "corretor"
    ? ["/corretor", "/admin/agenda", "/admin/whatsapp"]
    : MODULOS_PAINEL.filter((m) => podeAcessarModulo(usuario, m.id)).map((m) => m.rota as string);
  if (podeAdministrarSeguranca(usuario)) rotasPermitidas.push("/admin/configuracoes", "/admin/integracoes");

  return <AdminShell rotasPermitidas={rotasPermitidas}>{children}</AdminShell>;
}
