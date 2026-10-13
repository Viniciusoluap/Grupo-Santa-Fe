"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { PROJETO_TIPO_CONFIG, PROJETO_STATUS_CONFIG } from "@/lib/types/projeto";
import { exigirConfiguracaoParaStatus, textoObrigatorio, numeroObrigatorio, tiposObrigatorios } from "@/lib/crm/configuracao-servico";
import { prisma } from "@/lib/db";
import { bloquearLead, transacaoCRM, clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function alterarStatusProjeto(id: string, status: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  const registro = await prisma.projeto.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ['tipo', 'engenheiro', 'valorProjeto'], PROJETO_STATUS_CONFIG);
  await prisma.projeto.update({ where: { id }, data: { status } });
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
  const registro = await prisma.projeto.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ["tipo", "engenheiro", "valorProjeto"], PROJETO_STATUS_CONFIG);
  await prisma.projeto.update({ where: { id }, data: { status } });
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
}

/** Exclusão definitiva (item 03): some das listas, pesquisas e totais. Bloqueada quando há guarda financeira. */
export async function excluirProjeto(id: string) {
  return capturarErroAcao(async () => {
    const session = await auth();
    requireActionRole(session, "admin");
    const r = await excluirServicoDefinitivo("projeto", id);
    revalidatePath("/admin/projetos");
    revalidatePath("/admin/leads");
    return r;
  });
}

/** Cancelar mantém o registro e o histórico; só muda a situação. */
export async function cancelarProjeto(id: string) {
  return capturarErroAcao(async () => {
    const session = await auth();
    requireActionRole(session, "admin");
    const r = await prisma.projeto.updateMany({ where: { id, status: { not: "cancelado" } }, data: { status: "cancelado" } });
    revalidatePath("/admin/projetos");
    return { cancelado: r.count > 0 };
  });
}

export async function editarProjeto(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    const atual = await tx.projeto.findUnique({ where: { id }, select: { leadId: true, status: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    await tx.projeto.update({
      where: { id },
      data: {
        nome: textoObrigatorio(formData, "nome"),
        tipo: tiposObrigatorios(formData, PROJETO_TIPO_CONFIG),
        status: atual.status === "aguardando_configuracao" ? "solicitado" : atual.status,
        clienteNome: cliente.clienteNome,
        clienteTel: cliente.clienteTel,
        engenheiro: textoObrigatorio(formData, "engenheiro"),
        valorProjeto: numeroObrigatorio(formData, "valorProjeto"),
        descricao: (formData.get("descricao") as string) || "",
        prazoEntrega: (formData.get("prazoEntrega") as string) ? new Date(formData.get("prazoEntrega") as string) : null,
      },
    });
  });
  revalidatePath("/admin/projetos");
  redirect(`/admin/projetos/${id}`);
}
