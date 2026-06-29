"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function criarLancamento(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const data = formData.get("data") as string;
  const competencia = data.slice(0, 7);

  await prisma.lancamento.create({
    data: {
      tipo: formData.get("tipo") as string,
      categoria: formData.get("categoria") as string,
      descricao: formData.get("descricao") as string,
      valor: parseFloat(formData.get("valor") as string),
      data: new Date(data),
      vencimento: formData.get("vencimento") ? new Date(formData.get("vencimento") as string) : null,
      status: (formData.get("status") as string) || "pendente",
      formaPagamento: (formData.get("formaPagamento") as string) || null,
      referencia: (formData.get("referencia") as string) || null,
      competencia,
      fornecedor: (formData.get("fornecedor") as string) || null,
      observacoes: (formData.get("observacoes") as string) || "",
    },
  });

  revalidatePath("/admin/contabilidade");
}

export async function atualizarStatusLancamento(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  await prisma.lancamento.update({ where: { id }, data: { status } });
  revalidatePath("/admin/contabilidade");
}
