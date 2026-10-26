"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { categoriaValida, resumoPorCliente } from "@/lib/bpo-categorias";

const texto = (valor: FormDataEntryValue | null) => String(valor ?? "").trim();

function montarClienteBpo(formData: FormData, lead: { id: string; nome: string; cpf: string | null; telefone: string; email: string | null } | null) {
  const nome = texto(formData.get("razaoSocial")) || lead?.nome || "";
  if (nome.length < 2) throw new Error("Informe o nome do cliente ou escolha um lead do CRM.");
  const dataInformada = texto(formData.get("dataInicio"));
  const dataInicio = dataInformada ? new Date(`${dataInformada}T12:00:00Z`) : new Date();
  const honorarios = Number(texto(formData.get("honorarios")).replace(",", ".") || 0);
  return {
    razaoSocial: nome.slice(0, 255),
    cnpj: texto(formData.get("cnpj")) || null,
    cpf: texto(formData.get("cpf")) || lead?.cpf || null,
    responsavel: (texto(formData.get("responsavel")) || nome).slice(0, 255),
    email: texto(formData.get("email")) || lead?.email || null,
    telefone: (texto(formData.get("telefone")) || lead?.telefone || "").slice(0, 30),
    servicos: JSON.stringify(formData.getAll("servicos").map(String)),
    honorarios: Number.isFinite(honorarios) ? honorarios : 0,
    diaVencimento: Math.min(31, Math.max(1, Number(texto(formData.get("diaVencimento"))) || 10)),
    dataInicio: Number.isNaN(dataInicio.getTime()) ? new Date() : dataInicio,
    observacoes: texto(formData.get("observacoes")),
    leadId: lead?.id ?? null,
  };
}

export async function criarBpoCliente(formData: FormData) {
  await exigirModuloAcao("bpo");
  const leadId = texto(formData.get("leadId")) || null;
  const lead = leadId ? await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, nome: true, cpf: true, telefone: true, email: true },
  }) : null;
  if (leadId && !lead) throw new Error("Lead não encontrado.");

  await prisma.bpoCliente.create({ data: montarClienteBpo(formData, lead) });

  revalidatePath("/admin/bpo");
  redirect("/admin/bpo");
}

export async function criarLancamentoBpo(formData: FormData) {
  await exigirModuloAcao("bpo");
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
  await exigirModuloAcao("bpo");
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
  await exigirModuloAcao("bpo");
  const clienteId = (formData.get("clienteId") as string) || null;
  const clienteNomeLivre = (formData.get("clienteNomeLivre") as string) || null;

  const tipoEntrada = texto(formData.get("tipo"));
  if (!['cobranca', 'despesa'].includes(tipoEntrada)) throw new Error("Tipo inválido.");
  const categoria = texto(formData.get("categoria"));
  if (!categoriaValida(categoria) || categoria === "Transferência interna") throw new Error("Escolha uma categoria válida.");
  await prisma.bpoLancamento.create({
    data: {
      clienteId,
      clienteNomeLivre,
      tipo: tipoEntrada === "cobranca" ? "recebimento" : "despesa",
      categoria,
      descricao: formData.get("descricao") as string,
      valor: parseFloat(formData.get("valor") as string),
      vencimento: new Date(formData.get("vencimento") as string),
      competencia: formData.get("competencia") as string,
      centroCustos: (formData.get("centroCustos") as string) || null,
    },
  });

  revalidatePath("/admin/bpo");
}

/** Totais exibidos na aba Clientes e no detalhe do lead. */
export async function resumoBpoPorLead(leadId: string) {
  await exigirModuloAcao("bpo");
  const clientes = await prisma.bpoCliente.findMany({ where: { leadId }, select: { id: true, razaoSocial: true } });
  if (!clientes.length) return { clientes: [], recebido: 0, emAberto: 0 };
  const lancamentos = await prisma.bpoLancamento.findMany({
    where: { clienteId: { in: clientes.map((c) => c.id) } },
    select: { clienteId: true, tipo: true, valor: true, pago: true, categoria: true },
  });
  const totais = resumoPorCliente(lancamentos);
  return clientes.reduce((acc, cliente) => {
    const total = totais.get(cliente.id);
    acc.recebido += total?.recebido ?? 0;
    acc.emAberto += total?.emAberto ?? 0;
    return acc;
  }, { clientes, recebido: 0, emAberto: 0 });
}


export async function pagarLancamento(id: string) {
  await exigirModuloAcao("bpo");
  await prisma.bpoLancamento.update({
    where: { id },
    data: { pago: true, pagoEm: new Date() },
  });

  revalidatePath("/admin/bpo");
}

export async function atualizarStatusBpoCliente(formData: FormData) {
  await exigirModuloAcao("bpo");
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  await prisma.bpoCliente.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/bpo/${id}`);
  revalidatePath("/admin/bpo");
}
