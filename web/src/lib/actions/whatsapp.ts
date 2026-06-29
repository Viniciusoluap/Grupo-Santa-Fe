"use server";
import { auth } from "@/auth";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function salvarConexaoBusiness(usuarioId: string, token: string, phoneNumberId: string, numero: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.conexaoWhatsApp.upsert({
    where: { usuarioId },
    create: { usuarioId, provedor: "business", token, phoneNumberId, numero, status: "conectado" },
    update: { provedor: "business", token, phoneNumberId, numero, status: "conectado", instancia: null, qrCode: null },
  });
  revalidatePath("/admin/whatsapp");
}
