"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function alterarStatusRegularizacao(id: string, status: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.regularizacao.update({
    where: { id },
    data: { status },
  });
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
  await prisma.regDocumento.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

export async function excluirDocumentoReg(id: string, regularizacaoId: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.regDocumento.delete({ where: { id } });
  revalidatePath(`/admin/regularizacao/${regularizacaoId}`);
}

// criarRegularizacao vive em ./regularizacoes.ts (com vínculo obrigatório ao lead
// — EPIC-007). A cópia antiga daqui foi removida: era uma action exposta, sem uso
// na UI, que ainda permitia abrir processo avulso sem cliente do CRM.
