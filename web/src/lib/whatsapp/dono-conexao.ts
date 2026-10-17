import { prisma } from "@/lib/db";

/**
 * Dono da conexão WhatsApp usada pelo usuário: o colaborador usa (e configura) a
 * conexão da empresa, que é a do admin; os demais, a própria. Gêmeo de
 * `donoDaConexao` em Prospecta/server/whatsapp-router.ts.
 */
export async function donoDaConexaoWhatsApp(usuarioId: string, perfil: string | null | undefined): Promise<string | null> {
  if (perfil !== "colaborador") return usuarioId;
  const admin = await prisma.usuario.findFirst({ where: { papel: "admin" }, select: { id: true }, orderBy: { criadoEm: "asc" } });
  return admin?.id ?? null;
}
