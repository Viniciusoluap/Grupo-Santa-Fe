"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { exigirConfiguracaoParaStatus } from "@/lib/crm/configuracao-servico";
import { REG_STATUS_CONFIG } from "@/lib/types/regularizacao";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function alterarStatusRegularizacao(id: string, status: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  const registro = await prisma.regularizacao.findUnique({ where: { id } });
  exigirConfiguracaoParaStatus(registro, status, ['tipo', 'endereco', 'responsavel', 'valorServico'], REG_STATUS_CONFIG);
  await prisma.regularizacao.update({ where: { id }, data: { status } });
  revalidatePath("/admin/regularizacao");
  revalidatePath(`/admin/regularizacao/${id}`);
}

export async function adicionarDocumentoReg(regularizacaoId: string, nome: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.regDocumento.create({
    data: { regularizacaoId, nome, status: "pendente" },
  });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

export async function atualizarStatusDocumento(id: string, status: string, regularizacaoId: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.regDocumento.update({ where: { id, regularizacaoId }, data: { status } });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

export async function excluirDocumentoReg(id: string, regularizacaoId: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.regDocumento.delete({ where: { id, regularizacaoId } });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

// Novas regularizações são materializadas exclusivamente pelas demandas do CRM.
