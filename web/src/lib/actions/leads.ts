"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarLead(formData: FormData) {
  const servicos = formData.getAll("servicos") as string[];
  await prisma.lead.create({
    data: {
      nome: formData.get("nome") as string,
      telefone: formData.get("telefone") as string,
      email: (formData.get("email") as string) || undefined,
      servico: JSON.stringify(servicos.length > 0 ? servicos : ["Outro"]),
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

export async function enviarContato(formData: FormData) {
  const nome = formData.get("nome") as string;
  const telefone = formData.get("telefone") as string;
  const email = (formData.get("email") as string) || undefined;
  const servicos = formData.getAll("servicos") as string[];
  const mensagem = (formData.get("mensagem") as string) || "";

  if (!nome || !telefone || servicos.length === 0) return;

  await prisma.lead.create({
    data: {
      nome, telefone, email,
      servico: JSON.stringify(servicos),
      origem: "site",
      notas: mensagem,
    },
  });
  revalidatePath("/admin/leads");
  redirect("/contato?enviado=1");
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
