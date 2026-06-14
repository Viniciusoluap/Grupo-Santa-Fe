"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function atualizarStatusAgregador(id: string, status: string) {
  await prisma.agregadorImovel.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/agregador");
}
