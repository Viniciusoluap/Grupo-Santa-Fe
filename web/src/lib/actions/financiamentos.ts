"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Lote 3 — Financiamentos originados exclusivamente no CRM.
//
// Criação avulsa de financiamento foi REMOVIDA (não existe mais UI para
// isso: ver .../admin/financiamentos — sem botão "Novo financiamento"). Esta
// action é bloqueada também no servidor como segunda linha de defesa: ainda
// que alguém chame diretamente o endpoint da Server Action (sem passar pela
// UI), a criação continua rejeitada.
//
// O único jeito de um financiamento nascer é vinculando o serviço de
// financiamento a um lead no CRM — ver @/lib/crm/vinculo-lead.ts
// (sincronizarServicosDoLead/criarRegistro, EPIC-007), usado por
// @/lib/actions/leads.ts (criarLead / editarLead).
export async function criarFinanciamento(_formData: FormData): Promise<never> {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  throw new Error(
    "Criação avulsa de financiamento não é permitida. Vincule o serviço de financiamento (\"Financiamento MCMV\" ou \"Financiamento Convencional\") ao lead no CRM para criar o processo automaticamente."
  );
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
