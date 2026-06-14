"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarProjeto(formData: FormData) {
  await prisma.projeto.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      engenheiro: formData.get("engenheiro") as string,
      valorProjeto: parseFloat(formData.get("valorProjeto") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
    },
  });
  revalidatePath("/admin/projetos");
  redirect("/admin/projetos");
}
