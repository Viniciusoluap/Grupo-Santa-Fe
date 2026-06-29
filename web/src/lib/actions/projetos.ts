"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function alterarStatusProjeto(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.projeto.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarChecklistProjeto(id: string, checklist: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.projeto.update({ where: { id }, data: { checklist } });
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarArquivosProjeto(id: string, arquivos: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.projeto.update({ where: { id }, data: { arquivos } });
  revalidatePath(`/admin/projetos/${id}`);
}

export async function alterarStatusProjetoFromDetail(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.projeto.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

export async function criarProjeto(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
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

export async function excluirProjeto(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.projeto.delete({ where: { id } });
  revalidatePath("/admin/projetos");
}

export async function editarProjeto(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const tipos = formData.getAll("tipos") as string[];
  await prisma.projeto.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      tipo: JSON.stringify(tipos.length > 0 ? tipos : ["projeto_arquitetonico"]),
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      engenheiro: formData.get("engenheiro") as string,
      valorProjeto: parseFloat(formData.get("valorProjeto") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      prazoEntrega: (formData.get("prazoEntrega") as string) ? new Date(formData.get("prazoEntrega") as string) : null,
    },
  });
  revalidatePath("/admin/projetos");
  redirect(`/admin/projetos/${id}`);
}
