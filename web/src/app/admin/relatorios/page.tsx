"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, DollarSign, Building2, Users, Award } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  monthlySales,
  propertyTypeData,
  leadFunnelData,
  corretorRanking,
  serviceRevenue,
} from "@/lib/data/analytics";

const totalReceita = monthlySales.reduce((s, m) => s + m.receita, 0);
const totalVendas = monthlySales.reduce((s, m) => s + m.vendas, 0);
const totalLeads = monthlySales.reduce((s, m) => s + m.leads, 0);
const ticketMedio = Math.round(totalReceita / totalVendas);

const kpis = [
  {
    label: "Receita Total (12m)",
    value: formatCurrency(totalReceita),
    icon: DollarSign,
    delta: "+18% vs período anterior",
  },
  {
    label: "Imóveis Vendidos",
    value: String(totalVendas),
    icon: Building2,
    delta: "+4 vs período anterior",
  },
  {
    label: "Leads Captados",
    value: String(totalLeads),
    icon: Users,
    delta: "7.3% taxa de conversão",
  },
  {
    label: "Ticket Médio",
    value: formatCurrency(ticketMedio),
    icon: TrendingUp,
    delta: "+6% vs período anterior",
  },
];

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v}`;
}

export default function RelatoriosPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
          Relatórios & BI
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Últimos 12 meses · Jul/2024 – Jun/2025</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{k.label}</p>
              <k.icon size={16} className="text-gray-300" />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-2xl leading-none">{k.value}</p>
            <p className="text-xs mt-1 text-green-500">{k.delta}</p>
          </div>
        ))}
      </div>

      {/* Revenue area chart */}
      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
          Receita Mensal (R$)
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlySales} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F5C400" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F5C400" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Receita"]} />
            <Area type="monotone" dataKey="receita" stroke="#F5C400" strokeWidth={2.5} fill="url(#gradReceita)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sales + leads bar */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
            Vendas vs Leads por Mês
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySales} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" name="Leads" fill="#D1D5DB" radius={[2, 2, 0, 0]} />
              <Bar dataKey="vendas" name="Vendas" fill="#F5C400" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Property type pie */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
            Distribuição por Tipo
          </p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={propertyTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {propertyTypeData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [Number(v ?? 0), "Imóveis"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {propertyTypeData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-gray-600">{d.name}</span>
                  </div>
                  <span className="text-xs font-black text-[var(--brand-dark)]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Lead funnel */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
            Funil de Conversão
          </p>
          <div className="space-y-2">
            {leadFunnelData.map((s) => (
              <div key={s.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{s.stage}</span>
                  <span className="font-bold text-[var(--brand-dark)]">
                    {s.count} <span className="text-gray-400 font-normal">({s.pct}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-[var(--brand-yellow)] transition-all"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Corretor ranking */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
            Ranking de Corretores
          </p>
          <div className="space-y-3">
            {corretorRanking.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-black ${
                    i === 0
                      ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {i === 0 ? <Award size={12} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.vendas} vendas</p>
                </div>
                <p className="text-sm font-black text-[var(--brand-dark)] flex-shrink-0">
                  {formatCurrency(c.comissoes)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service revenue horizontal bar */}
      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
          Receita por Serviço
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={serviceRevenue} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="service" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Receita"]} />
            <Bar dataKey="receita" fill="#F5C400" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
