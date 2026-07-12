"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Deriva nome/telefone do cliente sempre a partir do Lead selecionado (quando
// houver leadId) — evita que a visita fique com um "nome aleatório" digitado à
// mão, dissociado de um lead real cadastrado no CRM.
async function dadosDoCliente(formData: FormData): Promise<{ leadId: string | null; clienteNome: string; clienteTel: string }> {
  const leadId = (formData.get("leadId") as string) || null;
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { nome: true, telefone: true } });
    if (lead) return { leadId, clienteNome: lead.nome, clienteTel: lead.telefone };
  }
  return {
    leadId: null,
    clienteNome: (formData.get("clienteNome") as string) || "",
    clienteTel: (formData.get("clienteTel") as string) || "",
  };
}

export async function criarVisita(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const corretorId = (formData.get("corretorId") as string) || undefined;
  const colaboradorNome = (formData.get("colaboradorNome") as string) || undefined;
  const imovelId = (formData.get("imovelId") as string) || undefined;
  const { leadId, clienteNome, clienteTel } = await dadosDoCliente(formData);

  await prisma.visita.create({
    data: {
      clienteNome,
      clienteTel,
      leadId,
      agendadaPara: new Date(formData.get("agendadaPara") as string),
      tipoVisita: (formData.get("tipoVisita") as string) || "imovel",
      imovelId: imovelId || null,
      corretorId: corretorId || null,
      colaboradorNome: colaboradorNome || null,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/agenda");
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
}

export async function editarVisita(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const corretorId = (formData.get("corretorId") as string) || null;
  const colaboradorNome = (formData.get("colaboradorNome") as string) || null;
  const imovelId = (formData.get("imovelId") as string) || null;
  const { leadId, clienteNome, clienteTel } = await dadosDoCliente(formData);

  await prisma.visita.update({
    where: { id },
    data: {
      clienteNome,
      clienteTel,
      leadId,
      agendadaPara: new Date(formData.get("agendadaPara") as string),
      tipoVisita: (formData.get("tipoVisita") as string) || "imovel",
      imovelId,
      corretorId,
      colaboradorNome,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/agenda");
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
}

export async function excluirVisita(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.visita.delete({ where: { id } });
  revalidatePath("/admin/agenda");
}

export async function atualizarStatusVisita(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.visita.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/agenda");
}
