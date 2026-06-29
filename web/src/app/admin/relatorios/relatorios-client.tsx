"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, DollarSign, Building2, Users, Award, Download, ClipboardList, Scale } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v}`;
}

interface MonthlySale {
  month: string;
  receita: number;
  vendas: number;
  receitas: number;
  despesas: number;
}

interface PropertyType { name: string; value: number; color: string; }
interface FunnelStage { stage: string; count: number; pct: number; }
interface CorretorRank { name: string; comissoes: number; vendas: number; }
interface ServiceRev { service: string; receita: number; }

interface Props {
  totalImoveis: number;
  totalLeads: number;
  totalFinanciamentos: number;
  totalAvaliacoes: number;
  valorMedioAvaliacao: number;
  totalReceitas: number;
  totalDespesas: number;
  monthlySales: MonthlySale[];
  propertyTypeData: PropertyType[];
  leadFunnelData: FunnelStage[];
  corretorRanking: CorretorRank[];
  serviceRevenue: ServiceRev[];
  avaliacoesPorStatus: PropertyType[];
  fromDate: string;
  toDate: string;
}

export function RelatoriosClient({
  totalImoveis,
  totalLeads,
  totalFinanciamentos,
  totalAvaliacoes,
  valorMedioAvaliacao,
  totalReceitas,
  totalDespesas,
  monthlySales,
  propertyTypeData,
  leadFunnelData,
  corretorRanking,
  serviceRevenue,
  avaliacoesPorStatus,
  fromDate,
  toDate,
}: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);
  const [exporting, setExporting] = useState(false);

  const totalReceita = monthlySales.reduce((s, m) => s + m.receita, 0);
  const totalVendas = monthlySales.reduce((s, m) => s + m.vendas, 0);
  const ticketMedio = totalVendas > 0 ? Math.round(totalReceita / totalVendas) : 0;
  const resultado = totalReceitas - totalDespesas;

  function aplicarFiltro() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/admin/relatorios?${params.toString()}`);
  }

  async function exportarCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/relatorios/export?${params}`);
      if (!res.ok) throw new Error("Falha ao exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${from}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const kpis = [
    { label: "Comissões pagas", value: formatCurrency(totalReceita), icon: DollarSign, delta: `${totalVendas} vendas no período` },
    { label: "Imóveis ativos",  value: String(totalImoveis),         icon: Building2,  delta: `${totalFinanciamentos} financiamentos` },
    { label: "Leads captados",  value: String(totalLeads),           icon: Users,      delta: totalVendas > 0 ? `${((totalVendas / totalLeads) * 100).toFixed(1)}% conversão` : "Sem conversões" },
    { label: "Ticket médio",    value: ticketMedio > 0 ? formatCurrency(ticketMedio) : "—", icon: TrendingUp, delta: "por comissão paga" },
    { label: "Avaliações",      value: String(totalAvaliacoes),      icon: ClipboardList, delta: valorMedioAvaliacao > 0 ? `Média ${formatCurrency(valorMedioAvaliacao)}` : "Sem valor médio" },
    { label: "Receitas (DRE)",  value: formatCurrency(totalReceitas), icon: Scale, delta: `Despesas: ${formatCurrency(totalDespesas)}` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
            Relatórios & BI
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Resultado no período: <span className={resultado >= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>{formatCurrency(resultado)}</span>
          </p>
        </div>
        <button
          onClick={exportarCsv}
          disabled={exporting}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Download size={12} /> {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </div>

      {/* Date filter */}
      <div className="bg-white border border-gray-100 p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-sm border border-gray-200 px-3 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-sm border border-gray-200 px-3 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)] transition-colors"
          />
        </div>
        <button
          onClick={aplicarFiltro}
          className="text-xs font-bold px-4 py-1.5 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 transition-opacity"
        >
          Filtrar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{k.label}</p>
              <k.icon size={14} className="text-gray-300 shrink-0" />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl leading-none">{k.value}</p>
            <p className="text-[10px] mt-1 text-green-500">{k.delta}</p>
          </div>
        ))}
      </div>

      {/* Revenue area chart */}
      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Comissões Pagas (R$)</p>
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

      {/* Receitas vs Despesas */}
      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">DRE — Receitas vs Despesas (R$)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlySales} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0))]} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Property type pie */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Imóveis por Tipo</p>
          {propertyTypeData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhum imóvel cadastrado.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={propertyTypeData} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" strokeWidth={0}>
                    {propertyTypeData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [Number(v ?? 0), "Imóveis"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {propertyTypeData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-sm text-gray-600">{d.name}</span>
                    </div>
                    <span className="text-xs font-black text-[var(--brand-dark)]">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avaliações por status */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Avaliações por Status</p>
          {avaliacoesPorStatus.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhuma avaliação registrada.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={avaliacoesPorStatus} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" strokeWidth={0}>
                    {avaliacoesPorStatus.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [Number(v ?? 0), "Avaliações"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {avaliacoesPorStatus.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600 capitalize">{d.name}</span>
                    </div>
                    <span className="text-xs font-black text-[var(--brand-dark)]">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Lead funnel */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Funil de Conversão</p>
          <div className="space-y-2">
            {leadFunnelData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nenhum lead cadastrado.</p>
            ) : (
              leadFunnelData.map((s) => (
                <div key={s.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{s.stage}</span>
                    <span className="font-bold text-[var(--brand-dark)]">
                      {s.count} <span className="text-gray-400 font-normal">({s.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 overflow-hidden">
                    <div className="h-full bg-[var(--brand-yellow)] transition-all" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Corretor ranking */}
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Ranking de Corretores</p>
          <div className="space-y-3">
            {corretorRanking.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nenhuma comissão paga ainda.</p>
            ) : (
              corretorRanking.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className={`w-6 h-6 shrink-0 flex items-center justify-center text-xs font-black ${i === 0 ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-gray-100 text-gray-500"}`}>
                    {i === 0 ? <Award size={12} /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.vendas} comissões</p>
                  </div>
                  <p className="text-sm font-black text-[var(--brand-dark)] shrink-0">{formatCurrency(c.comissoes)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
