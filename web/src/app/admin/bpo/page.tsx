export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { BpoClient } from "./_components/bpo-client";

const PIE_COLORS = ["#F5C400", "#1A1A1A", "#6B7280", "#D1D5DB", "#4B5563", "#9CA3AF", "#374151", "#E5E7EB"];

export default async function BpoPage() {
  const [
    lancamentos,
    clientes,
    leads,
    contasRaw,
    totalImoveis,
    totalLeads,
    leadsPorStatus,
    comissoesPagas,
    imoveisPorTipo,
    totalFinanciamentos,
    corretores,
  ] = await Promise.all([
    prisma.bpoLancamento.findMany({
      orderBy: { vencimento: "desc" },
      take: 300,
      include: { cliente: { select: { razaoSocial: true } } },
    }),
    prisma.bpoCliente.findMany({
      where: { status: "ativo" },
      select: { id: true, razaoSocial: true },
      orderBy: { razaoSocial: "asc" },
    }),
    prisma.lead.findMany({
      select: { id: true, nome: true, telefone: true, email: true },
      orderBy: { nome: "asc" },
      take: 300,
    }),
    prisma.contaBancaria.findMany({
      where: { ativo: true },
      orderBy: { criadoEm: "desc" },
      include: { transacoes: { orderBy: { data: "desc" }, take: 30 } },
    }),
    prisma.imovel.count(),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.comissao.findMany({ where: { status: "paga" }, orderBy: { pagamentoEm: "asc" }, take: 500 }),
    prisma.imovel.groupBy({ by: ["tipo"], _count: { id: true } }),
    prisma.financiamento.count(),
    prisma.corretor.findMany({
      where: { ativo: true },
      include: { comissoes: { where: { status: "paga" } } },
      take: 10,
    }),
  ]);

  // Build monthly commissions data (last 12 months)
  const now = new Date();
  const monthlySales: { month: string; receita: number; vendas: number; leads: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(". ", "/");
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const comissoesMes = comissoesPagas.filter(
      (c) => c.pagamentoEm && c.pagamentoEm >= monthStart && c.pagamentoEm <= monthEnd
    );
    monthlySales.push({
      month: label,
      receita: comissoesMes.reduce((s, c) => s + c.valor, 0),
      vendas: comissoesMes.length,
      leads: 0,
    });
  }

  const propertyTypeData = imoveisPorTipo.map((g, idx) => ({
    name: g.tipo.charAt(0).toUpperCase() + g.tipo.slice(1),
    value: g._count.id,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  const totalLeadsCount = totalLeads || 1;
  const statusMap: Record<string, string> = {
    novo: "Captados", contato: "Em Contato", visita: "Visitas",
    proposta: "Proposta", fechado: "Fechados", perdido: "Perdidos",
  };
  const leadFunnelData = leadsPorStatus.map((s) => ({
    stage: statusMap[s.status] ?? s.status,
    count: s._count.id,
    pct: Math.round((s._count.id / totalLeadsCount) * 100),
  }));

  const corretorRanking = corretores
    .map((c) => ({
      name: c.nome,
      comissoes: c.comissoes.reduce((s, com) => s + com.valor, 0),
      vendas: c.comissoes.length,
    }))
    .sort((a, b) => b.comissoes - a.comissoes)
    .slice(0, 5);

  const serviceRevenue = [
    { service: "Corretagem", receita: comissoesPagas.reduce((s, c) => s + c.valor, 0) },
  ];

  const relatoriosData = {
    totalImoveis,
    totalLeads,
    totalFinanciamentos,
    monthlySales,
    propertyTypeData,
    leadFunnelData,
    corretorRanking,
    serviceRevenue,
  };

  const mapped = lancamentos.map((l) => ({
    id: l.id,
    clienteId: l.clienteId,
    clienteNome: l.cliente?.razaoSocial ?? l.clienteNomeLivre ?? "—",
    clienteNomeLivre: l.clienteNomeLivre,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    vencimento: l.vencimento.toISOString(),
    pago: l.pago,
    pagoEm: l.pagoEm?.toISOString() ?? null,
    competencia: l.competencia,
    centroCustos: l.centroCustos,
  }));

  const contas = contasRaw.map((c) => ({
    id: c.id,
    banco: c.banco,
    agencia: c.agencia,
    conta: c.conta,
    tipo: c.tipo,
    descricao: c.descricao,
    saldoAtual: c.saldoAtual,
    ativo: c.ativo,
    pluggyItemId: c.pluggyItemId,
    pluggyAccountId: c.pluggyAccountId,
    webhookUrl: c.webhookUrl,
    ultimaSincronizacao: c.ultimaSincronizacao?.toISOString() ?? null,
    transacoes: c.transacoes.map((t) => ({
      id: t.id,
      data: t.data.toISOString(),
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.tipo,
      categoria: t.categoria,
      status: t.status,
      externalId: t.externalId,
    })),
  }));

  return <BpoClient lancamentos={mapped} clientes={clientes} leads={leads} contas={contas} relatorios={relatoriosData} />;
}
