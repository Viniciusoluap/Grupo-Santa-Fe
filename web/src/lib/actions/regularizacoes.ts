"use server";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarRegularizacao(formData: FormData) {
  await prisma.regularizacao.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      endereco: formData.get("endereco") as string,
      responsavel: formData.get("responsavel") as string,
      valorServico: parseFloat(formData.get("valorServico") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
    },
  });
  const nomeReg = formData.get("nome") as string;
  await notificarAdmins("nova_regularizacao", "Nova regularização cadastrada", `${nomeReg} — ${formData.get("clienteNome")}`, "/admin/regularizacao").catch(() => {});
  revalidatePath("/admin/regularizacao");
  redirect("/admin/regularizacao");
}
