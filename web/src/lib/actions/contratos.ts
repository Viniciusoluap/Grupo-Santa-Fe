"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Operações compartilhadas pelos formulários do módulo Jurídico.
export async function criarContrato(formData: FormData) {
  await exigirModuloAcao("juridico");
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
  revalidatePath("/admin/juridico");
  redirect("/admin/juridico");
}

export async function editarContrato(formData: FormData) {
  await exigirModuloAcao("juridico");
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
  revalidatePath("/admin/juridico");
}

export async function excluirContrato(id: string) {
  await exigirModuloAcao("juridico", { somenteEquipe: true });
  await prisma.contrato.delete({ where: { id } });
  revalidatePath("/admin/juridico");
}
