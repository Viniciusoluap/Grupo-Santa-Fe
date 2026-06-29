import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { RelatoriosClient } from "./relatorios-client";

const PIE_COLORS = ["#F5C400", "#1A1A1A", "#6B7280", "#D1D5DB", "#4B5563", "#9CA3AF", "#374151", "#E5E7EB"];

function parseDate(raw: string | null | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  requirePageRole(session, "admin");

  const sp = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const fromDate = parseDate(sp.from, defaultFrom);
  const toDate = parseDate(sp.to, defaultTo);
  // Ensure toDate covers the full day
  toDate.setHours(23, 59, 59, 999);

  const [
    totalImoveis,
    totalLeads,
    leadsPorStatus,
    comissoesPagas,
    imoveisPorTipo,
    totalFinanciamentos,
    corretores,
    totalAvaliacoes,
    avaliacoesPorStatus,
    lancamentos,
  ] = await Promise.all([
    prisma.imovel.count(),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.comissao.findMany({
      where: { status: "paga", pagamentoEm: { gte: fromDate, lte: toDate } },
      orderBy: { pagamentoEm: "asc" },
    }),
    prisma.imovel.groupBy({ by: ["tipo"], _count: { id: true } }),
    prisma.financiamento.count(),
    prisma.corretor.findMany({
      where: { ativo: true },
      include: {
        comissoes: {
          where: { status: "paga", pagamentoEm: { gte: fromDate, lte: toDate } },
        },
      },
      take: 10,
    }),
    prisma.avaliacao.count(),
    prisma.avaliacao.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.lancamento.findMany({
      where: { data: { gte: fromDate, lte: toDate } },
      orderBy: { data: "asc" },
    }),
  ]);

  // Valor médio de avaliação
  const valorMedioAvaliacao = await prisma.avaliacao.aggregate({
    _avg: { valorEstimado: true },
  });

  // Build monthly data
  const months: { month: string; receita: number; vendas: number; receitas: number; despesas: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(". ", "/");
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const comMes = comissoesPagas.filter(
      (c) => c.pagamentoEm && c.pagamentoEm >= mStart && c.pagamentoEm <= mEnd
    );
    const lancMes = lancamentos.filter((l) => l.data >= mStart && l.data <= mEnd);
    months.push({
      month: label,
      receita: comMes.reduce((s, c) => s + c.valor, 0),
      vendas: comMes.length,
      receitas: lancMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0),
      despesas: lancMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0),
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

  const avaliacoesPorStatusData = avaliacoesPorStatus.map((a, idx) => ({
    name: a.status.replace(/_/g, " "),
    value: a._count.id,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  const totalReceitas = lancamentos.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const totalDespesas = lancamentos.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);

  return (
    <RelatoriosClient
      totalImoveis={totalImoveis}
      totalLeads={totalLeads}
      totalFinanciamentos={totalFinanciamentos}
      totalAvaliacoes={totalAvaliacoes}
      valorMedioAvaliacao={valorMedioAvaliacao._avg.valorEstimado ?? 0}
      totalReceitas={totalReceitas}
      totalDespesas={totalDespesas}
      monthlySales={months}
      propertyTypeData={propertyTypeData}
      leadFunnelData={leadFunnelData}
      corretorRanking={corretorRanking}
      serviceRevenue={[{ service: "Corretagem", receita: comissoesPagas.reduce((s, c) => s + c.valor, 0) }]}
      avaliacoesPorStatus={avaliacoesPorStatusData}
      fromDate={fromDate.toISOString().split("T")[0]}
      toDate={toDate.toISOString().split("T")[0]}
    />
  );
}
