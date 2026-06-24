"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarProjeto(formData: FormData) {
  const tipos = formData.getAll("tipos") as string[];
  const leadId = (formData.get("leadId") as string) || undefined;

  await prisma.projeto.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: JSON.stringify(tipos.length > 0 ? tipos : ["projeto_arquitetonico"]),
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      engenheiro: formData.get("engenheiro") as string,
      valorProjeto: parseFloat(formData.get("valorProjeto") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      leadId,
    },
  });
  revalidatePath("/admin/projetos");
  redirect("/admin/projetos");
}
