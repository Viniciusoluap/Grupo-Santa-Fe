"use server";
import { exigirModuloAcao, exigirAdminAtivo } from "@/lib/auth/modulos";
import { OBRA_STATUS_CONFIG, validarMudancaStatusObra } from "@/lib/types/obra";
import { textoObrigatorio, opcaoObrigatoria, numeroObrigatorio } from "@/lib/crm/configuracao-servico";
import { prisma } from "@/lib/db";
import { bloquearLead, transacaoCRM, clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { excluirServicoDefinitivo } from "@/lib/crm/excluir-servico";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarDiarioObra(obraId: string, formData: FormData) {
  await exigirModuloAcao("obras");
  await prisma.obraDiario.create({
    data: {
      obraId,
      data: new Date(formData.get("data") as string),
      descricao: formData.get("descricao") as string,
      responsavel: textoObrigatorio(formData, "responsavel"),
      clima: (formData.get("clima") as string) || null,
    },
  });
  revalidatePath(`/admin/obras/${obraId}`);
}

/** Exclusão definitiva (item 03): some das listas, pesquisas e totais. Bloqueada quando há guarda financeira. */
export async function excluirObra(id: string) {
  return capturarErroAcao(async () => {
    await exigirAdminAtivo();
    const r = await excluirServicoDefinitivo("obra", id);
    revalidatePath("/admin/obras");
    revalidatePath("/admin/leads");
    return r;
  });
}

/** Cancelar mantém o registro e o histórico; só muda a situação. */
export async function cancelarObra(id: string) {
  return capturarErroAcao(async () => {
    await exigirModuloAcao("obras");
    const r = await prisma.obra.updateMany({ where: { id, status: { not: "cancelada" } }, data: { status: "cancelada" } });
    revalidatePath("/admin/obras");
    return { cancelado: r.count > 0 };
  });
}

function dataOpcional(formData: FormData, campo: string): Date | null {
  const valor = String(formData.get(campo) ?? "").trim();
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error(`Data inválida em ${campo}.`);
  return new Date(`${valor}T00:00:00.000Z`);
}

export async function editarObra(formData: FormData) {
  await exigirModuloAcao("obras");
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    const atual = await tx.obra.findUnique({ where: { id }, select: { leadId: true, status: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    const status = opcaoObrigatoria(formData, "status", OBRA_STATUS_CONFIG);
    const erroStatus = validarMudancaStatusObra(atual.status, status);
    if (erroStatus) throw new Error(erroStatus);
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    await tx.obra.update({
      where: { id },
      data: {
        nome: textoObrigatorio(formData, "nome"),
        status,
        clienteNome: cliente.clienteNome,
        clienteTel: cliente.clienteTel,
        endereco: textoObrigatorio(formData, "endereco"),
        area: numeroObrigatorio(formData, "area"),
        // "Valor Total" saiu da tela (Lote 2): o valor antigo é preservado e não é sobrescrito.
        dataInicio: dataOpcional(formData, "dataInicio"),
        dataPrevisaoFim: dataOpcional(formData, "dataPrevisaoFim"),
        engenheiroResp: textoObrigatorio(formData, "engenheiroResp"),
        descricao: (formData.get("descricao") as string) || "",
      },
    });
  });
  revalidatePath("/admin/obras");
  redirect(`/admin/obras/${id}`);
}
