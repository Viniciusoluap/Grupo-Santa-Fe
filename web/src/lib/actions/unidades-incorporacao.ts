"use server";

import { exigirModuloAcao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { prisma } from "@/lib/db";
import { chaveUnidade, vendasLegadas } from "@/lib/incorporacao/unidades";
import { revalidatePath } from "next/cache";

async function admin() {
  const usuario = await exigirModuloAcao("incorporacao");
  return usuario.id;
}

function validarEstudo(estudo: { tipoIncorporacao: string | null; lancamentoImobiliarioJson: string | null } | null) {
  if (!estudo) throw new Error("Estudo não encontrado.");
  if (estudo.tipoIncorporacao !== "desmembramento_simples") throw new Error("Inventário exclusivo de Desmembramento Simples.");
  return estudo;
}

async function listarUnidadesImpl(estudoId: string) {
  await admin();
  const estudo = validarEstudo(await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { tipoIncorporacao: true, lancamentoImobiliarioJson: true } }));
  const [unidades, eventos] = await Promise.all([
    prisma.estudoUnidade.findMany({ where: { estudoId }, orderBy: { codigo: "asc" } }),
    prisma.estudoUnidadeEvento.findMany({ where: { unidade: { estudoId }, vendaLegadaId: { not: null } }, select: { vendaLegadaId: true } }),
  ]);
  const legacy = vendasLegadas(estudo.lancamentoImobiliarioJson);
  const ids = new Set(eventos.map((e) => e.vendaLegadaId));
  return { unidades: unidades.map((u) => ({ ...u, valorVenda: u.valorVenda?.toString() ?? null, criadoEm: u.criadoEm.toISOString(), atualizadoEm: u.atualizadoEm.toISOString() })),
    legacyPending: legacy.vendas.filter((v) => !ids.has(v.id)), legacyInvalid: legacy.invalido };
}

async function criarUnidadeImpl(estudoId: string, codigo: string, tipo: string) {
  const usuarioId = await admin();
  const code = codigo.trim(); const kind = tipo.trim(); const key = chaveUnidade(code);
  if (!code || !kind || code.length > 120 || key.length > 120 || kind.length > 40) throw new Error("Código ou tipo inválido.");
  await prisma.$transaction(async (tx) => {
    validarEstudo(await tx.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { tipoIncorporacao: true, lancamentoImobiliarioJson: true } }));
    const duplicada = await tx.estudoUnidade.findUnique({ where: { estudoId_codigoChave: { estudoId, codigoChave: key } }, select: { id: true } });
    if (duplicada) throw new Error(`Já existe uma unidade com o código "${code}" neste estudo.`);
    const unit = await tx.estudoUnidade.create({ data: { estudoId, codigo: code, codigoChave: key, tipo: kind } });
    await tx.estudoUnidadeEvento.create({ data: { unidadeId: unit.id, statusNovo: "disponivel", usuarioId } });
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
}

