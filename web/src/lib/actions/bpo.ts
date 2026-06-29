"use server";
import { auth } from "@/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function criarBpoCliente(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const servicos = formData.getAll("servicos") as string[];

  await prisma.bpoCliente.create({
    data: {
      razaoSocial: formData.get("razaoSocial") as string,
      cnpj: (formData.get("cnpj") as string) || null,
      cpf: (formData.get("cpf") as string) || null,
      responsavel: formData.get("responsavel") as string,
      email: (formData.get("email") as string) || null,
      telefone: formData.get("telefone") as string,
      servicos: JSON.stringify(servicos),
      honorarios: parseFloat(formData.get("honorarios") as string),
      diaVencimento: parseInt(formData.get("diaVencimento") as string) || 10,
      dataInicio: new Date(formData.get("dataInicio") as string),
      observacoes: (formData.get("observacoes") as string) || "",
    },
  });

  revalidatePath("/admin/bpo");
  redirect("/admin/bpo");
}

export async function criarLancamentoBpo(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const clienteId = formData.get("clienteId") as string;

  await prisma.bpoLancamento.create({
    data: {
      clienteId,
      tipo: formData.get("tipo") as string,
      descricao: formData.get("descricao") as string,
      valor: parseFloat(formData.get("valor") as string),
      vencimento: new Date(formData.get("vencimento") as string),
      competencia: formData.get("competencia") as string,
    },
  });

  revalidatePath(`/admin/bpo/${clienteId}`);
  revalidatePath("/admin/bpo");
}

export async function marcarLancamentoPago(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const clienteId = formData.get("clienteId") as string;

  await prisma.bpoLancamento.update({
    where: { id },
    data: { pago: true, pagoEm: new Date() },
  });

  revalidatePath(`/admin/bpo/${clienteId}`);
  revalidatePath("/admin/bpo");
}

export async function criarCobranca(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const clienteId = (formData.get("clienteId") as string) || null;
  const clienteNomeLivre = (formData.get("clienteNomeLivre") as string) || null;

  await prisma.bpoLancamento.create({
    data: {
      clienteId,
      clienteNomeLivre,
      tipo: formData.get("tipo") as string,
      descricao: formData.get("descricao") as string,
      valor: parseFloat(formData.get("valor") as string),
      vencimento: new Date(formData.get("vencimento") as string),
      competencia: formData.get("competencia") as string,
      centroCustos: (formData.get("centroCustos") as string) || null,
    },
  });

  revalidatePath("/admin/bpo");
}

export async function pagarLancamento(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.bpoLancamento.update({
    where: { id },
    data: { pago: true, pagoEm: new Date() },
  });

  revalidatePath("/admin/bpo");
}

export async function atualizarStatusBpoCliente(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  await prisma.bpoCliente.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/bpo/${id}`);
  revalidatePath("/admin/bpo");
}
