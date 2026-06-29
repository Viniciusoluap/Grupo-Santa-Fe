"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function salvarConfiguracao(chave: string, valor: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor, grupo: "geral" },
    update: { valor },
  });
  revalidatePath("/admin/configuracoes");
}
