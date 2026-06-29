"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarRegularizacao(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const tipos = formData.getAll("tipos") as string[];
  const leadId = (formData.get("leadId") as string) || undefined;

  await prisma.regularizacao.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: JSON.stringify(tipos.length > 0 ? tipos : ["regularizacao_escritura"]),
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      endereco: formData.get("endereco") as string,
      responsavel: formData.get("responsavel") as string,
      valorServico: parseFloat(formData.get("valorServico") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      leadId,
    },
  });
  const nomeReg = formData.get("nome") as string;
  await notificarAdmins("nova_regularizacao", "Nova regularização cadastrada", `${nomeReg} — ${formData.get("clienteNome")}`, "/admin/regularizacao").catch(() => {});
  revalidatePath("/admin/regularizacao");
  redirect("/admin/regularizacao");
}

export async function excluirRegularizacao(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.regularizacao.delete({ where: { id } });
  revalidatePath("/admin/regularizacao");
}

export async function editarRegularizacao(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  await prisma.regularizacao.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      status: formData.get("status") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      endereco: formData.get("endereco") as string,
      responsavel: formData.get("responsavel") as string,
      valorServico: parseFloat(formData.get("valorServico") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      matricula: (formData.get("matricula") as string) || null,
      previsaoFim: (formData.get("previsaoFim") as string) ? new Date(formData.get("previsaoFim") as string) : null,
    },
  });
  revalidatePath("/admin/regularizacao");
  redirect(`/admin/regularizacao/${id}`);
}
