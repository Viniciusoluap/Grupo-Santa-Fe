"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { auth } from "@/auth";
import { TIPO_CONFIG, BANCO_CONFIG, STATUS_CONFIG } from "@/lib/types/financiamento";
import { textoObrigatorio, numeroObrigatorio } from "@/lib/crm/configuracao-servico";
import { obterAtorCrm } from "@/lib/crm/acesso-lead";
import { escopoFinanciamentosDoAtor } from "@/lib/crm/acesso-financiamento";
import { financiamentoDoAtor } from "@/lib/crm/acesso-financiamento";
import { prisma } from "@/lib/db";
import { parseServicosLead, servicoDoModulo } from "@/lib/crm/servicos-lead";
import { bloquearLead, transacaoCRM, clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { sincronizarVgvDoLead } from "@/lib/financeiro/vgv-lead";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Mantém a antiga Server Action como bloqueio explícito para chamadas
// originadas de formulários antigos; a criação ocorre somente pelo CRM.
export async function criarFinanciamento(_formData: FormData): Promise<never> {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  throw new Error(
    "Criação avulsa de financiamento não é permitida. Vincule o serviço de financiamento (\"Financiamento MCMV\" ou \"Financiamento Convencional\") ao lead no CRM para criar o processo automaticamente."
  );
}
/** Exclusão definitiva (item 03 + pedido A6): some das listas, pesquisas e totais, junto com os lançamentos. */
export async function excluirFinanciamento(id: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("financiamentos", { somenteEquipe: true });
    const r = await excluirServicoDefinitivo("financiamento", id);
    revalidatePath("/admin/financiamentos");
    revalidatePath("/admin/leads");
    return r;
  });
}

export async function editarFinanciamento(formData: FormData) {
  const ator = await obterAtorCrm("financiamentos");
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
    const valorImovel = numeroObrigatorio(formData, "valorImovel");
    const valorFinanciado = numeroObrigatorio(formData, "valorFinanciado");
    if (valorFinanciado > valorImovel) throw new Error("O valor financiado não pode superar o VGV simulado.");
    await tx.financiamento.update({ where: { id }, data: {
      ...cliente,
      status: atual.status === "aguardando_configuracao" ? "pre_analise" : atual.status,
      clienteCpf: atual.leadId ? (await tx.lead.findUniqueOrThrow({where:{id:atual.leadId},select:{cpf:true}})).cpf : (formData.get("clienteCpf") as string) || null,
      tipo,
      banco,
      valorImovel,
      valorFinanciado,
    } });
    if (atual.leadId) {
      await tx.lead.update({ where: { id: atual.leadId }, data: { orcamento: valorImovel, valorAprovado: valorFinanciado } });
      await tx.financiamento.updateMany({ where: { leadId: atual.leadId }, data: { valorImovel, valorFinanciado } });
      await sincronizarVgvDoLead(atual.leadId, tx);
    }
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

/**
 * Pedido A9 (14/10/2026, paridade com a Prospecta): a etapa do financiamento é
 * escolhida livremente na lista (as 8 etapas dos filtros), sem exigir a
 * configuração completa antes. É só do financiamento: não altera o lead no CRM.
 */
export async function alterarStatusFinanciamento(id: string, status: string) {
  await financiamentoDoAtor(id);
  if (status === "aguardando_configuracao" || !Object.hasOwn(STATUS_CONFIG, status)) throw new Error("Etapa inválida.");
  await prisma.financiamento.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/financiamentos/${id}`);
  revalidatePath("/admin/financiamentos");
}

/** Pedido A9: valor total (imóvel) e valor financiado editados direto na lista. */
export async function atualizarValoresFinanciamento(id: string, valorImovel: number, valorFinanciado: number) {
  return capturarErroAcao(async () => {
    const financiamento = await financiamentoDoAtor(id);
    for (const v of [valorImovel, valorFinanciado]) if (!Number.isFinite(v) || v < 0 || v > 1e12) throw new Error("Valor inválido.");
    if (valorFinanciado > valorImovel) throw new Error("O valor financiado não pode superar o valor total.");
    await transacaoCRM(async tx => {
      if (financiamento.leadId) {
        await bloquearLead(tx, financiamento.leadId);
        await tx.lead.update({ where: { id: financiamento.leadId }, data: { orcamento: valorImovel, valorAprovado: valorFinanciado } });
        await tx.financiamento.updateMany({ where: { leadId: financiamento.leadId }, data: { valorImovel, valorFinanciado } });
        await sincronizarVgvDoLead(financiamento.leadId, tx);
      } else {
        await tx.financiamento.update({ where: { id }, data: { valorImovel, valorFinanciado } });
      }
    });
    revalidatePath(`/admin/financiamentos/${id}`);
    revalidatePath("/admin/financiamentos");
    if (financiamento.leadId) revalidatePath(`/admin/leads/${financiamento.leadId}`);
    return { ok: true as const };
  });
}
