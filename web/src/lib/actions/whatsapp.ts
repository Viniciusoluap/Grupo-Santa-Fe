"use server";
import { auth } from "@/auth";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";

// O parametro usuarioId recebido do cliente e' ignorado deliberadamente: a UI
// so chama esta action com o proprio usuarioId (session.user.id), mas a action
// em si nao validava isso - uma chamada direta com outro usuarioId conseguia
// sobrescrever o token/numero da conexao WhatsApp Business de qualquer outro
// usuario (inclusive um admin), ja que so checava `if (!session)`.
export async function salvarConexaoBusiness(_usuarioId: string, token: string, phoneNumberId: string, numero: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const sessao = session.user as { id?: string; role?: string };
  if (!sessao.id) throw new Error("Não autorizado");
  // Pedido de 17/10/2026: o colaborador com WhatsApp configura a conexão da empresa (a do admin).
  if (sessao.role === "colaborador") await exigirModuloAcao("whatsapp");
  const usuarioId = await donoDaConexaoWhatsApp(sessao.id, sessao.role);
  if (!usuarioId) throw new Error("Nenhum administrador para guardar a conexão da empresa.");
  await prisma.conexaoWhatsApp.upsert({
    where: { usuarioId },
    create: { usuarioId, provedor: "business", token, phoneNumberId, numero, status: "conectado" },
    update: { provedor: "business", token, phoneNumberId, numero, status: "conectado", instancia: null, qrCode: null },
  });
  revalidatePath("/admin/whatsapp");
}
