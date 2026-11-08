"use server";
import { randomUUID } from "node:crypto";
import { lerCamposModelo, modeloNovo, montarContrato } from "@/lib/contratos/modelos";
import { opcoesModelosContrato } from "@/lib/contratos/dados";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Operações compartilhadas pelos formulários do módulo Jurídico.
export async function criarContrato(formData: FormData) {
  try {
    await exigirModuloAcao("juridico", { somenteEquipe: true });
    const campos = lerCamposModelo(formData);
    if (!campos.obraId || Object.values(campos).some((v) => v.length > 1000)) throw new Error("Confira os dados do contrato.");
    const dados = montarContrato(campos, await opcoesModelosContrato(campos.obraId));
    const contrato = await prisma.contrato.create({
      data: {
        numero: `GSF-${Date.now()}-${randomUUID().slice(0, 8)}`,
        tipo: dados.tipo, parteA: dados.empresa.nome, parteADoc: dados.empresa.documento,
        parteB: dados.parteB, parteBDoc: dados.parteBDoc, leadId: dados.obra.leadId,
        imovelId: dados.obra.imovelId, obraId: dados.obra.id, empreiteiroId: dados.empreiteiroId,
        corretorId: dados.corretorId, dataAssinatura: dados.dataAssinatura, valor: dados.valor,
        descricao: dados.description, clausulas: dados.clausulas, assinantes: dados.assinaturas,
      },
      select: { id: true },
    });
    revalidatePath("/admin/juridico");
    revalidatePath(`/admin/leads/${dados.obra.leadId}`);
    return { ok: true, id: contrato.id } as const;
  } catch (error) {
    return { ok: false, erro: error instanceof Error ? error.message : "Falha ao criar contrato." } as const;
  }
}

export async function editarContrato(formData: FormData) {
  await exigirModuloAcao("juridico");
  const id = String(formData.get("id"));
  const atual = await prisma.contrato.findUniqueOrThrow({ where: { id }, select: { tipo: true } });
  if (modeloNovo(atual.tipo)) {
    const status = String(formData.get("status"));
    if (!["rascunho", "ativo", "concluido", "vencido", "cancelado"].includes(status)) throw new Error("Status inválido.");
    await prisma.contrato.update({ where: { id }, data: { status } });
    revalidatePath("/admin/juridico");
    return;
  }
  if (modeloNovo(String(formData.get("tipo")))) throw new Error("Crie um novo contrato para usar este modelo.");
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
