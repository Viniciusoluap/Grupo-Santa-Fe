"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText, Plus, Upload, RefreshCw, Wrench, CheckCircle2, Clock,
  AlertCircle, Search, X, Building2, ArrowUpRight, ArrowDownRight,
  Wifi, WifiOff, Landmark, Trash2, BarChart2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { criarCobranca, pagarLancamento } from "@/lib/actions/bpo";
import { criarContaBancaria, excluirContaBancaria, atualizarStatusTransacao } from "@/lib/actions/banco";
import { TrendingUp, DollarSign, Users, Award } from "lucide-react";

export interface LancamentoComCliente {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  clienteNomeLivre: string | null;
  tipo: string;
  descricao: string;
  valor: number;
  vencimento: string;
  pago: boolean;
  pagoEm: string | null;
  competencia: string;
  centroCustos: string | null;
}

export interface TransacaoBancariaData {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: string;
  categoria: string | null;
  status: string;
  externalId: string | null;
}

export interface ContaBancariaData {
  id: string;
  banco: string;
  agencia: string | null;
  conta: string;
  tipo: string;
  descricao: string | null;
  saldoAtual: number;
  ativo: boolean;
  pluggyItemId: string | null;
  pluggyAccountId: string | null;
  webhookUrl: string | null;
  ultimaSincronizacao: string | null;
  transacoes: TransacaoBancariaData[];
}

interface RelatoriosData {
  totalImoveis: number;
  totalLeads: number;
  totalFinanciamentos: number;
  monthlySales: { month: string; receita: number; vendas: number; leads: number }[];
  propertyTypeData: { name: string; value: number; color: string }[];
  leadFunnelData: { stage: string; count: number; pct: number }[];
  corretorRanking: { name: string; comissoes: number; vendas: number }[];
  serviceRevenue: { service: string; receita: number }[];
}

interface Props {
  lancamentos: LancamentoComCliente[];
  clientes: { id: string; razaoSocial: string }[];
  leads: { id: string; nome: string; telefone: string; email: string | null }[];
  contas: ContaBancariaData[];
  relatorios: RelatoriosData;
}

type Aba = "cobracas" | "despesas" | "dre" | "bancos" | "relatorios" | "contabilidade";
type StatusFilter = "todas" | "pendentes" | "pagas" | "vencidas" | "parciais";
type TipoFilter = "todos" | "honorario" | "reembolso" | "outros";

const BANCOS_BR = ["Banco do Brasil", "Caixa Econômica Federal", "Bradesco", "Itaú", "Santander", "Nubank", "Inter", "Sicredi", "Sicoob", "BTG Pactual", "Safra", "C6 Bank", "PagBank", "Mercado Pago", "Outro"];
const BANCO_CORES: Record<string, string> = {
  "Nubank": "bg-purple-100 text-purple-700",
  "Itaú": "bg-orange-100 text-orange-700",
  "Bradesco": "bg-red-100 text-red-700",
  "Banco do Brasil": "bg-yellow-100 text-yellow-700",
  "Caixa Econômica Federal": "bg-blue-100 text-blue-700",
  "Santander": "bg-red-100 text-red-600",
  "Inter": "bg-orange-100 text-orange-600",
};

const nowDate = () => new Date();

