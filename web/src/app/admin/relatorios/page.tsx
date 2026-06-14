import { prisma } from "@/lib/db";
import { RelatoriosClient } from "./relatorios-client";

const PIE_COLORS = ["#F5C400", "#1A1A1A", "#6B7280", "#D1D5DB", "#4B5563", "#9CA3AF", "#374151", "#E5E7EB"];

export default async function RelatoriosPage() {
  const [
    totalImoveis,
    totalLeads,
    leadsPorStatus,
    comissoesPagas,
    imoveisPorTipo,
    totalFinanciamentos,
    corretores,
  ] = await Promise.all([
    prisma.imovel.count(),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.comissao.findMany({ where: { status: "paga" }, orderBy: { pagamentoEm: "asc" } }),
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
  const months: { month: string; receita: number; vendas: number; leads: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(". ", "/");
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const comissoesMes = comissoesPagas.filter(
      (c) => c.pagamentoEm && c.pagamentoEm >= monthStart && c.pagamentoEm <= monthEnd
    );
    months.push({
      month: label,
      receita: comissoesMes.reduce((s, c) => s + c.valor, 0),
      vendas: comissoesMes.length,
      leads: 0,
    });
  }

  // Property type distribution
  const propertyTypeData = imoveisPorTipo.map((g, idx) => ({
    name: g.tipo.charAt(0).toUpperCase() + g.tipo.slice(1),
    value: g._count.id,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  // Lead funnel
  const totalLeadsCount = totalLeads || 1;
  const statusMap: Record<string, string> = {
    novo: "Captados",
    contato: "Em Contato",
    visita: "Visitas",
    proposta: "Proposta",
    fechado: "Fechados",
    perdido: "Perdidos",
  };
  const leadFunnelData = leadsPorStatus.map((s) => ({
    stage: statusMap[s.status] ?? s.status,
    count: s._count.id,
    pct: Math.round((s._count.id / totalLeadsCount) * 100),
  }));

  // Corretor ranking by paid commissions
  const corretorRanking = corretores
    .map((c) => ({
      name: c.nome,
      comissoes: c.comissoes.reduce((s, com) => s + com.valor, 0),
      vendas: c.comissoes.length,
    }))
    .sort((a, b) => b.comissoes - a.comissoes)
    .slice(0, 5);

  // Service revenue — grouped by imovel field on comissoes (approximation)
  const serviceRevenue = [
    { service: "Corretagem", receita: comissoesPagas.reduce((s, c) => s + c.valor, 0) },
  ];

  return (
    <RelatoriosClient
      totalImoveis={totalImoveis}
      totalLeads={totalLeads}
      totalFinanciamentos={totalFinanciamentos}
      monthlySales={months}
      propertyTypeData={propertyTypeData}
      leadFunnelData={leadFunnelData}
      corretorRanking={corretorRanking}
      serviceRevenue={serviceRevenue}
    />
  );
}
