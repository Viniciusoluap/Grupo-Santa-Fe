"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const CHECKLIST_PADRAO = [
  // Documento do Comprador
  { grupo: "Comprador", item: "RG e CPF (cópia autenticada)" },
  { grupo: "Comprador", item: "Certidão de nascimento ou casamento" },
  { grupo: "Comprador", item: "Comprovante de residência (últimos 3 meses)" },
  { grupo: "Comprador", item: "Comprovante de renda (holerite ou IR)" },
  { grupo: "Comprador", item: "Extrato bancário (3 meses)" },
  { grupo: "Comprador", item: "CTPS ou contrato de trabalho" },
  // Documento do Imóvel
  { grupo: "Imóvel", item: "Matrícula atualizada do imóvel" },
  { grupo: "Imóvel", item: "Certidão de ônus e ações reais" },
  { grupo: "Imóvel", item: "IPTU (exercício atual)" },
  { grupo: "Imóvel", item: "Planta baixa aprovada" },
  { grupo: "Imóvel", item: "Habite-se ou auto de conclusão" },
  // Banco
  { grupo: "Banco", item: "Proposta de financiamento assinada" },
  { grupo: "Banco", item: "Laudo de avaliação do imóvel" },
  { grupo: "Banco", item: "Aprovação de crédito" },
  { grupo: "Banco", item: "Minuta do contrato assinada" },
];

export async function criarFinanciamento(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const leadId = (formData.get("leadId") as string) || undefined;
  const imovelVinculadoId = (formData.get("imovelVinculadoId") as string) || undefined;

  const fin = await prisma.financiamento.create({
    data: {
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      clienteEmail: (formData.get("clienteEmail") as string) || undefined,
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
    data: CHECKLIST_PADRAO.map((c) => ({ financiamentoId: fin.id, ...c })),
  });

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
  await prisma.financiamento.update({
    where: { id },
    data: {
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      clienteEmail: (formData.get("clienteEmail") as string) || null,
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
