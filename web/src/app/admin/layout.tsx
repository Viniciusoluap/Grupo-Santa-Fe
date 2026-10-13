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
  // No Santa Fé o corretor usa o próprio painel, limitado aos 4 módulos dele.
  if (area !== "painel" && area !== "corretor") redirect(destinoDoUsuario(usuario));

  const rotasPermitidas = MODULOS_PAINEL.filter((m) => podeAcessarModulo(usuario, m.id)).map((m) => m.rota as string);
  if (podeAdministrarSeguranca(usuario)) rotasPermitidas.push("/admin/configuracoes");

  return <AdminShell rotasPermitidas={rotasPermitidas}>{children}</AdminShell>;
}
