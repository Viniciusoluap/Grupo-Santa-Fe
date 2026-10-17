"use server";
import { TIPOS_CONTRATO } from "@/lib/juridico/tipos-contrato";
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

/**
 * Item 11 (18/10): contrato criado pelo lead nasce no Jurídico (fonte única),
 * já vinculado ao lead, com os dados do cliente e a numeração do Jurídico.
 */
export async function criarContratoDoLead(leadId: string, tipo: string, valor: number): Promise<{ ok: true; numero: string } | { ok: false; erro: string }> {
  try {
    await exigirModuloAcao("juridico");
    if (!TIPOS_CONTRATO.some((t) => t.value === tipo)) return { ok: false, erro: "Escolha o tipo do contrato." };
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, nome: true, excluidoEm: true } });
    if (!lead || lead.excluidoEm) return { ok: false, erro: "Lead não encontrado no CRM." };
    const numero = `GSF-${Date.now()}`;
    await prisma.contrato.create({
      data: { numero, tipo, parteA: "Grupo Santa Fé", parteB: lead.nome, leadId: lead.id, valor: Number.isFinite(valor) && valor > 0 ? valor : 0 },
    });
    revalidatePath("/admin/juridico");
    revalidatePath(`/admin/leads/${leadId}`);
    return { ok: true, numero };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível criar o contrato." };
  }
}
