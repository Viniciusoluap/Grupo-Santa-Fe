export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ConsentimentoNoLogin } from "@/components/consentimento/consentimento-no-login";
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
  // Central de Vendas (paridade com a Prospecta, 13/11): faz parte do módulo CRM; corretor não entra.
  if (usuario.perfil !== "corretor" && podeAcessarModulo(usuario, "leads")) rotasPermitidas.push("/admin/central-vendas");
  if (podeAdministrarSeguranca(usuario)) rotasPermitidas.push("/admin/configuracoes", "/admin/integracoes");

  // Paridade 17/11 bloco 4: termo de consentimento ao entrar (só quando o servidor diz que é preciso).
  return <><AdminShell rotasPermitidas={rotasPermitidas}>{children}</AdminShell><ConsentimentoNoLogin usuarioId={usuario.id} /></>;
}
