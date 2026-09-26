"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CircleDollarSign,
  Gauge,
  Save,
  ShieldAlert,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export interface ManagementDashboardData {
  goal: number;
  revenue: number;
  costs: number;
  result: number;
  cash: number;
  projectedCash: number;
  entries: number;
  exits: number;
  receive30: number;
  pay30: number;
  salesRevenue: number;
  ticket: number;
  closedCount: number;
  funnel: { name: string; value: number }[];
  monthly: {
    month: string;
    receita: number;
    custos: number;
    meta: number;
    inadimplencia: number;
  }[];
  debtors: { name: string; value: number; days: number }[];
  aging: { name: string; value: number; color: string }[];
  overdue: number;
  recoveryRate: number;
  runway: number | null;
  contribution: number | null;
  rankedCosts: { name: string; value: number }[];
  categoryMargins: { name: string; value: number }[];
  sellerRanking: { name: string; value: number }[];
  productRanking: { name: string; value: number }[];
  activePeople: number;
  revenuePerPerson: number;
  pipeline: number;
  contracted: number;
}

const TABS = [
  ["executivo", "Executivo", Gauge],
  ["vendas", "Vendas", BarChart3],
  ["financeiro", "Financeiro", WalletCards],
  ["cobranca", "Cobrança", CircleDollarSign],
  ["crise", "Crise", ShieldAlert],
  ["pessoas", "Pessoas", Users],
] as const;
type Tab = (typeof TABS)[number][0];
const number = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function Metric({
  label,
  value,
  detail,
  color = "text-[var(--brand-dark)]",
}: {
  label: string;
  value: string;
  detail?: string;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {label}
      </p>
      <p className={`mt-2 text-xl md:text-2xl font-black ${color}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-gray-400">{detail}</p> : null}
    </div>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-100 p-4">
      <h2 className="text-xs font-black uppercase tracking-widest text-[var(--brand-dark)] mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-48 grid place-items-center text-center text-sm text-gray-400 border border-dashed border-gray-200">
      {children}
    </div>
  );
}
function Ranking({ rows }: { rows: { name: string; value: number }[] }) {
  return rows.length ? (
    <div className="divide-y">
      {rows.map((row, index) => (
        <div key={row.name} className="flex justify-between gap-3 py-3 text-sm">
          <span>
            {index + 1}. {row.name}
          </span>
          <b>{formatCurrency(row.value)}</b>
        </div>
      ))}
    </div>
  ) : (
    <Empty>Sem dados pagos no mês.</Empty>
  );
}

export function ManagementDashboard({
  data,
  initialMonth,
}: {
  data: ManagementDashboardData;
  initialMonth: string;
}) {
  const [tab, setTab] = useState<Tab>("executivo");
  const [goal, setGoal] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const goalPct = data.goal > 0 ? (data.salesRevenue / data.goal) * 100 : null;
  const light = (score: number) =>
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-400" : "bg-red-500";

  function changeMonth(value: string) {
    startTransition(() => router.push(`/admin/gestao?mes=${value}`));
  }
  async function saveGoal() {
    const value = number(goal);
    const response = await fetch("/api/dashboard/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (response.ok) {
      setGoal("");
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className={`space-y-5 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
            Central de Gestão
          </h1>
          <p className="text-gray-400 text-sm">
            Vendas, caixa, cobrança, crise e pessoas em uma visão
          </p>
        </div>
        <input
          aria-label="Mês analisado"
          type="month"
          defaultValue={initialMonth}
          onChange={(event) => changeMonth(event.target.value)}
          className="border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      </div>
      <nav
        className="flex overflow-x-auto border-b border-gray-200"
        aria-label="Áreas do dashboard"
      >
        {TABS.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 ${tab === key ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "border-transparent text-gray-400"}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {tab === "executivo" ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ["Receita", formatCurrency(data.salesRevenue), goalPct ?? 0],
              ["Caixa", formatCurrency(data.cash), data.cash > 0 ? 100 : 0],
              [
                "Cobrança",
                formatCurrency(data.overdue),
                data.overdue === 0 ? 100 : data.recoveryRate,
              ],
              [
                "Resultado",
                formatCurrency(data.result),
                data.result > 0 ? 100 : 0,
              ],
              [
                "Pessoas",
                String(data.activePeople),
                data.activePeople > 0 ? 100 : 0,
              ],
            ].map(([label, value, score]) => (
              <div
                key={String(label)}
                className="bg-[var(--brand-dark)] p-4 text-white"
              >
                <div className="flex justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">
                    {label}
                  </p>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${light(Number(score))}`}
                  />
                </div>
                <p className="text-lg md:text-xl font-black mt-4">{value}</p>
              </div>
            ))}
          </div>
          <Panel title="3 destaques do mês">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <p>
                <b className="text-[var(--brand-yellow-dark)]">1.</b> Receita em{" "}
                {goalPct == null
                  ? "meta não configurada"
                  : `${goalPct.toFixed(0)}% da meta`}
                .
              </p>
              <p>
                <b className="text-[var(--brand-yellow-dark)]">2.</b> Resultado
                do mês: {formatCurrency(data.result)}.
              </p>
              <p>
                <b className="text-[var(--brand-yellow-dark)]">3.</b>{" "}
                {formatCurrency(data.overdue)} vencidos para cobrar.
              </p>
            </div>
          </Panel>
          <div className="grid md:grid-cols-2 gap-3">
            <Metric
              label="Pipeline comercial"
              value={formatCurrency(data.pipeline)}
            />
            <Metric
              label="Volume contratado"
              value={formatCurrency(data.contracted)}
            />
          </div>
        </>
      ) : null}

      {tab === "vendas" ? (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <Metric
              label="Receita paga do mês"
              value={formatCurrency(data.salesRevenue)}
              color="text-blue-600"
              detail={
                goalPct == null
                  ? "Defina a meta"
                  : `${goalPct.toFixed(1)}% da meta`
              }
            />
            <Metric
              label="Meta mensal padrão"
              value={data.goal ? formatCurrency(data.goal) : "Não definida"}
            />
            <Metric
              label="Comissão média"
              value={data.ticket ? formatCurrency(data.ticket) : "—"}
            />
            <Metric
              label="Comissões pagas"
              value={String(data.closedCount)}
              color="text-green-600"
            />
          </div>
          <Panel title="Definir meta mensal padrão">
            <div className="flex gap-2 max-w-md">
              <input
                type="number"
                min="0"
                placeholder={String(data.goal || 0)}
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm flex-1"
              />
              <button
                onClick={saveGoal}
                disabled={!goal || pending}
                className="flex items-center gap-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase px-4"
              >
                <Save size={14} />
                Salvar
              </button>
            </div>
          </Panel>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Receita mensal x meta">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.monthly}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v) => formatCurrency(number(v))} />
                  <Bar dataKey="receita" fill="#2563eb" />
                  <Bar dataKey="meta" fill="#F5C400" opacity={0.55} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Funil de vendas">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.funnel} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={85} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Ranking de vendedores">
              <Ranking rows={data.sellerRanking} />
            </Panel>
            <Panel title="Ranking de produtos / serviços">
              <Ranking rows={data.productRanking} />
            </Panel>
          </div>
        </>
      ) : null}

      {tab === "financeiro" ? (
        <>
          <div className="grid md:grid-cols-5 gap-3">
            <Metric
              label="Caixa hoje"
              value={formatCurrency(data.cash)}
              color={data.cash >= 0 ? "text-green-700" : "text-red-600"}
            />
            <Metric
              label="Caixa projetado 30d"
              value={formatCurrency(data.projectedCash)}
              color={
                data.projectedCash >= 0 ? "text-green-700" : "text-red-600"
              }
            />
            <Metric
              label="Entradas do mês"
              value={formatCurrency(data.entries)}
              color="text-green-700"
            />
            <Metric
              label="Saídas do mês"
              value={formatCurrency(data.exits)}
              color="text-red-600"
            />
            <Metric
              label="Resultado de receitas e despesas pagas"
              value={formatCurrency(data.result)}
              color={data.result >= 0 ? "text-green-700" : "text-red-600"}
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Fluxo realizado">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.monthly}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v) => formatCurrency(number(v))} />
                  <Area dataKey="receita" stroke="#16a34a" fill="#dcfce7" />
                  <Area dataKey="custos" stroke="#dc2626" fill="#fee2e2" />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Próximos 30 dias">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  label="A receber"
                  value={formatCurrency(data.receive30)}
                  color="text-green-700"
                />
                <Metric
                  label="A pagar"
                  value={formatCurrency(data.pay30)}
                  color="text-red-600"
                />
              </div>
              <div className="mt-4 bg-gray-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span>Receita</span>
                  <b>{formatCurrency(data.revenue)}</b>
                </div>
                <div className="flex justify-between mt-2">
                  <span>Custos e despesas</span>
                  <b>{formatCurrency(data.costs)}</b>
                </div>
                <div className="flex justify-between border-t mt-3 pt-3">
                  <span>Resultado</span>
                  <b
                    className={
                      data.result >= 0 ? "text-green-700" : "text-red-600"
                    }
                  >
                    {formatCurrency(data.result)}
                  </b>
                </div>
              </div>
            </Panel>
          </div>
        </>
      ) : null}

      {tab === "cobranca" ? (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <Metric
              label="Total vencido"
              value={formatCurrency(data.overdue)}
              color="text-red-600"
            />
            <Metric
              label="Acima de 90 dias"
              value={formatCurrency(data.aging[3]?.value ?? 0)}
              color="text-red-600"
            />
            <Metric
              label="Taxa de recuperação"
              value={`${data.recoveryRate.toFixed(1)}%`}
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Aging da carteira">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.aging}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                  >
                    {data.aging.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Evolução da inadimplência">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.monthly}>
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis unit="%" />
                  <Tooltip formatter={(v) => `${number(v).toFixed(1)}%`} />
                  <Area
                    dataKey="inadimplencia"
                    stroke="#dc2626"
                    fill="#fee2e2"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Quem cobrar primeiro">
              {data.debtors.length ? (
                <div className="divide-y">
                  {data.debtors.slice(0, 10).map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="py-3 flex justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-sm">
                          {index + 1}. {item.name}
                        </p>
                        <p className="text-xs text-red-500">
                          {item.days} dias em atraso
                        </p>
                      </div>
                      <b className="text-sm">{formatCurrency(item.value)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Nenhum recebível vencido.</Empty>
              )}
            </Panel>
          </div>
        </>
      ) : null}

      {tab === "crise" ? (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <Metric
              label="Receita para cobrir custos registrados"
              value={formatCurrency(data.costs)}
              color="text-red-600"
              detail="Receita necessária para empatar"
            />
            <Metric
              label="Runway"
              value={
                data.runway == null
                  ? "Sem base"
                  : `${data.runway.toFixed(1)} meses`
              }
              color={
                data.runway != null && data.runway >= 6
                  ? "text-green-700"
                  : "text-red-600"
              }
            />
            <Metric
              label="Margem após despesas registradas"
              value={
                data.contribution == null
                  ? "Sem receita"
                  : `${data.contribution.toFixed(1)}%`
              }
              color={
                data.contribution != null && data.contribution > 0
                  ? "text-green-700"
                  : "text-red-600"
              }
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Custos ranqueados">
              {data.rankedCosts.length ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, data.rankedCosts.length * 38)}
                >
                  <BarChart data={data.rankedCosts} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip formatter={(v) => formatCurrency(number(v))} />
                    <Bar dataKey="value" fill="#dc2626" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty>Cadastre despesas pagas para formar o ranking.</Empty>
              )}
            </Panel>
            <Panel title="Margem por categoria">
              {data.categoryMargins.length ? (
                <div className="divide-y">
                  {data.categoryMargins.map((item) => (
                    <div
                      key={item.name}
                      className="flex justify-between py-3 text-sm"
                    >
                      <span>{item.name}</span>
                      <b
                        className={
                          item.value >= 0 ? "text-green-700" : "text-red-600"
                        }
                      >
                        {item.value.toFixed(1)}%
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Associe receitas e despesas às mesmas categorias.</Empty>
              )}
            </Panel>
          </div>
        </>
      ) : null}

      {tab === "pessoas" ? (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <Metric
              label="Pessoas ativas"
              value={String(data.activePeople)}
              color="text-violet-700"
            />
            <Metric
              label="Receita por pessoa"
              value={
                data.activePeople ? formatCurrency(data.revenuePerPerson) : "—"
              }
            />
            <Metric
              label="Turnover (12m)"
              value="Sem registro"
              detail="Exige data de desligamento"
            />
            <Metric
              label="Absenteísmo"
              value="Sem registro"
              detail="Exige controle de ponto"
            />
          </div>
          <Panel title="Leitura gerencial">
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
              <p>
                O headcount soma administradores, colaboradores e corretores
                ativos.
              </p>
              <p>
                Horas extras, faltas e turnover aparecerão quando houver eventos
                de RH registrados; o painel não estima números.
              </p>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
