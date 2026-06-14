"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function salvarConfiguracao(chave: string, valor: string) {
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor, grupo: "geral" },
    update: { valor },
  });
  revalidatePath("/admin/configuracoes");
}
