"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { REG_TIPO_CONFIG, REG_STATUS_CONFIG } from "@/lib/types/regularizacao";
import { textoObrigatorio, opcaoObrigatoria, numeroObrigatorio, tiposObrigatorios } from "@/lib/crm/configuracao-servico";
import { prisma } from "@/lib/db";
import { bloquearLead, transacaoCRM, clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function excluirRegularizacao(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.regularizacao.update({ where: { id }, data: { status: "cancelado" } });
  revalidatePath("/admin/regularizacao");
}

export async function editarRegularizacao(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    const atual = await tx.regularizacao.findUnique({ where: { id }, select: { leadId: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    await tx.regularizacao.update({
      where: { id },
      data: {
        nome: textoObrigatorio(formData, "nome"),
        tipo: tiposObrigatorios(formData, REG_TIPO_CONFIG),
        status: opcaoObrigatoria(formData, "status", REG_STATUS_CONFIG),
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
