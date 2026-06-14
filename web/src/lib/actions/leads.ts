"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarLead(formData: FormData) {
  await prisma.lead.create({
    data: {
      nome: formData.get("nome") as string,
      telefone: formData.get("telefone") as string,
      email: (formData.get("email") as string) || undefined,
      servico: formData.get("servico") as string,
      origem: (formData.get("origem") as string) || "site",
      orcamento: formData.get("orcamento")
        ? parseFloat(formData.get("orcamento") as string)
        : null,
      notas: (formData.get("notas") as string) || "",
      corretorId: (formData.get("corretorId") as string) || undefined,
    },
  });
  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}

export async function adicionarInteracao(formData: FormData) {
  const leadId = formData.get("leadId") as string;
  await prisma.interacao.create({
    data: {
      leadId,
      tipo: formData.get("tipo") as string,
      descricao: formData.get("descricao") as string,
      criadoPor: (formData.get("criadoPor") as string) || "Sistema",
    },
  });
  revalidatePath(`/admin/leads/${leadId}`);
}