async function mudarEstadoUnidadeImpl(estudoId: string, unidadeId: string, acao: "reservar" | "vender" | "liberar", comprador?: string, valor?: string) {
  const usuarioId = await admin();
  const buyer = comprador?.trim() || null;
  if (acao === "vender" && (!buyer || !valor || !/^\d{1,13}(\.\d{1,2})?$/.test(valor) || Number(valor) <= 0)) throw new Error("Comprador e valor válido são obrigatórios.");
  await prisma.$transaction(async (tx) => {
    // Bloqueia o estudo para serializar conciliação e transições; outra venda da
    // mesma unidade só pode passar se a condição de status ainda for verdadeira.
    await tx.$queryRaw`SELECT id FROM estudos_incorporacao WHERE id = ${estudoId} FOR UPDATE`;
    const estudo = validarEstudo(await tx.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { tipoIncorporacao: true, lancamentoImobiliarioJson: true } }));
    const legacy = vendasLegadas(estudo.lancamentoImobiliarioJson);
    if (legacy.invalido) throw new Error("Vendas históricas ambíguas: revise os dados originais.");
    const done = await tx.estudoUnidadeEvento.findMany({ where: { unidade: { estudoId }, vendaLegadaId: { not: null } }, select: { vendaLegadaId: true } });
    const reconciled = new Set(done.map((e) => e.vendaLegadaId));
    if (legacy.vendas.some((v) => !reconciled.has(v.id))) throw new Error("Concilie as vendas históricas antes de alterar o inventário.");
    const atual = await tx.estudoUnidade.findFirst({ where: { id: unidadeId, estudoId }, select: { status: true } });
    if (!atual) throw new Error("Unidade não encontrada.");
    const estados = acao === "reservar" ? ["disponivel"] : acao === "vender" ? ["disponivel", "reservada"] : ["reservada"];
    const proximo = acao === "reservar" ? "reservada" : acao === "vender" ? "vendida" : "disponivel";
    const result = await tx.estudoUnidade.updateMany({ where: { id: unidadeId, estudoId, status: { in: estados } },
      data: { status: proximo, comprador: acao === "vender" ? buyer : null, valorVenda: acao === "vender" ? valor : null } });
    if (result.count !== 1) throw new Error("A unidade foi alterada em outra sessão. Atualize a lista.");
    await tx.estudoUnidadeEvento.create({ data: { unidadeId, statusAnterior: atual.status, statusNovo: proximo,
      comprador: acao === "vender" ? buyer : null, valorVenda: acao === "vender" ? valor : null, usuarioId } });
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
}

async function conciliarVendaLegadaImpl(estudoId: string, vendaId: string, tipo: string) {
  const usuarioId = await admin();
  const kind = tipo.trim(); if (!kind || kind.length > 40) throw new Error("Tipo inválido.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM estudos_incorporacao WHERE id = ${estudoId} FOR UPDATE`;
    const estudo = validarEstudo(await tx.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { tipoIncorporacao: true, lancamentoImobiliarioJson: true } }));
    const legacy = vendasLegadas(estudo.lancamentoImobiliarioJson);
    if (legacy.invalido) throw new Error("Vendas históricas ambíguas: revise os dados originais.");
    const sale = legacy.vendas.find((v) => v.id === vendaId);
    if (!sale) throw new Error("Venda histórica não encontrada.");
    const existing = await tx.estudoUnidade.findUnique({ where: { estudoId_codigoChave: { estudoId, codigoChave: chaveUnidade(sale.unidade) } } });
    if (existing && existing.status !== "disponivel") throw new Error("A unidade já está reservada ou vendida; revise antes de conciliar.");
    if (await tx.estudoUnidadeEvento.findFirst({ where: { unidade: { estudoId }, vendaLegadaId: sale.id } })) throw new Error("Venda histórica já conciliada.");
    const unit = existing ? await tx.estudoUnidade.update({ where: { id: existing.id }, data: { status: "vendida", comprador: sale.comprador, valorVenda: sale.valorVenda.toFixed(2) } })
      : await tx.estudoUnidade.create({ data: { estudoId, codigo: sale.unidade, codigoChave: chaveUnidade(sale.unidade), tipo: kind, status: "vendida", comprador: sale.comprador, valorVenda: sale.valorVenda.toFixed(2) } });
    await tx.estudoUnidadeEvento.create({ data: { unidadeId: unit.id, statusAnterior: existing?.status ?? null, statusNovo: "vendida",
      comprador: sale.comprador, valorVenda: sale.valorVenda.toFixed(2), vendaLegadaId: sale.id, usuarioId } });
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
}

export async function listarUnidades(estudoId: string) {
  return capturarErroAcao(() => listarUnidadesImpl(estudoId));
}

export async function criarUnidade(estudoId: string, codigo: string, tipo: string) {
  return capturarErroAcao(() => criarUnidadeImpl(estudoId, codigo, tipo));
}

export async function mudarEstadoUnidade(estudoId: string, unidadeId: string, acao: "reservar" | "vender" | "liberar", comprador?: string, valor?: string) {
  return capturarErroAcao(() => mudarEstadoUnidadeImpl(estudoId, unidadeId, acao, comprador, valor));
}

export async function conciliarVendaLegada(estudoId: string, vendaId: string, tipo: string) {
  return capturarErroAcao(() => conciliarVendaLegadaImpl(estudoId, vendaId, tipo));
}
