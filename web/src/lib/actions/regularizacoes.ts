"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { REG_TIPO_CONFIG, REG_STATUS_CONFIG } from "@/lib/types/regularizacao";
import { ehStatusProcesso } from "@/lib/financeiro/regularizacao";
import { textoObrigatorio, opcaoObrigatoria, numeroObrigatorio, tiposObrigatorios } from "@/lib/crm/configuracao-servico";
import { prisma } from "@/lib/db";
import { bloquearLead, transacaoCRM, clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Lote 6: na edição só se escolhe uma das 3 situações (ou se mantém a atual). */
function statusEditado(status: string, atual: string): string {
  if (status !== atual && !ehStatusProcesso(status)) throw new Error("Status inválido.");
  return status;
}

/** Exclusão definitiva (item 03 + pedido A6): some das listas, pesquisas e totais, junto com os lançamentos. */
export async function excluirRegularizacao(id: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("regularizacao", { somenteEquipe: true });
    const r = await excluirServicoDefinitivo("regularizacao", id);
    revalidatePath("/admin/regularizacao");
    revalidatePath("/admin/leads");
    return r;
  });
}

/**
 * Pedido de 16/10 ("Dados do processo" só com o que vem do lead): a tela edita
 * apenas cliente e telefone, e só quando não há lead vinculado. Os demais campos
 * do processo ficam como estão. Gêmeo do `regularizacao.update` parcial da Prospecta.
 */
export async function editarClienteRegularizacao(formData: FormData) {
  await exigirModuloAcao("regularizacao");
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    const atual = await tx.regularizacao.findUnique({ where: { id }, select: { leadId: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    if (atual.leadId) return; // com lead, cliente e telefone vêm do CRM
    const nome = ((formData.get("clienteNome") as string) ?? "").trim();
    if (nome.length < 2) throw new Error("Informe o nome do cliente.");
    await tx.regularizacao.update({
      where: { id },
      data: { clienteNome: nome, clienteTel: ((formData.get("clienteTel") as string) ?? "").trim() },
    });
  });
  revalidatePath("/admin/regularizacao");
  redirect(`/admin/regularizacao/${id}`);
}

export async function editarRegularizacao(formData: FormData) {
  await exigirModuloAcao("regularizacao");
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    const atual = await tx.regularizacao.findUnique({ where: { id }, select: { leadId: true, status: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    await tx.regularizacao.update({
      where: { id },
      data: {
        nome: textoObrigatorio(formData, "nome"),
        tipo: tiposObrigatorios(formData, REG_TIPO_CONFIG),
        status: statusEditado(opcaoObrigatoria(formData, "status", REG_STATUS_CONFIG), atual.status),
        clienteNome: cliente.clienteNome,
        clienteTel: cliente.clienteTel,
        endereco: textoObrigatorio(formData, "endereco"),
        responsavel: textoObrigatorio(formData, "responsavel"),
        valorServico: numeroObrigatorio(formData, "valorServico"),
        descricao: (formData.get("descricao") as string) || "",
        matricula: (formData.get("matricula") as string) || null,
        previsaoFim: (formData.get("previsaoFim") as string) ? new Date(formData.get("previsaoFim") as string) : null,
      },
    });
  });
  revalidatePath("/admin/regularizacao");
  redirect(`/admin/regularizacao/${id}`);
}