function isVencido(l: LancamentoComCliente) {
  return !l.pago && new Date(l.vencimento) < nowDate();
}
function isPendente(l: LancamentoComCliente) {
  return !l.pago && new Date(l.vencimento) >= nowDate();
}

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v}`;
}

function BpoRelatorios({ relatorios }: { relatorios: RelatoriosData }) {
  const { totalImoveis, totalLeads, totalFinanciamentos, monthlySales, propertyTypeData, leadFunnelData, corretorRanking, serviceRevenue } = relatorios;
  const totalReceita = monthlySales.reduce((s, m) => s + m.receita, 0);
  const totalVendas = monthlySales.reduce((s, m) => s + m.vendas, 0);
  const ticketMedio = totalVendas > 0 ? Math.round(totalReceita / totalVendas) : 0;

  const now = new Date();
  const periodoLabel = (() => {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const startLabel = start.toLocaleString("pt-BR", { month: "short", year: "numeric" });
    const endLabel = now.toLocaleString("pt-BR", { month: "short", year: "numeric" });
    return `${startLabel} – ${endLabel}`;
  })();

  const kpis = [
    { label: "Receita Total (12m)", value: formatCurrency(totalReceita), icon: DollarSign, delta: `${totalVendas} comissões pagas` },
    { label: "Imóveis Ativos",      value: String(totalImoveis),          icon: Building2,  delta: `${totalFinanciamentos} financiamentos` },
    { label: "Leads Captados",      value: String(totalLeads),            icon: Users,       delta: totalVendas > 0 ? `${((totalVendas / totalLeads) * 100).toFixed(1)}% taxa de conversão` : "Sem conversões" },
    { label: "Ticket Médio",        value: ticketMedio > 0 ? formatCurrency(ticketMedio) : "—", icon: TrendingUp, delta: "por comissão paga" },
  ];

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400 mt-1">Últimos 12 meses · {periodoLabel}</p>

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

      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Receita Mensal (R$)</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlySales} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradReceitaBpo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F5C400" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F5C400" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), "Receita"]} />
            <Area type="monotone" dataKey="receita" stroke="#F5C400" strokeWidth={2.5} fill="url(#gradReceitaBpo)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Vendas vs Leads por Mês</p>
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

        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Distribuição por Tipo</p>
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
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-sm text-gray-600">{d.name}</span>
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
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Funil de Conversão</p>
          <div className="space-y-2">
            {leadFunnelData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nenhum lead cadastrado.</p>
            ) : leadFunnelData.map((s) => (
              <div key={s.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{s.stage}</span>
                  <span className="font-bold text-[var(--brand-dark)]">{s.count} <span className="text-gray-400 font-normal">({s.pct}%)</span></span>
                </div>
                <div className="h-2 bg-gray-100 overflow-hidden">
                  <div className="h-full bg-[var(--brand-yellow)] transition-all" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Ranking de Corretores</p>
          <div className="space-y-3">
            {corretorRanking.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nenhuma comissão paga ainda.</p>
            ) : corretorRanking.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className={`w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-black ${i === 0 ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-gray-100 text-gray-500"}`}>
                  {i === 0 ? <Award size={12} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.vendas} comissões</p>
                </div>
                <p className="text-sm font-black text-[var(--brand-dark)] flex-shrink-0">{formatCurrency(c.comissoes)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Receita por Serviço</p>
        <ResponsiveContainer width="100%" height={Math.max(80, serviceRevenue.length * 40)}>
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

export function BpoClient({ lancamentos, clientes, leads, contas: initialContas, relatorios }: Props) {
  const [aba, setAba] = useState<Aba>("cobracas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [anoFilter, setAnoFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalTipo, setModalTipo] = useState<"cobranca" | "despesa" | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadSelectedId, setLeadSelectedId] = useState("");
  const [leadSelectedNome, setLeadSelectedNome] = useState("");
  const [showAddConta, setShowAddConta] = useState(false);
  const [showSetupPluggy, setShowSetupPluggy] = useState(false);
  const [contaExpandida, setContaExpandida] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [contas, setContas] = useState<ContaBancariaData[]>(initialContas);

  // KPIs cobranças
  const cobracasAll = lancamentos.filter((l) => l.tipo !== "despesa");
  const totalEsperado = cobracasAll.reduce((s, l) => s + l.valor, 0);
  const recebido = cobracasAll.filter((l) => l.pago).reduce((s, l) => s + l.valor, 0);
  const pendente = cobracasAll.filter(isPendente).reduce((s, l) => s + l.valor, 0);
  const vencido = cobracasAll.filter(isVencido).reduce((s, l) => s + l.valor, 0);

  const allCompetencias = [...new Set(lancamentos.map((l) => l.competencia))].sort().reverse();
  const allMeses = [...new Set(allCompetencias.map((c) => c.split("-")[1]))].sort();
  const allAnos = [...new Set(allCompetencias.map((c) => c.split("-")[0]))].sort().reverse();

  function filterByCommon(items: LancamentoComCliente[]) {
    return items.filter((l) => {
      if (search && !l.clienteNome.toLowerCase().includes(search.toLowerCase()) && !l.descricao.toLowerCase().includes(search.toLowerCase())) return false;
      if (clienteFilter && l.clienteId !== clienteFilter) return false;
      if (mesFilter && !l.competencia.endsWith(`-${mesFilter}`)) return false;
      if (anoFilter && !l.competencia.startsWith(`${anoFilter}-`)) return false;
      return true;
    });
  }

  const cobracasBase = lancamentos.filter((l) => l.tipo !== "despesa");
  const cobracasFiltered = filterByCommon(cobracasBase).filter((l) => {
    if (statusFilter === "pendentes") return isPendente(l);
    if (statusFilter === "pagas") return l.pago;
    if (statusFilter === "vencidas") return isVencido(l);
    if (statusFilter === "parciais") return false;
    return true;
  }).filter((l) => {
    if (tipoFilter === "todos") return true;
    if (tipoFilter === "honorario") return l.tipo === "honorario";
    if (tipoFilter === "reembolso") return l.tipo === "reembolso";
    if (tipoFilter === "outros") return l.tipo !== "honorario" && l.tipo !== "reembolso" && l.tipo !== "despesa";
    return true;
  });

  const despesasBase = lancamentos.filter((l) => l.tipo === "despesa");
  const despesasFiltered = filterByCommon(despesasBase).filter((l) => {
    if (statusFilter === "pendentes") return isPendente(l);
    if (statusFilter === "pagas") return l.pago;
    if (statusFilter === "vencidas") return isVencido(l);
    return true;
  });

  const despesaTotal = despesasBase.reduce((s, l) => s + l.valor, 0);
  const despesaPaga = despesasBase.filter((l) => l.pago).reduce((s, l) => s + l.valor, 0);
  const despesaPendente = despesasBase.filter(isPendente).reduce((s, l) => s + l.valor, 0);
  const despesaVencida = despesasBase.filter(isVencido).reduce((s, l) => s + l.valor, 0);

  const dreMap = new Map<string, { cobracas: number; despesas: number }>();
  lancamentos.forEach((l) => {
    const entry = dreMap.get(l.competencia) ?? { cobracas: 0, despesas: 0 };
    if (l.tipo === "despesa") entry.despesas += l.valor;
    else entry.cobracas += l.valor;
    dreMap.set(l.competencia, entry);
  });
  const dreRows = [...dreMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const dreTotalCobracas = dreRows.reduce((s, [, v]) => s + v.cobracas, 0);
  const dreTotalDespesas = dreRows.reduce((s, [, v]) => s + v.despesas, 0);

  // Bank KPIs
  const saldoTotal = contas.filter((c) => c.ativo).reduce((s, c) => s + c.saldoAtual, 0);
  const creditosMes = contas.flatMap((c) => c.transacoes).filter((t) => t.tipo === "credito" && t.data.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, t) => s + t.valor, 0);
  const debitosMes = contas.flatMap((c) => c.transacoes).filter((t) => t.tipo === "debito" && t.data.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, t) => s + t.valor, 0);
  const transacoesPendentes = contas.flatMap((c) => c.transacoes).filter((t) => t.status === "pendente").length;

  function handlePagar(id: string) {
    startTransition(async () => { await pagarLancamento(id); });
  }

  function closeModal() {
    setShowModal(false);
    setModalTipo(null);
    setLeadSearch("");
    setLeadSelectedId("");
    setLeadSelectedNome("");
  }

  async function handleCriarCobranca(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await criarCobranca(formData);
      closeModal();
      setModalFeedback(modalTipo === "despesa" ? "Despesa registrada!" : "Cobrança criada com sucesso!");
      setTimeout(() => setModalFeedback(null), 3000);
    });
  }

  async function handleAdicionarConta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await criarContaBancaria(formData);
      setShowAddConta(false);
      setModalFeedback("Conta bancária adicionada!");
      setTimeout(() => setModalFeedback(null), 3000);
    });
  }

  async function handleSincronizar(contaId: string) {
    setSyncingId(contaId);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/banco/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contaId }),
      });
      const data = await res.json() as { ok: boolean; configurado?: boolean; mensagem?: string; sincronizados?: number; saldo?: number };
      if (data.ok) {
        setSyncMsg({ id: contaId, msg: `${data.sincronizados} transações sincronizadas. Saldo: ${formatCurrency(data.saldo ?? 0)}`, ok: true });
      } else if (data.configurado === false) {
        setShowSetupPluggy(true);
      } else {
        setSyncMsg({ id: contaId, msg: "Erro ao sincronizar. Tente novamente.", ok: false });
      }
    } catch {
      setSyncMsg({ id: contaId, msg: "Erro de conexão.", ok: false });
    } finally {
      setSyncingId(null);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  }

  async function handleExcluirConta(id: string, banco: string) {
    if (!confirm(`Excluir a conta "${banco}"? Todas as transações vinculadas serão removidas.`)) return;
    startTransition(async () => {
      await excluirContaBancaria(id);
      setContas((prev) => prev.filter((c) => c.id !== id));
    });
  }

  async function handleConciliar(txId: string, status: string) {
    startTransition(async () => { await atualizarStatusTransacao(txId, status); });
  }

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const statusTabClass = (s: StatusFilter) =>
    `px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${statusFilter === s ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-500 hover:bg-gray-100"}`;
  const tipoTabClass = (t: TipoFilter) =>
    `px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${tipoFilter === t ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-500 hover:bg-gray-100"}`;
  const abaClass = (a: Aba) =>
    `px-5 py-2.5 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${aba === a ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]" : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"}`;

  function getStatusBadge(l: LancamentoComCliente) {
    if (l.pago) return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 uppercase"><CheckCircle2 size={10} /> Pago</span>;
    if (isVencido(l)) return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 uppercase"><AlertCircle size={10} /> Vencido</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-yellow-100 text-yellow-700 uppercase"><Clock size={10} /> Pendente</span>;
  }

  function LancamentoTable({ items }: { items: LancamentoComCliente[] }) {
    return (
      <div className="bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-dark)]">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">Descrição</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Competência</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Vencimento</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">Valor</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum lançamento encontrado.</td></tr>
              ) : items.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-[var(--brand-dark)] text-xs">{l.clienteNome}</p></td>
                  <td className="px-4 py-3 hidden md:table-cell"><p className="text-xs text-gray-600 max-w-xs truncate">{l.descricao}</p></td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500 hidden sm:table-cell">{l.competencia}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{new Date(l.vencimento).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right font-bold text-[var(--brand-dark)] text-xs">{formatCurrency(l.valor)}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(l)}</td>
                  <td className="px-4 py-3 text-center">
                    {!l.pago ? (
                      <button onClick={() => handlePagar(l.id)} disabled={isPending}
                        className="text-xs font-bold text-[var(--brand-dark)] bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] px-3 py-1 transition-colors disabled:opacity-50">
                        Pagar
                      </button>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">BPO Financeiro</h1>
          <p className="text-gray-400 text-sm mt-0.5">Gestão de pagamentos, recebimentos e contas bancárias</p>
        </div>
        <Link href="/admin/bpo" className="text-xs font-bold text-[var(--brand-yellow)] hover:underline mt-1">
          Gerenciar Clientes
        </Link>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => alert("Funcionalidade em breve")}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors">
          <FileText size={13} /> Gerar PDF
        </button>
        <button onClick={() => { setShowModal(true); setModalTipo(null); }}
          className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2 transition-colors">
          <Plus size={13} /> Novo
        </button>
        <button onClick={() => alert("Funcionalidade em breve")}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors">
          <Upload size={13} /> Importar Histórico
        </button>
        <button onClick={() => { setAba("bancos"); setShowAddConta(true); }}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors">
          <Landmark size={13} /> Adicionar Conta
        </button>
        <button onClick={() => alert("Funcionalidade em breve")}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors">
          <Wrench size={13} /> Corrigir Dados/BPO
        </button>
      </div>

      {/* Feedback toast */}
      {modalFeedback && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 flex items-center justify-between">
          <span>{modalFeedback}</span>
          <button onClick={() => setModalFeedback(null)}><X size={14} /></button>
        </div>
      )}

      {/* Main tabs */}
      <div className="border-b border-gray-200 flex gap-0 overflow-x-auto">
        <button className={abaClass("cobracas")} onClick={() => setAba("cobracas")}>Cobranças</button>
        <button className={abaClass("despesas")} onClick={() => setAba("despesas")}>Despesas</button>
        <button className={abaClass("dre")} onClick={() => setAba("dre")}>DRE Consolidado</button>
        <button className={abaClass("bancos")} onClick={() => setAba("bancos")}>
          <span className="flex items-center gap-1.5">
            <Landmark size={13} /> Contas Bancárias
            {contas.length > 0 && <span className="bg-[var(--brand-yellow)] text-[var(--brand-dark)] text-[9px] font-black px-1.5 py-0.5 rounded-sm">{contas.length}</span>}
          </span>
        </button>
        <button className={abaClass("relatorios")} onClick={() => setAba("relatorios")}>
          <span className="flex items-center gap-1.5"><BarChart2 size={13} /> Relatórios</span>
        </button>
        <button className={abaClass("contabilidade")} onClick={() => setAba("contabilidade")}>
          <span className="flex items-center gap-1.5"><FileText size={13} /> Contabilidade</span>
        </button>
      </div>

      {/* KPI Cards — not shown in DRE, Bancos or Relatórios */}
      {aba !== "dre" && aba !== "bancos" && aba !== "relatorios" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {aba === "cobracas" ? (<>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Esperado</p>
              <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{formatCurrency(totalEsperado)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recebido</p>
              <p className="font-black text-green-600 text-lg leading-none">{formatCurrency(recebido)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pendente</p>
              <p className="font-black text-yellow-600 text-lg leading-none">{formatCurrency(pendente)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Vencido</p>
              <p className="font-black text-red-600 text-lg leading-none">{formatCurrency(vencido)}</p>
            </div>
          </>) : (<>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total</p>
              <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{formatCurrency(despesaTotal)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pagas</p>
              <p className="font-black text-green-600 text-lg leading-none">{formatCurrency(despesaPaga)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pendentes</p>
              <p className="font-black text-yellow-600 text-lg leading-none">{formatCurrency(despesaPendente)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Vencidas</p>
              <p className="font-black text-red-600 text-lg leading-none">{formatCurrency(despesaVencida)}</p>
            </div>
          </>)}
        </div>
      )}

      {/* ─── COBRANÇAS ─── */}
      {aba === "cobracas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {(["todas", "pendentes", "pagas", "vencidas", "parciais"] as StatusFilter[]).map((s) => (
              <button key={s} className={statusTabClass(s)} onClick={() => setStatusFilter(s)}>
                {s === "todas" ? "Todas" : s === "pendentes" ? "Pendentes" : s === "pagas" ? "Pagas" : s === "vencidas" ? "Vencidas" : "Parciais"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {(["todos", "honorario", "reembolso", "outros"] as TipoFilter[]).map((t) => (
              <button key={t} className={tipoTabClass(t)} onClick={() => setTipoFilter(t)}>
                {t === "todos" ? "Todos os tipos" : t === "honorario" ? "Honorários" : t === "reembolso" ? "Reembolsos" : "Outros"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar cliente ou descrição..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white" />
            </div>
            <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
              <option value="">Todos os clientes</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
            </select>
            <select value={mesFilter} onChange={(e) => setMesFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
              <option value="">Todos os meses</option>
              {allMeses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={anoFilter} onChange={(e) => setAnoFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
              <option value="">Todos os anos</option>
              {allAnos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <LancamentoTable items={cobracasFiltered} />
        </div>
      )}

      {/* ─── DESPESAS ─── */}
      {aba === "despesas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {(["todas", "pendentes", "pagas", "vencidas"] as StatusFilter[]).map((s) => (
              <button key={s} className={statusTabClass(s)} onClick={() => setStatusFilter(s)}>
                {s === "todas" ? "Todas" : s === "pendentes" ? "Pendentes" : s === "pagas" ? "Pagas" : "Vencidas"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar cliente ou descrição..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white" />
            </div>
            <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
              <option value="">Todos os clientes</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
            </select>
            <select value={mesFilter} onChange={(e) => setMesFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
              <option value="">Todos os meses</option>
              {allMeses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={anoFilter} onChange={(e) => setAnoFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white">
              <option value="">Todos os anos</option>
              {allAnos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <LancamentoTable items={despesasFiltered} />
        </div>
      )}

      {/* ─── DRE ─── */}
      {aba === "dre" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-dark)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide">Competência</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cobranças</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">Despesas</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wide">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dreRows.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum lançamento para consolidar.</td></tr>
                  ) : (<>
                    {dreRows.map(([comp, vals]) => {
                      const resultado = vals.cobracas - vals.despesas;
                      return (
                        <tr key={comp} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-[var(--brand-dark)]">{comp}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-bold">{formatCurrency(vals.cobracas)}</td>
                          <td className="px-4 py-3 text-right text-red-500 font-bold">{formatCurrency(vals.despesas)}</td>
                          <td className={`px-4 py-3 text-right font-black ${resultado >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(resultado)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-[var(--brand-dark)]">
                      <td className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total</td>
                      <td className="px-4 py-3 text-right font-black text-green-400">{formatCurrency(dreTotalCobracas)}</td>
                      <td className="px-4 py-3 text-right font-black text-red-400">{formatCurrency(dreTotalDespesas)}</td>
                      <td className={`px-4 py-3 text-right font-black ${dreTotalCobracas - dreTotalDespesas >= 0 ? "text-green-300" : "text-red-300"}`}>{formatCurrency(dreTotalCobracas - dreTotalDespesas)}</td>
                    </tr>
                  </>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTAS BANCÁRIAS ─── */}
      {aba === "bancos" && (
        <div className="space-y-5">
          {/* Bank KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Saldo Total</p>
              <p className={`font-black text-lg leading-none ${saldoTotal >= 0 ? "text-[var(--brand-dark)]" : "text-red-600"}`}>{formatCurrency(saldoTotal)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{contas.filter((c) => c.ativo).length} conta(s) ativas</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Créditos (mês)</p>
              <p className="font-black text-green-600 text-lg leading-none flex items-center gap-1"><ArrowUpRight size={16} />{formatCurrency(creditosMes)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Débitos (mês)</p>
              <p className="font-black text-red-600 text-lg leading-none flex items-center gap-1"><ArrowDownRight size={16} />{formatCurrency(debitosMes)}</p>
            </div>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">A Conciliar</p>
              <p className="font-black text-yellow-600 text-lg leading-none">{transacoesPendentes}</p>
              <p className="text-[10px] text-gray-400 mt-1">transação(ões)</p>
            </div>
          </div>

          {/* Pluggy setup banner */}
          {contas.some((c) => !c.pluggyAccountId) && (
            <div className="bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <WifiOff size={14} className="text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700 font-medium">
                  Sincronização automática via Open Finance (Pluggy). Configure <code className="bg-blue-100 px-1">PLUGGY_CLIENT_ID</code> e <code className="bg-blue-100 px-1">PLUGGY_CLIENT_SECRET</code> nas variáveis de ambiente da Vercel.
                </p>
              </div>
              <button onClick={() => setShowSetupPluggy(true)} className="text-xs font-bold text-blue-700 hover:underline whitespace-nowrap">Como configurar</button>
            </div>
          )}

          {/* Add Conta button */}
          <div className="flex justify-between items-center">
            <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">Contas Cadastradas</h2>
            <button onClick={() => setShowAddConta(true)}
              className="flex items-center gap-1.5 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-3 py-2 hover:bg-[var(--brand-yellow-dark)] transition-colors">
              <Plus size={12} /> Adicionar Conta
            </button>
          </div>

          {/* Account cards */}
          {contas.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
              <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma conta bancária cadastrada</p>
              <p className="text-gray-400 text-sm mt-1">Adicione uma conta para acompanhar extratos e sincronizar transações</p>
              <button onClick={() => setShowAddConta(true)}
                className="mt-4 inline-flex items-center gap-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase px-4 py-2">
                <Plus size={12} /> Adicionar Conta
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {contas.map((conta) => {
                const isExpanded = contaExpandida === conta.id;
                const corBanco = BANCO_CORES[conta.banco] ?? "bg-gray-100 text-gray-700";
                const txPendentes = conta.transacoes.filter((t) => t.status === "pendente");
                const isSyncing = syncingId === conta.id;

                return (
                  <div key={conta.id} className="bg-white border border-gray-100 overflow-hidden">
                    <div className="p-4 flex items-center gap-4 flex-wrap">
                      <div className={`px-2 py-1 text-[10px] font-black uppercase rounded-sm ${corBanco}`}>{conta.banco}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--brand-dark)] text-sm">
                          {conta.descricao ?? `${conta.tipo.charAt(0).toUpperCase() + conta.tipo.slice(1)} — Ag. ${conta.agencia ?? "—"} / C. ${conta.conta}`}
                        </p>
                        <p className="text-xs text-gray-400">{conta.banco} · Ag. {conta.agencia ?? "—"} · {conta.conta} · {conta.tipo}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg leading-none ${conta.saldoAtual >= 0 ? "text-[var(--brand-dark)]" : "text-red-600"}`}>
                          {formatCurrency(conta.saldoAtual)}
                        </p>
                        {conta.ultimaSincronizacao && (
                          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-end gap-0.5">
                            <Wifi size={9} className="text-green-500" /> Sync {new Date(conta.ultimaSincronizacao).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleSincronizar(conta.id)} disabled={isSyncing}
                          title="Sincronizar transações"
                          className="flex items-center gap-1 text-xs font-bold border border-gray-200 text-gray-600 px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50">
                          <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
                          {isSyncing ? "Sync..." : "Sincronizar"}
                        </button>
                        <button onClick={() => setContaExpandida(isExpanded ? null : conta.id)}
                          className="text-xs font-bold border border-gray-200 text-gray-600 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                          {isExpanded ? "Ocultar" : `Extratos (${conta.transacoes.length})`}
                          {txPendentes.length > 0 && <span className="ml-1 bg-yellow-100 text-yellow-700 px-1 rounded-sm text-[9px]">{txPendentes.length}</span>}
                        </button>
                        <button onClick={() => handleExcluirConta(conta.id, conta.banco)} disabled={isPending}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1 disabled:opacity-30">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Sync feedback */}
                    {syncMsg?.id === conta.id && (
                      <div className={`px-4 py-2 text-xs font-medium border-t ${syncMsg.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                        {syncMsg.msg}
                      </div>
                    )}

                    {/* Transactions */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {conta.transacoes.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">Nenhuma transação. Clique em Sincronizar para buscar do banco.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left font-bold text-gray-400 uppercase tracking-wide">Data</th>
                                  <th className="px-4 py-2 text-left font-bold text-gray-400 uppercase tracking-wide">Descrição</th>
                                  <th className="px-4 py-2 text-left font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                                  <th className="px-4 py-2 text-right font-bold text-gray-400 uppercase tracking-wide">Valor</th>
                                  <th className="px-4 py-2 text-center font-bold text-gray-400 uppercase tracking-wide">Status</th>
                                  <th className="px-4 py-2 text-center font-bold text-gray-400 uppercase tracking-wide">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {conta.transacoes.slice(0, 50).map((tx) => (
                                  <tr key={tx.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-500">{new Date(tx.data).toLocaleDateString("pt-BR")}</td>
                                    <td className="px-4 py-2 text-[var(--brand-dark)] font-medium max-w-xs truncate">{tx.descricao}</td>
                                    <td className="px-4 py-2 text-gray-400 hidden md:table-cell">{tx.categoria ?? "—"}</td>
                                    <td className={`px-4 py-2 text-right font-bold ${tx.tipo === "credito" ? "text-green-600" : "text-red-600"}`}>
                                      {tx.tipo === "credito" ? "+" : "-"}{formatCurrency(tx.valor)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {tx.status === "conciliado" ? (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 uppercase">Conciliado</span>
                                      ) : tx.status === "ignorado" ? (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 uppercase">Ignorado</span>
                                      ) : (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-yellow-100 text-yellow-700 uppercase">Pendente</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {tx.status === "pendente" && (
                                        <div className="flex items-center justify-center gap-1">
                                          <button onClick={() => handleConciliar(tx.id, "conciliado")}
                                            className="text-[9px] font-bold px-2 py-0.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors">
                                            ✓ Conciliar
                                          </button>
                                          <button onClick={() => handleConciliar(tx.id, "ignorado")}
                                            className="text-[9px] font-bold px-2 py-0.5 bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
                                            Ignorar
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {conta.transacoes.length > 50 && (
                              <p className="text-center text-xs text-gray-400 py-3">Mostrando 50 de {conta.transacoes.length} transações</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: Novo (Cobrança ou Despesa) ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">
                {modalTipo === null ? "Novo Lançamento" : modalTipo === "cobranca" ? "Nova Cobrança" : "Nova Despesa"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            {/* Step 1: type selection */}
            {modalTipo === null && (
              <div className="px-6 py-8">
                <p className="text-sm text-gray-500 mb-6 text-center">O que deseja registrar?</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setModalTipo("cobranca")}
                    className="border-2 border-gray-100 hover:border-[var(--brand-yellow)] p-6 text-center transition-all group">
                    <ArrowUpRight size={28} className="text-green-500 mx-auto mb-3" />
                    <p className="font-black text-[var(--brand-dark)] uppercase text-sm">Cobrança</p>
                    <p className="text-xs text-gray-400 mt-1">Honorários, reembolsos e recebimentos</p>
                  </button>
                  <button onClick={() => setModalTipo("despesa")}
                    className="border-2 border-gray-100 hover:border-[var(--brand-yellow)] p-6 text-center transition-all group">
                    <ArrowDownRight size={28} className="text-red-500 mx-auto mb-3" />
                    <p className="font-black text-[var(--brand-dark)] uppercase text-sm">Despesa</p>
                    <p className="text-xs text-gray-400 mt-1">Gastos, fornecedores e custos</p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2a: Cobrança form */}
            {modalTipo === "cobranca" && (
              <form onSubmit={handleCriarCobranca} className="px-6 py-5 space-y-4">
                <input type="hidden" name="tipo" value="honorario" />

                {/* Client: BPO client or lead */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente *</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar cliente BPO ou lead..."
                      value={leadSearch}
                      onChange={(e) => { setLeadSearch(e.target.value); setLeadSelectedId(""); setLeadSelectedNome(""); }}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                    />
                    {leadSearch && !leadSelectedId && (
                      <div className="absolute z-20 w-full bg-white border border-gray-200 shadow-lg mt-0.5 max-h-40 overflow-y-auto">
                        {clientes.filter((c) => c.razaoSocial.toLowerCase().includes(leadSearch.toLowerCase())).map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setLeadSelectedId(c.id); setLeadSelectedNome(c.razaoSocial); setLeadSearch(c.razaoSocial); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <span className="font-medium">{c.razaoSocial}</span>
                            <span className="text-gray-400 text-xs ml-2">BPO</span>
                          </button>
                        ))}
                        {leads.filter((l) => l.nome.toLowerCase().includes(leadSearch.toLowerCase())).map((l) => (
                          <button key={l.id} type="button"
                            onClick={() => { setLeadSelectedId(""); setLeadSelectedNome(l.nome); setLeadSearch(l.nome); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <span className="font-medium">{l.nome}</span>
                            <span className="text-gray-400 text-xs ml-2">Lead</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="hidden" name="clienteId" value={leadSelectedId} />
                  <input type="hidden" name="clienteNomeLivre" value={leadSelectedId ? "" : leadSelectedNome} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Cobrança *</label>
                  <select name="tipo" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                    <option value="honorario">Honorário Mensal</option>
                    <option value="reembolso">Reembolso</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Centro de Custos</label>
                  <input name="centroCustos" type="text" placeholder="Ex: BPO, Corretagem, Obras..."
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição *</label>
                  <input name="descricao" type="text" required placeholder="Ex: Honorários BPO — julho/2026"
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor (R$) *</label>
                    <input name="valor" type="number" step="0.01" min="0" required
                      className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Competência *</label>
                    <input name="competencia" type="month" required defaultValue={currentMonth}
                      className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Vencimento *</label>
                  <input name="vencimento" type="date" required
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModalTipo(null)}
                    className="flex-1 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider py-2.5 hover:bg-gray-50 transition-colors">Voltar</button>
                  <button type="submit" disabled={isPending || (!leadSelectedId && !leadSelectedNome)}
                    className="flex-1 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2.5 transition-colors disabled:opacity-50">
                    {isPending ? "Salvando..." : "Criar Cobrança"}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2b: Despesa form */}
            {modalTipo === "despesa" && (
              <form onSubmit={handleCriarCobranca} className="px-6 py-5 space-y-4">
                {/* Client: BPO client or lead */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Cliente / Referência *</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar cliente BPO ou lead..."
                      value={leadSearch}
                      onChange={(e) => { setLeadSearch(e.target.value); setLeadSelectedId(""); setLeadSelectedNome(""); }}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                    />
                    {leadSearch && !leadSelectedId && (
                      <div className="absolute z-20 w-full bg-white border border-gray-200 shadow-lg mt-0.5 max-h-40 overflow-y-auto">
                        {clientes.filter((c) => c.razaoSocial.toLowerCase().includes(leadSearch.toLowerCase())).map((c) => (
                          <button key={c.id} type="button"
                            onClick={() => { setLeadSelectedId(c.id); setLeadSelectedNome(c.razaoSocial); setLeadSearch(c.razaoSocial); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <span className="font-medium">{c.razaoSocial}</span>
                            <span className="text-gray-400 text-xs ml-2">BPO</span>
                          </button>
                        ))}
                        {leads.filter((l) => l.nome.toLowerCase().includes(leadSearch.toLowerCase())).map((l) => (
                          <button key={l.id} type="button"
                            onClick={() => { setLeadSelectedId(""); setLeadSelectedNome(l.nome); setLeadSearch(l.nome); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <span className="font-medium">{l.nome}</span>
                            <span className="text-gray-400 text-xs ml-2">Lead</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="hidden" name="clienteId" value={leadSelectedId} />
                  <input type="hidden" name="clienteNomeLivre" value={leadSelectedId ? "" : leadSelectedNome} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Despesa *</label>
                  <select name="tipo" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                    <option value="despesa">Despesa Operacional</option>
                    <option value="despesa_pessoal">Folha / Pessoal</option>
                    <option value="despesa_marketing">Marketing</option>
                    <option value="despesa_imposto">Impostos / Taxas</option>
                    <option value="despesa_aluguel">Aluguel / Infraestrutura</option>
                    <option value="despesa_fornecedor">Fornecedor / Serviços</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Centro de Custos</label>
                  <input name="centroCustos" type="text" placeholder="Ex: Administrativo, BPO, Obras..."
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição *</label>
                  <input name="descricao" type="text" required placeholder="Ex: Aluguel sala comercial — julho/2026"
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Valor (R$) *</label>
                    <input name="valor" type="number" step="0.01" min="0" required
                      className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Competência *</label>
                    <input name="competencia" type="month" required defaultValue={currentMonth}
                      className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Vencimento *</label>
                  <input name="vencimento" type="date" required
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModalTipo(null)}
                    className="flex-1 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider py-2.5 hover:bg-gray-50 transition-colors">Voltar</button>
                  <button type="submit" disabled={isPending || (!leadSelectedId && !leadSelectedNome)}
                    className="flex-1 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2.5 transition-colors disabled:opacity-50">
                    {isPending ? "Salvando..." : "Registrar Despesa"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Adicionar Conta Bancária ─── */}
      {showAddConta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">Adicionar Conta Bancária</h2>
              <button onClick={() => setShowAddConta(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdicionarConta} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Banco *</label>
                <select name="banco" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                  <option value="">Selecionar banco...</option>
                  {BANCOS_BR.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de conta *</label>
                <select name="tipo" required className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50">
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="pagamento">Conta de Pagamento</option>
                  <option value="investimento">Investimento</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Agência</label>
                  <input name="agencia" type="text" placeholder="Ex: 0001"
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Conta *</label>
                  <input name="conta" type="text" required placeholder="Ex: 12345-6"
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Apelido da conta</label>
                <input name="descricao" type="text" placeholder="Ex: Conta principal"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Saldo atual (R$)</label>
                <input name="saldoAtual" type="number" step="0.01" defaultValue="0"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Integração / Open Finance (opcional)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">ID da Conta na API (Pluggy Account ID)</label>
                    <input name="pluggyAccountId" type="text" placeholder="Ex: a1b2c3d4-e5f6-..."
                      className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 font-mono text-xs" />
                    <p className="text-[10px] text-gray-400 mt-1">ID retornado pelo Pluggy após conectar o banco. Habilita sincronização automática.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">URL do Webhook</label>
                    <input name="webhookUrl" type="url" placeholder="https://seusite.com/api/banco/webhook"
                      className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 font-mono text-xs" />
                    <p className="text-[10px] text-gray-400 mt-1">URL que receberá notificações do banco em tempo real. Registre no painel do Pluggy.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddConta(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider py-2.5 hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2.5 transition-colors disabled:opacity-50">
                  {isPending ? "Salvando..." : "Adicionar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Setup Pluggy ─── */}
      {/* ─── RELATÓRIOS ─── */}
      {aba === "relatorios" && (
        <BpoRelatorios relatorios={relatorios} />
      )}

      {/* ─── CONTABILIDADE ─── */}
      {aba === "contabilidade" && (
        <div className="space-y-6">
          <p className="text-xs text-gray-400">Dados fiscais e controle de impostos · Grupo Santa Fé</p>

          {/* Nota Fiscal */}
          <div className="bg-white border border-gray-100 p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Dados para Emissão de Nota Fiscal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Regime Tributário</label>
                <select className="w-full border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-[var(--brand-yellow)]">
                  <option>Simples Nacional</option>
                  <option>Lucro Presumido</option>
                  <option>Lucro Real</option>
                  <option>MEI</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CNPJ do Emitente</label>
                <input type="text" placeholder="00.000.000/0001-00" className="w-full border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CNAE Principal</label>
                <input type="text" placeholder="Ex: 6821-8/02 — Corretagem" className="w-full border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Alíquota ISS (%)</label>
                <input type="number" step="0.01" placeholder="2.00" className="w-full border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descrição Padrão do Serviço</label>
                <input type="text" placeholder="Ex: Prestação de serviços de corretagem imobiliária" className="w-full border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-[var(--brand-yellow)]" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
              <div className="flex-1 bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
                💡 Configure sua prefeitura em <strong>Configurações → Empresa</strong> para geração automática de NFS-e via API.
              </div>
            </div>
          </div>

          {/* Controle de Impostos */}
          <div className="bg-white border border-gray-100 p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Controle de Pagamento de Impostos</p>
            <div className="space-y-3">
              {[
                { nome: "DAS — Simples Nacional", vencimento: "20/07/2026", status: "pendente", valor: 0 },
                { nome: "ISS Municipal", vencimento: "10/07/2026", status: "pendente", valor: 0 },
                { nome: "INSS (Pró-Labore)", vencimento: "20/07/2026", status: "pendente", valor: 0 },
                { nome: "IRPJ / CSLL (Trim.)", vencimento: "31/07/2026", status: "pendente", valor: 0 },
              ].map((imposto) => (
                <div key={imposto.nome} className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-[var(--brand-dark)]">{imposto.nome}</p>
                    <p className="text-xs text-gray-400">Venc. {imposto.vencimento}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-[var(--brand-dark)]">{imposto.valor > 0 ? formatCurrency(imposto.valor) : "—"}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-yellow-100 text-yellow-700 uppercase">Pendente</span>
                  </div>
                  <button className="text-xs font-bold border border-gray-200 px-3 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors">
                    Registrar pagamento
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">⚠️ Os valores dos impostos devem ser inseridos manualmente ou importados do contador. Vencimentos são estimativas — verifique com seu contador.</p>
            </div>
          </div>
        </div>
      )}

      {showSetupPluggy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">Configurar Open Finance</h2>
              <button onClick={() => setShowSetupPluggy(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">Para sincronização automática com seu banco, configure a integração via <strong>Pluggy</strong> — plataforma Open Finance homologada pelo Banco Central.</p>
              <div className="bg-gray-50 border border-gray-200 p-4 space-y-3 text-sm">
                <p className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Passo a passo:</p>
                <ol className="space-y-2 text-gray-600 text-xs list-decimal list-inside">
                  <li>Acesse <strong>dashboard.pluggy.ai</strong> e crie sua conta</li>
                  <li>Crie um aplicativo e copie o <code className="bg-gray-100 px-1">Client ID</code> e <code className="bg-gray-100 px-1">Client Secret</code></li>
                  <li>No painel da Vercel, vá em <strong>Settings → Environment Variables</strong></li>
                  <li>Adicione <code className="bg-gray-100 px-1">PLUGGY_CLIENT_ID</code> e <code className="bg-gray-100 px-1">PLUGGY_CLIENT_SECRET</code></li>
                  <li>Faça um novo deploy e volte aqui para sincronizar</li>
                </ol>
              </div>
              <p className="text-xs text-gray-400">Suporta Itaú, Bradesco, Nubank, Caixa, Banco do Brasil, Santander e +200 instituições financeiras brasileiras.</p>
              <button onClick={() => setShowSetupPluggy(false)}
                className="w-full bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2.5 hover:bg-[var(--brand-yellow-dark)] transition-colors">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
