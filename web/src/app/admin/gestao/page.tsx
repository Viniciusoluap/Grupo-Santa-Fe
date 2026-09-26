import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import {
  ManagementDashboard,
  type ManagementDashboardData,
} from "../_components/management-dashboard";

export const dynamic = "force-dynamic";
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const monthKey = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const lateDays = (value: Date) =>
  Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await auth();
  requirePageRole(session, "admin");
  const selected = (await searchParams).mes;
  const [
    leads,
    commissions,
    launches,
    accounts,
    accounting,
    users,
    projects,
    works,
    goalSetting,
  ] = await Promise.all([
    prisma.lead.findMany({
      select: { nome: true, status: true, orcamento: true, criadoEm: true },
    }),
    prisma.comissao.findMany({
      select: {
        valor: true,
        status: true,
        pagamentoEm: true,
        criadoEm: true,
        tipoNegocio: true,
        imovel: true,
        corretor: { select: { nome: true } },
      },
    }),
    prisma.bpoLancamento.findMany({
      include: { cliente: { select: { razaoSocial: true } } },
      orderBy: { vencimento: "desc" },
    }),
    prisma.contaBancaria.findMany({
      where: { ativo: true },
      include: { transacoes: { orderBy: { data: "desc" }, take: 500 } },
    }),
    prisma.lancamento.findMany({
      where: { status: { not: "cancelado" } },
      orderBy: { data: "desc" },
      take: 1000,
    }),
    prisma.usuario.findMany({ select: { papel: true, ativo: true } }),
    prisma.projeto.findMany({ select: { valorProjeto: true } }),
    prisma.obra.findMany({ select: { valorTotal: true } }),
    prisma.configuracao.findUnique({
      where: { chave: "dashboard_meta_mensal" },
    }),
  ]);
  const now = new Date();
  const currentMonth = /^\d{4}-\d{2}$/.test(selected ?? "")
    ? selected!
    : monthKey(now);
  const selectedDate = new Date(`${currentMonth}-01T12:00:00`);
  const goal = num(goalSetting?.valor);
  const monthlyAccounting = accounting.filter(
    (item) => monthKey(item.data) === currentMonth && item.status === "pago",
  );
  const revenue = monthlyAccounting
    .filter((item) => item.tipo === "receita")
    .reduce((s, item) => s + item.valor, 0);
  const costs = monthlyAccounting
    .filter((item) => item.tipo === "despesa")
    .reduce((s, item) => s + item.valor, 0);
  const cash = accounts.reduce((s, item) => s + item.saldoAtual, 0);
  const bankMonth = accounts
    .flatMap((item) => item.transacoes)
    .filter(
      (item) =>
        monthKey(item.data) === currentMonth && item.status !== "ignorado",
    );
  const entries = bankMonth
    .filter((item) => item.tipo === "credito")
    .reduce((s, item) => s + item.valor, 0);
  const exits = bankMonth
    .filter((item) => item.tipo === "debito")
    .reduce((s, item) => s + Math.abs(item.valor), 0);
  const monthCommissions = commissions.filter(
    (item) =>
      item.status === "paga" &&
      monthKey(item.pagamentoEm ?? item.criadoEm) === currentMonth,
  );
  const salesRevenue =
    monthCommissions.reduce((s, item) => s + item.valor, 0) || revenue;
  const closedCount = monthCommissions.length;
  const in30 = now.getTime() + 30 * 86_400_000;
  const receive30 = launches
    .filter(
      (item) =>
        !item.pago &&
        item.tipo !== "despesa" &&
        item.vencimento.getTime() >= now.getTime() &&
        item.vencimento.getTime() <= in30,
    )
    .reduce((s, item) => s + item.valor, 0);
  const pay30 = launches
    .filter(
      (item) =>
        !item.pago &&
        item.tipo === "despesa" &&
        item.vencimento.getTime() >= now.getTime() &&
        item.vencimento.getTime() <= in30,
    )
    .reduce((s, item) => s + item.valor, 0);
  const debtors = launches
    .filter(
      (item) => !item.pago && item.tipo !== "despesa" && item.vencimento < now,
    )
    .map((item) => ({
      name:
        item.cliente?.razaoSocial ?? item.clienteNomeLivre ?? item.descricao,
      value: item.valor,
      days: lateDays(item.vencimento),
    }))
    .sort((a, b) => b.value - a.value);
  const aging = [
    {
      name: "Até 30",
      value: debtors
        .filter((d) => d.days <= 30)
        .reduce((s, d) => s + d.value, 0),
      color: "#22c55e",
    },
    {
      name: "31–60",
      value: debtors
        .filter((d) => d.days > 30 && d.days <= 60)
        .reduce((s, d) => s + d.value, 0),
      color: "#eab308",
    },
    {
      name: "61–90",
      value: debtors
        .filter((d) => d.days > 60 && d.days <= 90)
        .reduce((s, d) => s + d.value, 0),
      color: "#f97316",
    },
    {
      name: "90+",
      value: debtors
        .filter((d) => d.days > 90)
        .reduce((s, d) => s + d.value, 0),
      color: "#ef4444",
    },
  ];
  const overdue = debtors.reduce((s, item) => s + item.value, 0);
  const recovered = launches
    .filter(
      (item) =>
        item.pago &&
        item.tipo !== "despesa" &&
        monthKey(item.pagoEm) === currentMonth,
    )
    .reduce((s, item) => s + item.valor, 0);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() - (5 - index),
      1,
    );
    const key = monthKey(d);
    const rows = accounting.filter(
      (item) => item.status === "pago" && monthKey(item.data) === key,
    );
    const monthEnd = new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      0,
      23,
      59,
      59,
    ).getTime();
    const dueIncome = launches.filter(
      (item) =>
        item.tipo !== "despesa" && item.vencimento.getTime() <= monthEnd,
    );
    const dueTotal = dueIncome.reduce((sum, item) => sum + item.valor, 0);
    const outstanding = dueIncome
      .filter(
        (item) =>
          !item.pago || !item.pagoEm || item.pagoEm.getTime() > monthEnd,
      )
      .reduce((sum, item) => sum + item.valor, 0);
    return {
      month: d.toLocaleDateString("pt-BR", { month: "short" }),
      receita: rows
        .filter((item) => item.tipo === "receita")
        .reduce((s, item) => s + item.valor, 0),
      custos: rows
        .filter((item) => item.tipo === "despesa")
        .reduce((s, item) => s + item.valor, 0),
      meta: goal,
      inadimplencia: dueTotal > 0 ? (outstanding / dueTotal) * 100 : 0,
    };
  });
  const costMap = new Map<string, number>();
  monthlyAccounting
    .filter((item) => item.tipo === "despesa")
    .forEach((item) =>
      costMap.set(
        item.categoria,
        (costMap.get(item.categoria) ?? 0) + item.valor,
      ),
    );
  const rank = (keyOf: (item: (typeof monthCommissions)[number]) => string) => {
    const totals = new Map<string, number>();
    monthCommissions.forEach((item) => {
      const key = keyOf(item);
      totals.set(key, (totals.get(key) ?? 0) + item.valor);
    });
    return Array.from(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };
  const categoryRows = new Map<string, { revenue: number; costs: number }>();
  monthlyAccounting.forEach((item) => {
    const row = categoryRows.get(item.categoria) ?? { revenue: 0, costs: 0 };
    if (item.tipo === "receita") row.revenue += item.valor;
    if (item.tipo === "despesa") row.costs += item.valor;
    categoryRows.set(item.categoria, row);
  });
  const averageCosts =
    monthly.slice(-3).reduce((s, item) => s + item.custos, 0) / 3;
  const activePeople = users.filter(
    (item) =>
      item.ativo && ["admin", "colaborador", "corretor"].includes(item.papel),
  ).length;
  const statusLabels: Record<string, string> = {
    novo: "Novos",
    contato: "Contato",
    visita: "Visitas",
    proposta: "Propostas",
    fechado: "Fechados",
  };
  const stages = ["novo", "contato", "visita", "proposta", "fechado"];
  const dashboard: ManagementDashboardData = {
    goal,
    revenue,
    costs,
    result: revenue - costs,
    cash,
    projectedCash: cash + receive30 - pay30,
    entries,
    exits,
    receive30,
    pay30,
    salesRevenue,
    ticket: closedCount ? salesRevenue / closedCount : 0,
    closedCount,
    funnel: stages.map((stage) => ({
      name: statusLabels[stage],
      value: leads.filter((item) => item.status === stage).length,
    })),
    monthly,
    debtors,
    aging,
    overdue,
    recoveryRate:
      recovered + overdue ? (recovered / (recovered + overdue)) * 100 : 0,
    runway: averageCosts > 0 ? cash / averageCosts : null,
    contribution: revenue > 0 ? ((revenue - costs) / revenue) * 100 : null,
    rankedCosts: [...costMap]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    categoryMargins: Array.from(categoryRows)
      .filter(([, row]) => row.revenue > 0)
      .map(([name, row]) => ({
        name,
        value: ((row.revenue - row.costs) / row.revenue) * 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    sellerRanking: rank((item) => item.corretor?.nome ?? "Empresa"),
    productRanking: rank(
      (item) => item.tipoNegocio || item.imovel || "Sem categoria",
    ),
    activePeople,
    revenuePerPerson: activePeople ? revenue / activePeople : 0,
    pipeline: leads.reduce((s, item) => s + num(item.orcamento), 0),
    contracted:
      projects.reduce((s, item) => s + item.valorProjeto, 0) +
      works.reduce((s, item) => s + item.valorTotal, 0),
  };
  return <ManagementDashboard data={dashboard} initialMonth={currentMonth} />;
}
