"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarComissao(formData: FormData) {
  const vencimentoStr = formData.get("vencimento") as string;
  const pagamentoStr = formData.get("pagamentoEm") as string;

  await prisma.comissao.create({
    data: {
      corretorId: formData.get("corretorId") as string,
      imovel: formData.get("imovel") as string,
      valor: parseFloat(formData.get("valor") as string),
      percentual: parseFloat((formData.get("percentual") as string) || "6"),
      status: (formData.get("status") as string) || "pendente",
      vencimento: new Date(vencimentoStr),
      pagamentoEm: pagamentoStr ? new Date(pagamentoStr) : null,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/comissoes");
  redirect("/admin/comissoes");
}

export async function editarComissao(formData: FormData) {
  const id = formData.get("id") as string;
  const vencimentoStr = formData.get("vencimento") as string;
  const pagamentoStr = formData.get("pagamentoEm") as string;

  await prisma.comissao.update({
    where: { id },
    data: {
      corretorId: formData.get("corretorId") as string,
      imovel: formData.get("imovel") as string,
      valor: parseFloat(formData.get("valor") as string),
      percentual: parseFloat((formData.get("percentual") as string) || "6"),
      status: (formData.get("status") as string) || "pendente",
      vencimento: new Date(vencimentoStr),
      pagamentoEm: pagamentoStr ? new Date(pagamentoStr) : null,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/comissoes");
  redirect("/admin/comissoes");
}

export async function excluirComissao(id: string) {
  await prisma.comissao.delete({ where: { id } });
  revalidatePath("/admin/comissoes");
}
