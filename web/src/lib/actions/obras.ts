"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarObra(formData: FormData) {
  await prisma.obra.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      endereco: formData.get("endereco") as string,
      area: parseFloat(formData.get("area") as string) || 0,
      valorTotal: parseFloat(formData.get("valorTotal") as string) || 0,
      engenheiroResp: formData.get("engenheiroResp") as string,
      descricao: (formData.get("descricao") as string) || "",
    },
  });
  revalidatePath("/admin/obras");
  redirect("/admin/obras");
}
