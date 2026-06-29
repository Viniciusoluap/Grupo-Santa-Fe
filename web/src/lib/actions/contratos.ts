"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarContrato(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const numero = `GSF-${Date.now()}`;
  await prisma.contrato.create({
    data: {
      numero,
      tipo: formData.get("tipo") as string,
      parteA: formData.get("parteA") as string,
      parteADoc: (formData.get("parteADoc") as string) || undefined,
      parteB: formData.get("parteB") as string,
      parteBDoc: (formData.get("parteBDoc") as string) || undefined,
      valor: parseFloat(formData.get("valor") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      clausulas: (formData.get("clausulas") as string) || "",
      vencimento: formData.get("vencimento")
        ? new Date(formData.get("vencimento") as string)
        : undefined,
    },
  });
  revalidatePath("/admin/contratos");
  redirect("/admin/contratos");
}

export async function editarContrato(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  await prisma.contrato.update({
    where: { id },
    data: {
      tipo: formData.get("tipo") as string,
      parteA: formData.get("parteA") as string,
      parteADoc: (formData.get("parteADoc") as string) || null,
      parteB: formData.get("parteB") as string,
      parteBDoc: (formData.get("parteBDoc") as string) || null,
      valor: parseFloat(formData.get("valor") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      clausulas: (formData.get("clausulas") as string) || "",
      status: (formData.get("status") as string) || "rascunho",
      vencimento: formData.get("vencimento")
        ? new Date(formData.get("vencimento") as string)
        : null,
    },
  });
  revalidatePath("/admin/contratos");
}

export async function excluirContrato(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.contrato.delete({ where: { id } });
  revalidatePath("/admin/contratos");
}

export async function salvarContratoAssinado(id: string, url: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.contrato.update({ where: { id }, data: { contratoAssinadoUrl: url } });
  revalidatePath("/admin/contratos");
}

export async function alterarStatusContrato(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.contrato.update({ where: { id }, data: { status } });
  revalidatePath("/admin/contratos");
}
