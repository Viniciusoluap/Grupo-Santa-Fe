"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { OBRA_TIPO_CONFIG, OBRA_STATUS_CONFIG } from "@/lib/types/obra";
import { textoObrigatorio, opcaoObrigatoria, numeroObrigatorio } from "@/lib/crm/configuracao-servico";
import { prisma } from "@/lib/db";
import { bloquearLead, transacaoCRM, clienteParaRegistro } from "@/lib/crm/vinculo-lead";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarDiarioObra(obraId: string, formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
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

export async function excluirObra(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.obra.update({ where: { id }, data: { status: "cancelada" } });
  revalidatePath("/admin/obras");
}

export async function editarObra(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  await transacaoCRM(async (tx) => {
    const atual = await tx.obra.findUnique({ where: { id }, select: { leadId: true } });
    if (!atual) throw new Error("Registro não encontrado.");
    if (formData.has("leadId") && formData.get("leadId") !== atual.leadId) throw new Error("O vínculo com o CRM não pode ser alterado neste módulo.");
    if (atual.leadId) await bloquearLead(tx, atual.leadId);
    const cliente = await clienteParaRegistro(atual.leadId, formData, tx);
    await tx.obra.update({
      where: { id },
      data: {
        nome: textoObrigatorio(formData, "nome"),
        tipo: opcaoObrigatoria(formData, "tipo", OBRA_TIPO_CONFIG),
        status: opcaoObrigatoria(formData, "status", OBRA_STATUS_CONFIG),
        clienteNome: cliente.clienteNome,
        clienteTel: cliente.clienteTel,
        endereco: textoObrigatorio(formData, "endereco"),
        area: numeroObrigatorio(formData, "area"),
        valorTotal: numeroObrigatorio(formData, "valorTotal"),
        engenheiroResp: textoObrigatorio(formData, "engenheiroResp"),
        descricao: (formData.get("descricao") as string) || "",
      },
    });
  });
  revalidatePath("/admin/obras");
  redirect(`/admin/obras/${id}`);
}
