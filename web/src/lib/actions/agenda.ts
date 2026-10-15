"use server";
import { exigirModuloAcao, type UsuarioDaSessao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Deriva nome/telefone do cliente sempre a partir do Lead selecionado (quando
// houver leadId) — evita que a visita fique com um "nome aleatório" digitado à
// mão, dissociado de um lead real cadastrado no CRM.
// Revisão do Codex (Prospecta #111, mesma regra aqui): o corretor só agenda
// para lead da própria carteira — senão leria nome/telefone de cliente alheio.
async function dadosDoCliente(formData: FormData, u: UsuarioDaSessao): Promise<{ leadId: string | null; clienteNome: string; clienteTel: string }> {
  const leadId = (formData.get("leadId") as string) || null;
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { nome: true, telefone: true, corretorId: true, excluidoEm: true } });
    if (u.perfil === "corretor" && (!lead || lead.excluidoEm || !u.corretorId || lead.corretorId !== u.corretorId))
      throw new Error("Lead não encontrado na sua carteira.");
    if (lead) return { leadId, clienteNome: lead.nome, clienteTel: lead.telefone };
  }
  return {
    leadId: null,
    clienteNome: (formData.get("clienteNome") as string) || "",
    clienteTel: (formData.get("clienteTel") as string) || "",
  };
}

/** Item 06: corretor só mexe nas próprias visitas; o vínculo vem do servidor. */
async function visitaDoUsuario(u: UsuarioDaSessao, id: string) {
  if (u.perfil !== "corretor") return;
  const v = await prisma.visita.findUnique({ where: { id }, select: { corretorId: true } });
  if (!v || !u.corretorId || v.corretorId !== u.corretorId) throw new Error("Visita não encontrada ou acesso não autorizado.");
}

export async function criarVisita(formData: FormData) {
  // Também chamada pelo agendamento do CRM (módulo Leads).
  const u = await exigirModuloAcao(["agenda", "leads"]);
  const corretorId = u.perfil === "corretor" ? (u.corretorId ?? undefined) : ((formData.get("corretorId") as string) || undefined);
  if (u.perfil === "corretor" && !corretorId) throw new Error("Corretor sem vínculo ativo.");
  // Pedido de 15/10: para o corretor, acompanhante vem só da sessão.
  const colaboradorNome = u.perfil === "corretor" ? undefined : (formData.get("colaboradorNome") as string) || undefined;
  const imovelId = (formData.get("imovelId") as string) || undefined;
  const { leadId, clienteNome, clienteTel } = await dadosDoCliente(formData, u);

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
  const u = await exigirModuloAcao("agenda");
  const id = formData.get("id") as string;
  await visitaDoUsuario(u, id);
  const corretorId = u.perfil === "corretor" ? u.corretorId : ((formData.get("corretorId") as string) || null);
  const colaboradorNome = u.perfil === "corretor" ? null : (formData.get("colaboradorNome") as string) || null;
  const imovelId = (formData.get("imovelId") as string) || null;
  const { leadId, clienteNome, clienteTel } = await dadosDoCliente(formData, u);

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
  const u = await exigirModuloAcao("agenda");
  await visitaDoUsuario(u, id);
  await prisma.visita.delete({ where: { id } });
  revalidatePath("/admin/agenda");
}

export async function atualizarStatusVisita(id: string, status: string) {
  const u = await exigirModuloAcao("agenda");
  await visitaDoUsuario(u, id);
  await prisma.visita.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/agenda");
}
