"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function criarContaBancaria(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.contaBancaria.create({
    data: {
      banco: formData.get("banco") as string,
      agencia: (formData.get("agencia") as string) || null,
      conta: formData.get("conta") as string,
      tipo: (formData.get("tipo") as string) || "corrente",
      descricao: (formData.get("descricao") as string) || null,
      saldoAtual: parseFloat((formData.get("saldoAtual") as string) || "0"),
      pluggyAccountId: (formData.get("pluggyAccountId") as string) || null,
      webhookUrl: (formData.get("webhookUrl") as string) || null,
    },
  });
  revalidatePath("/admin/bpo");
}

export async function excluirContaBancaria(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.contaBancaria.delete({ where: { id } });
  revalidatePath("/admin/bpo");
}

export async function atualizarSaldoConta(id: string, saldo: number) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.contaBancaria.update({
    where: { id },
    data: { saldoAtual: saldo, ultimaSincronizacao: new Date() },
  });
  revalidatePath("/admin/bpo");
}

export async function atualizarStatusTransacao(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.transacaoBancaria.update({ where: { id }, data: { status } });
  revalidatePath("/admin/bpo");
}

export async function salvarTransacoes(
  contaId: string,
  transacoes: {
    data: string;
    descricao: string;
    valor: number;
    tipo: string;
    categoria?: string;
    externalId?: string;
  }[]
) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  for (const t of transacoes) {
    await prisma.transacaoBancaria.upsert({
      where: { externalId: t.externalId ?? `manual-${contaId}-${Date.now()}-${Math.random()}` },
      create: {
        contaId,
        data: new Date(t.data),
        descricao: t.descricao,
        valor: t.valor,
        tipo: t.tipo,
        categoria: t.categoria,
        externalId: t.externalId,
      },
      update: {},
    });
  }
  await prisma.contaBancaria.update({
    where: { id: contaId },
    data: { ultimaSincronizacao: new Date() },
  });
  revalidatePath("/admin/bpo");
}
