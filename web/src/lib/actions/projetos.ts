"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { carregarLeadParaVinculo, clienteParaRegistro, registrarServicoNoLead } from "@/lib/crm/vinculo-lead";
import { dadosClienteDoLead } from "@/lib/crm/servicos-lead";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function alterarStatusProjeto(id: string, status: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.projeto.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarChecklistProjeto(id: string, checklist: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.projeto.update({ where: { id }, data: { checklist } });
  revalidatePath(`/admin/projetos/${id}`);
}

export async function salvarArquivosProjeto(id: string, arquivos: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.projeto.update({ where: { id }, data: { arquivos } });
  revalidatePath(`/admin/projetos/${id}`);
}

export async function alterarStatusProjetoFromDetail(id: string, status: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.projeto.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

export async function criarProjeto(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const tipos = formData.getAll("tipos") as string[];
  // Vínculo real (EPIC-007): sem cadastro avulso — cliente vem do lead.
  const lead = await carregarLeadParaVinculo(formData.get("leadId") as string);
  const cliente = dadosClienteDoLead(lead);
  const leadId = lead.id;

  await prisma.projeto.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: JSON.stringify(tipos.length > 0 ? tipos : ["projeto_arquitetonico"]),
      clienteNome: cliente.clienteNome,
      clienteTel: cliente.clienteTel,
      engenheiro: formData.get("engenheiro") as string,
      valorProjeto: parseFloat(formData.get("valorProjeto") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      leadId,
    },
  });
  await registrarServicoNoLead(leadId, "projeto");
  revalidatePath("/admin/projetos");
  redirect("/admin/projetos");
}

export async function excluirProjeto(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.projeto.delete({ where: { id } });
  revalidatePath("/admin/projetos");
}

export async function editarProjeto(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  const tipos = formData.getAll("tipos") as string[];
  const atual = await prisma.projeto.findUnique({ where: { id }, select: { leadId: true } });
  const cliente = await clienteParaRegistro(atual?.leadId, formData);
  await prisma.projeto.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      tipo: JSON.stringify(tipos.length > 0 ? tipos : ["projeto_arquitetonico"]),
      clienteNome: cliente.clienteNome,
      clienteTel: cliente.clienteTel,
      engenheiro: formData.get("engenheiro") as string,
      valorProjeto: parseFloat(formData.get("valorProjeto") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      prazoEntrega: (formData.get("prazoEntrega") as string) ? new Date(formData.get("prazoEntrega") as string) : null,
    },
  });
  revalidatePath("/admin/projetos");
  redirect(`/admin/projetos/${id}`);
}
