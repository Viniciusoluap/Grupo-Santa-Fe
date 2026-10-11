"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { carregarLeadParaVinculo, clienteParaRegistro, registrarServicoNoLead } from "@/lib/crm/vinculo-lead";
import { dadosClienteDoLead } from "@/lib/crm/servicos-lead";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarRegularizacao(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const tipos = formData.getAll("tipos") as string[];
  // Vínculo real (EPIC-007): sem processo avulso — cliente vem do lead.
  const lead = await carregarLeadParaVinculo(formData.get("leadId") as string);
  const cliente = dadosClienteDoLead(lead);
  const leadId = lead.id;

  await prisma.regularizacao.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: JSON.stringify(tipos.length > 0 ? tipos : ["regularizacao_escritura"]),
      clienteNome: cliente.clienteNome,
      clienteTel: cliente.clienteTel,
      endereco: formData.get("endereco") as string,
      responsavel: formData.get("responsavel") as string,
      valorServico: parseFloat(formData.get("valorServico") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      leadId,
    },
  });
  await registrarServicoNoLead(leadId, "regularizacao");
  const nomeReg = formData.get("nome") as string;
  await notificarAdmins("nova_regularizacao", "Nova regularização cadastrada", `${nomeReg} — ${cliente.clienteNome}`, "/admin/regularizacao").catch(() => {});
  revalidatePath("/admin/regularizacao");
  redirect("/admin/regularizacao");
}

export async function excluirRegularizacao(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.regularizacao.delete({ where: { id } });
  revalidatePath("/admin/regularizacao");
}

export async function editarRegularizacao(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  const atual = await prisma.regularizacao.findUnique({ where: { id }, select: { leadId: true } });
  const cliente = await clienteParaRegistro(atual?.leadId, formData);
  await prisma.regularizacao.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      status: formData.get("status") as string,
      clienteNome: cliente.clienteNome,
      clienteTel: cliente.clienteTel,
      endereco: formData.get("endereco") as string,
      responsavel: formData.get("responsavel") as string,
      valorServico: parseFloat(formData.get("valorServico") as string) || 0,
      descricao: (formData.get("descricao") as string) || "",
      matricula: (formData.get("matricula") as string) || null,
      previsaoFim: (formData.get("previsaoFim") as string) ? new Date(formData.get("previsaoFim") as string) : null,
    },
  });
  revalidatePath("/admin/regularizacao");
  redirect(`/admin/regularizacao/${id}`);
}
