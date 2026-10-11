"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CHECKLIST_FINANCIAMENTO_PADRAO, carregarLeadParaVinculo, clienteParaRegistro, registrarServicoNoLead } from "@/lib/crm/vinculo-lead";
import { dadosClienteDoLead } from "@/lib/crm/servicos-lead";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarFinanciamento(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  // Vínculo real (EPIC-007): financiamento só nasce para um lead do CRM; nome,
  // telefone e e-mail vêm do lead. CPF (que o lead não tem) é complemento.
  const lead = await carregarLeadParaVinculo(formData.get("leadId") as string);
  const leadId = lead.id;
  const imovelVinculadoId = (formData.get("imovelVinculadoId") as string) || undefined;

  const fin = await prisma.financiamento.create({
    data: {
      ...dadosClienteDoLead(lead),
      clienteCpf: (formData.get("clienteCpf") as string) || undefined,
      imovel: formData.get("imovel") as string,
      tipo: formData.get("tipo") as string,
      banco: formData.get("banco") as string,
      valorImovel: parseFloat(formData.get("valorImovel") as string) || 0,
      valorFinanciado: parseFloat(formData.get("valorFinanciado") as string) || 0,
      entrada: parseFloat(formData.get("entrada") as string) || 0,
      taxa: parseFloat(formData.get("taxa") as string) || 0,
      prazo: parseInt(formData.get("prazo") as string) || 360,
      leadId,
      imovelVinculadoId,
    },
  });

  await prisma.checklistItem.createMany({
    data: CHECKLIST_FINANCIAMENTO_PADRAO.map((c) => ({ financiamentoId: fin.id, ...c })),
  });
  await registrarServicoNoLead(leadId, "financiamento", fin.tipo);

  await notificarAdmins("novo_financiamento", "Novo financiamento cadastrado", `${fin.clienteNome} — ${fin.banco}`, "/admin/financiamentos").catch(() => {});
  revalidatePath("/admin/financiamentos");
  redirect(`/admin/financiamentos/${fin.id}`);
}

export async function excluirFinanciamento(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.financiamento.delete({ where: { id } });
  revalidatePath("/admin/financiamentos");
}

export async function editarFinanciamento(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const atual = await prisma.financiamento.findUnique({ where: { id }, select: { leadId: true } });
  const cliente = await clienteParaRegistro(atual?.leadId, formData);
  await prisma.financiamento.update({
    where: { id },
    data: {
      ...cliente,
      clienteCpf: (formData.get("clienteCpf") as string) || null,
      imovel: formData.get("imovel") as string,
      tipo: formData.get("tipo") as string,
      banco: formData.get("banco") as string,
      valorImovel: parseFloat(formData.get("valorImovel") as string) || 0,
      valorFinanciado: parseFloat(formData.get("valorFinanciado") as string) || 0,
      entrada: parseFloat(formData.get("entrada") as string) || 0,
      taxa: parseFloat(formData.get("taxa") as string) || 0,
      prazo: parseInt(formData.get("prazo") as string) || 360,
    },
  });
  revalidatePath("/admin/financiamentos");
  redirect(`/admin/financiamentos/${id}`);
}

export async function toggleChecklistItem(id: string, concluido: boolean, financiamentoId: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.checklistItem.update({ where: { id }, data: { concluido } });
  revalidatePath(`/admin/financiamentos/${financiamentoId}`);
}

export async function atualizarNotasChecklist(id: string, notas: string, financiamentoId: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.checklistItem.update({ where: { id }, data: { notas } });
  revalidatePath(`/admin/financiamentos/${financiamentoId}`);
}

export async function alterarStatusFinanciamento(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.financiamento.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/financiamentos/${id}`);
  revalidatePath("/admin/financiamentos");
}
