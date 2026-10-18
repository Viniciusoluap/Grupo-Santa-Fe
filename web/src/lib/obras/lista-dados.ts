import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { progressoDaObra } from "@/lib/financeiro/progresso";
import type { ObraDaLista } from "@/components/obras/lista-obras";

/**
 * Obras no formato da lista (painel e Portal do Empreiteiro). Campos Decimal
 * (EPIC-020 Lote 2) não atravessam para Client Components: a lista recebe só o
 * VGV e o Orçamento Previsto como número para exibição.
 */
export async function carregarListaObras(where: Prisma.ObraWhereInput = {}): Promise<ObraDaLista[]> {
  const registros = await prisma.obra.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    include: { etapas: { orderBy: { ordem: "asc" } }, servicoLead: { select: { servico: true } }, empreiteiro: { select: { nome: true } }, leadVinculado: { select: { valorAprovado: true } } },
  });
  // Pedido de 18/10: medições aguardando o banco e já recebidas (filtro da lista).
  const medicoes = await prisma.obraProgressoHistorico.groupBy({
    by: ["obraId"],
    where: { obraId: { in: registros.map((o) => o.id) }, solicitadaEm: { not: null } },
    _count: { _all: true, recebidaEm: true },
  });
  const porObra = new Map(medicoes.map((m) => [m.obraId, { recebidas: m._count.recebidaEm, solicitadas: m._count._all - m._count.recebidaEm }]));
  return registros.map((o) => ({
    medicoesSolicitadas: porObra.get(o.id)?.solicitadas ?? 0,
    medicoesRecebidas: porObra.get(o.id)?.recebidas ?? 0,
    id: o.id, nome: o.nome, tipo: o.tipo, servicoLead: o.servicoLead, status: o.status,
    clienteNome: o.clienteNome, clienteTel: o.clienteTel, endereco: o.endereco, area: o.area,
    valorTotal: o.valorTotal, valorPago: o.valorPago, progresso: progressoDaObra(o.progressoMedido?.toString(), o.progresso), engenheiroResp: o.engenheiroResp,
    dataInicio: o.dataInicio, dataPrevisaoFim: o.dataPrevisaoFim, dataConclusao: o.dataConclusao, etapas: o.etapas,
    // Pedido de 15/10: obra com lead tem VGV = Valor Aprovado do CRM.
    vgv: (() => { const v = o.leadId ? o.leadVinculado?.valorAprovado : o.vgv; return v == null ? null : Number(v); })(),
    orcamentoPrevisto: o.orcamentoPrevisto == null ? null : Number(o.orcamentoPrevisto),
    criadoEm: o.criadoEm, empreiteiroNome: o.empreiteiro?.nome ?? null,
  }));
}
