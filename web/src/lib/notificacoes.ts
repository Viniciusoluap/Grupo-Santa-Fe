import { prisma } from "@/lib/db";

export async function notificarAdmins(
  tipo: string,
  titulo: string,
  mensagem: string,
  link?: string
) {
  try {
    const admins = await prisma.usuario.findMany({
      where: { papel: { in: ["admin", "colaborador"] }, ativo: true },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notificacao.createMany({
        data: admins.map((u) => ({
          usuarioId: u.id,
          tipo,
          titulo,
          mensagem,
          link,
        })),
      });
    }
  } catch {
    // Silently ignore — notification failures must not break business logic
  }
}

export async function notificarUsuario(
  usuarioId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
  link?: string
) {
  try {
    await prisma.notificacao.create({
      data: { usuarioId, tipo, titulo, mensagem, link },
    });
  } catch {
    // Silently ignore
  }
}
