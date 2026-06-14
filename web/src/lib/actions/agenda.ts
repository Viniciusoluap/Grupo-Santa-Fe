"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarVisita(formData: FormData) {
  await prisma.visita.create({
    data: {
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      agendadaPara: new Date(formData.get("agendadaPara") as string),
      imovelId: (formData.get("imovelId") as string) || undefined,
      corretorId: (formData.get("corretorId") as string) || undefined,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/agenda");
  redirect("/admin/agenda");
}

export async function atualizarStatusVisita(id: string, status: string) {
  await prisma.visita.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/agenda");
}
