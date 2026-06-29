"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function alterarStatusRegularizacao(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.regularizacao.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/regularizacao");
  revalidatePath(`/admin/regularizacao/${id}`);
}

export async function adicionarDocumentoReg(regularizacaoId: string, nome: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.regDocumento.create({
    data: { regularizacaoId, nome, status: "pendente" },
  });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

export async function atualizarStatusDocumento(id: string, status: string, regularizacaoId: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.regDocumento.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

export async function excluirDocumentoReg(id: string, regularizacaoId: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.regDocumento.delete({ where: { id } });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

export async function criarRegularizacao(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
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
  revalidatePath("/admin/regularizacao");
  redirect("/admin/regularizacao");
}
