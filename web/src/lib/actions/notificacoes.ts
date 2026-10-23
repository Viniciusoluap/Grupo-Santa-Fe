"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth/modulos";

/** Pedido de 23/10 (H4): "Ver todas" marca como lida a notificação aberta (igual à Prospecta). */
export async function marcarNotificacaoLida(id: string) {
  const usuario = await usuarioAtual();
  if (!usuario?.ativo) throw new Error("Não autorizado.");
  await prisma.notificacao.updateMany({ where: { id, usuarioId: usuario.id }, data: { lida: true } });
  revalidatePath("/admin/notificacoes");
}

export async function marcarTodasNotificacoesLidas() {
  const usuario = await usuarioAtual();
  if (!usuario?.ativo) throw new Error("Não autorizado.");
  await prisma.notificacao.updateMany({ where: { usuarioId: usuario.id, lida: false }, data: { lida: true } });
  revalidatePath("/admin/notificacoes");
}
