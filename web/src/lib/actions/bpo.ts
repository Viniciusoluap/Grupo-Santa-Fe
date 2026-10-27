"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { categoriaValida, resumoPorCliente } from "@/lib/bpo-categorias";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";
import { planejarImportacaoClientesBpo } from "@/lib/bpo-importacao-crm";

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
  if (leadId) {
    const existente = await prisma.bpoCliente.findUnique({ where: { leadId }, select: { id: true } });
    if (existente) redirect(`/admin/bpo/${existente.id}`);
  }

  await prisma.bpoCliente.create({ data: montarClienteBpo(formData, lead) });

  revalidatePath("/admin/bpo");
  redirect("/admin/bpo");
}

/** Importa os leads ativos ainda sem cliente BPO, com chave única leadId para repetição segura. */
export async function importarClientesCrmBpo() {
  await exigirModuloAcao("bpo");
  const leads = await prisma.lead.findMany({
    where: { excluidoEm: null, arquivadoEm: null },
    select: { id: true, nome: true, cpf: true, telefone: true, email: true },
    orderBy: { id: "asc" },
  });
  const existentes = await prisma.bpoCliente.findMany({ where: { leadId: { in: leads.map((l) => l.id) } }, select: { leadId: true } });
  const plano = planejarImportacaoClientesBpo(leads, existentes.map((r) => r.leadId));
  const faltantes = plano.faltantes;
  const criadas = faltantes.length ? await prisma.bpoCliente.createMany({
    data: faltantes.map((lead) => ({ razaoSocial: lead.nome.slice(0, 255), cpf: lead.cpf, responsavel: lead.nome.slice(0, 255), email: lead.email, telefone: lead.telefone.slice(0, 30), honorarios: 0, diaVencimento: 10, dataInicio: new Date(), observacoes: "Importado do CRM", leadId: lead.id })),
    skipDuplicates: true,
  }) : { count: 0 };
  const atualizadas = await prisma.bpoCliente.count({ where: { leadId: { in: leads.map((l) => l.id) } } });
  revalidatePath("/admin/bpo");
  return { encontradasNoCrm: leads.length, criadas: criadas.count, jaImportadas: atualizadas - criadas.count, totalVinculadas: atualizadas };
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
  const categoriaOperacional = texto(formData.get("categoriaOperacional")) || null;
  const etapa = categoriaOperacional;
  if (etapa && !SERVICOS_PROGRESSO.some((s) => s.chave === etapa)) throw new Error("Módulo de obra inválido.");
  if (categoriaOperacional && !SERVICOS_PROGRESSO.some((s) => s.chave === categoriaOperacional)) throw new Error("Categoria operacional inválida.");
  if (tipoEntrada !== "despesa" && etapa) throw new Error("Módulo de obra só pode ser informado em despesas.");
  await prisma.bpoLancamento.create({
    data: {
      clienteId,
      clienteNomeLivre,
      tipo: tipoEntrada === "cobranca" ? "recebimento" : "despesa",
      categoria,
      categoriaContabil: categoria,
      categoriaOperacional,
      etapa,
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

/** Alteração financeira auditável: exige a versão lida na tela e registra antes/depois e motivo. */
export async function editarLancamentoBpo(input: {
  id: string; version: number; motivo: string; descricao: string; valor: number;
  categoria: string; categoriaOperacional?: string | null; competencia: string; vencimento: string; clienteId?: string | null;
  clienteNomeLivre?: string | null; centroCustos?: string | null; categoriaContabil?: string | null;
}) {
  await exigirModuloAcao("bpo");
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("Versão inválida. Atualize a tela.");
  if (input.motivo.trim().length < 3 || !input.descricao.trim() || !Number.isFinite(input.valor) || input.valor <= 0) throw new Error("Informe motivo, descrição e valor válidos.");
  if (!/^\d{4}-\d{2}$/.test(input.competencia)) throw new Error("Competência inválida.");
  if (!categoriaValida(input.categoria) || input.categoria === "Transferência interna") throw new Error("Categoria contábil inválida.");
  if (input.categoriaOperacional && !SERVICOS_PROGRESSO.some((s) => s.chave === input.categoriaOperacional)) throw new Error("Categoria operacional inválida.");
  const vencimento = new Date(input.vencimento);
  if (Number.isNaN(vencimento.getTime())) throw new Error("Vencimento inválido.");
  const session = await auth();
  const usuarioId = typeof session?.user?.id === "string" ? session.user.id : null;
  const updated = await prisma.$transaction(async (tx) => {
    const antes = await tx.bpoLancamento.findUnique({ where: { id: input.id } });
    if (!antes || antes.version !== input.version) throw new Error("O lançamento foi alterado por outra pessoa. Atualize a tela.");
    if (antes.tipo !== "despesa" && input.categoriaOperacional) throw new Error("Módulo operacional só pode ser atribuído a uma despesa.");
    const result = await tx.bpoLancamento.updateMany({ where: { id: input.id, version: input.version }, data: {
      descricao: input.descricao.trim(), valor: input.valor, categoria: input.categoria,
      categoriaContabil: input.categoriaContabil?.trim() || input.categoria,
      categoriaOperacional: input.categoriaOperacional || null,
      etapa: input.categoriaOperacional || null,
      clienteId: input.clienteId || null, clienteNomeLivre: input.clienteId ? null : input.clienteNomeLivre?.trim() || null,
      vencimento, competencia: input.competencia, centroCustos: input.centroCustos?.trim() || null,
      version: { increment: 1 },
    } });
    if (!result.count) throw new Error("O lançamento foi alterado por outra pessoa. Atualize a tela.");
    const depois = await tx.bpoLancamento.findUniqueOrThrow({ where: { id: input.id } });
    await tx.bpoLancamentoHistorico.create({ data: { lancamentoId: input.id, lancamentoReferencia: input.id,
      versaoAnterior: antes.version, alteradoPorUsuarioId: usuarioId, motivo: input.motivo.trim(),
      antesJson: JSON.stringify(antes), depoisJson: JSON.stringify(depois) } });
    return depois;
  });
  revalidatePath("/admin/bpo");
  if (updated.clienteId) revalidatePath(`/admin/bpo/${updated.clienteId}`);
  return { success: true, version: updated.version };
}
