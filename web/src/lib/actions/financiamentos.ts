"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { TIPO_CONFIG, BANCO_CONFIG, STATUS_CONFIG } from "@/lib/types/financiamento";
import { exigirConfiguracaoParaStatus, textoObrigatorio, numeroObrigatorio } from "@/lib/crm/configuracao-servico";
import { obterAtorCrm } from "@/lib/crm/acesso-lead";
import { escopoFinanciamentosDoAtor } from "@/lib/crm/acesso-financiamento";
import { financiamentoDoAtor } from "@/lib/crm/acesso-financiamento";
import { prisma } from "@/lib/db";
import { parseServicosLead, servicoDoModulo } from "@/lib/crm/servicos-lead";
import { bloquearLead, transacaoCRM, clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function excluirFinanciamento(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.financiamento.update({ where: { id }, data: { status: "cancelado" } });
  revalidatePath("/admin/financiamentos");
}

export async function editarFinanciamento(formData: FormData) {
  const ator = await obterAtorCrm();
  const id = textoObrigatorio(formData, "id");
  await transacaoCRM(async (tx) => {
    const atual = await tx.financiamento.findFirst({ where: { id, ...escopoFinanciamentosDoAtor(ator) } });
    if (!atual) throw new Error("Financiamento não encontrado ou acesso não autorizado.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    const tipo = textoObrigatorio(formData, "tipo");
    if (tipo !== atual.tipo && !Object.hasOwn(TIPO_CONFIG, tipo)) throw new Error("Modalidade inválida.");
    const banco = textoObrigatorio(formData, "banco");
    if (banco !== atual.banco && !Object.hasOwn(BANCO_CONFIG, banco)) throw new Error("Banco inválido.");
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    await tx.financiamento.update({ where: { id }, data: {
      ...cliente,
      status: atual.status === "aguardando_configuracao" ? "pre_analise" : atual.status,
      clienteCpf: (formData.get("clienteCpf") as string) || null,
      imovel: textoObrigatorio(formData, "imovel"),
      tipo,
      banco,
      valorImovel: numeroObrigatorio(formData, "valorImovel"),
      valorFinanciado: numeroObrigatorio(formData, "valorFinanciado"),
      entrada: numeroObrigatorio(formData, "entrada"),
      taxa: numeroObrigatorio(formData, "taxa"),
      prazo: numeroObrigatorio(formData, "prazo", true),
    } });
    if (atual.leadId && atual.servicoLeadId && tipo !== atual.tipo) {
      const demanda = await tx.servicoLead.findUniqueOrThrow({ where: { id: atual.servicoLeadId } });
      const novoServico = servicoDoModulo("financiamento", tipo);
      await tx.servicoLead.update({ where: { id: demanda.id }, data: { servico: novoServico } });
      const outraDemanda = await tx.servicoLead.findFirst({ where: { leadId: atual.leadId, servico: demanda.servico, id: { not: demanda.id } } });
      const lead = await tx.lead.findUniqueOrThrow({ where: { id: atual.leadId } });
      let servicos = parseServicosLead(lead.servico);
      if (!outraDemanda) servicos = servicos.filter((s) => s !== demanda.servico);
      if (!servicos.includes(novoServico)) servicos.push(novoServico);
      await tx.lead.update({ where: { id: atual.leadId }, data: { servico: JSON.stringify(servicos) } });
      await tx.interacao.create({ data: { leadId: atual.leadId, tipo: "nota", descricao: `Modalidade do financiamento ${id}: ${atual.tipo} → ${tipo}.`, criadoPor: ator.nome } });
    }
  });
  revalidatePath("/admin/financiamentos");
  revalidatePath("/admin/leads");
  redirect(`/admin/financiamentos/${id}`);
}

export async function toggleChecklistItem(id: string, concluido: boolean, financiamentoId: string) {
  await financiamentoDoAtor(financiamentoId);
  await prisma.checklistItem.update({ where: { id, financiamentoId }, data: { concluido } });
  revalidatePath(`/admin/financiamentos/${financiamentoId}`);
}

export async function atualizarNotasChecklist(id: string, notas: string, financiamentoId: string) {
  await financiamentoDoAtor(financiamentoId);
  await prisma.checklistItem.update({ where: { id, financiamentoId }, data: { notas } });
  revalidatePath(`/admin/financiamentos/${financiamentoId}`);
}

export async function alterarStatusFinanciamento(id: string, status: string) {
  const registro = await financiamentoDoAtor(id);
  exigirConfiguracaoParaStatus(registro, status, ['imovel', 'banco', 'valorImovel', 'valorFinanciado', 'entrada', 'taxa', 'prazo'], STATUS_CONFIG);
  await prisma.financiamento.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/financiamentos/${id}`);
  revalidatePath("/admin/financiamentos");
}
