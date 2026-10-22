"use server";
import { prisma } from "@/lib/db";
import { obterAtorCrm, exigirAtorInterno } from "@/lib/crm/acesso-lead";
import { revalidatePath } from "next/cache";

export async function editarTarefaCrm(id: string, input: { titulo?: string; status?: string; prazo?: string | null }) {
  exigirAtorInterno(await obterAtorCrm());
  const tarefa = await prisma.tarefaCrm.findUnique({ where: { id }, select: { leadId: true } });
  if (!tarefa) throw new Error("Tarefa não encontrada.");
  if (input.titulo !== undefined && (!input.titulo.trim() || input.titulo.length > 255)) throw new Error("Título inválido.");
  if (input.status !== undefined && !["pendente", "em_andamento", "concluida", "cancelada"].includes(input.status)) throw new Error("Status inválido.");
  const date = input.prazo ? new Date(input.prazo) : null;
  if (input.prazo && Number.isNaN(date?.getTime())) throw new Error("Prazo inválido.");
  await prisma.tarefaCrm.update({ where: { id }, data: {
    ...(input.titulo !== undefined ? { titulo: input.titulo.trim() } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.prazo !== undefined ? { prazo: date } : {}),
  } });
  revalidatePath("/admin/agenda");
  revalidatePath(`/admin/leads/${tarefa.leadId}`);
}
