"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function salvarConfiguracao(chave: string, valor: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor, grupo: "geral" },
    update: { valor },
  });
  revalidatePath("/admin/configuracoes");
}
