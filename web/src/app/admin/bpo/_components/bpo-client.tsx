"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Upload,
  RefreshCw,
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { criarCobranca, pagarLancamento } from "@/lib/actions/bpo";

export interface LancamentoComCliente {
  id: string;
  clienteId: string;
  clienteNome: string;
  tipo: string;
  descricao: string;
  valor: number;
  vencimento: string; // ISO string
  pago: boolean;
  pagoEm: string | null;
  competencia: string;
}

interface Props {
  lancamentos: LancamentoComCliente[];
  clientes: { id: string; razaoSocial: string }[];
}

type Aba = "cobracas" | "despesas" | "dre";
type StatusFilter = "todas" | "pendentes" | "pagas" | "vencidas" | "parciais";
type TipoFilter = "todos" | "honorario" | "reembolso" | "outros";

const now = () => new Date();

function isVencido(l: LancamentoComCliente) {
  return !l.pago && new Date(l.vencimento) < now();
}

function isPendente(l: LancamentoComCliente) {
  return !l.pago && new Date(l.vencimento) >= now();
}

export function BpoClient({ lancamentos, clientes }: Props) {
  const [aba, setAba] = useState<Aba>("cobracas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [anoFilter, setAnoFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // KPIs based on cobranças (tipo !== "despesa")
  const cobracasAll = lancamentos.filter((l) => l.tipo !== "despesa");
  const totalEsperado = cobracasAll.reduce((s, l) => s + l.valor, 0);
  const recebido = cobracasAll.filter((l) => l.pago).reduce((s, l) => s + l.valor, 0);
  const pendente = cobracasAll.filter(isPendente).reduce((s, l) => s + l.valor, 0);
  const vencido = cobracasAll.filter(isVencido).reduce((s, l) => s + l.valor, 0);

  // Available months and years from all lancamentos
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

  // Cobranças tab
  const cobracasBase = lancamentos.filter((l) => l.tipo !== "despesa");
  const cobracasFiltered = filterByCommon(cobracasBase).filter((l) => {
    if (statusFilter === "pendentes") return isPendente(l);
    if (statusFilter === "pagas") return l.pago;
    if (statusFilter === "vencidas") return isVencido(l);
    if (statusFilter === "parciais") return false; // no partial logic in model, skip
    return true;
  }).filter((l) => {
    if (tipoFilter === "todos") return true;
    if (tipoFilter === "honorario") return l.tipo === "honorario";
    if (tipoFilter === "reembolso") return l.tipo === "reembolso";
    if (tipoFilter === "outros") return l.tipo !== "honorario" && l.tipo !== "reembolso" && l.tipo !== "despesa";
    return true;
  });

  // Despesas tab
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

  // DRE tab: group by competencia
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

  function handlePagar(id: string) {
    startTransition(async () => {
      await pagarLancamento(id);
    });
  }

  async function handleCriarCobranca(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await criarCobranca(formData);
      setShowModal(false);
      setModalFeedback("Cobrança criada com sucesso!");
      setTimeout(() => setModalFeedback(null), 3000);
    });
  }

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const statusTabClass = (s: StatusFilter) =>
    `px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
      statusFilter === s
        ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]"
        : "text-gray-500 hover:bg-gray-100"
    }`;

  const tipoTabClass = (t: TipoFilter) =>
    `px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
      tipoFilter === t
        ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]"
        : "text-gray-500 hover:bg-gray-100"
    }`;

  const abaClass = (a: Aba) =>
    `px-5 py-2.5 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
      aba === a
        ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
        : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"
    }`;

  function getStatusBadge(l: LancamentoComCliente) {
    if (l.pago) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 uppercase">
          <CheckCircle2 size={10} /> Pago
        </span>
      );
    }
    if (isVencido(l)) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 uppercase">
          <AlertCircle size={10} /> Vencido
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-yellow-100 text-yellow-700 uppercase">
        <Clock size={10} /> Pendente
      </span>
    );
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
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                items.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--brand-dark)] text-xs">{l.clienteNome}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-gray-600 max-w-xs truncate">{l.descricao}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500 hidden sm:table-cell">{l.competencia}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {new Date(l.vencimento).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--brand-dark)] text-xs">
                      {formatCurrency(l.valor)}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(l)}</td>
                    <td className="px-4 py-3 text-center">
                      {!l.pago ? (
                        <button
                          onClick={() => handlePagar(l.id)}
                          disabled={isPending}
                          className="text-xs font-bold text-[var(--brand-dark)] bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] px-3 py-1 transition-colors disabled:opacity-50"
                        >
                          Pagar
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
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
          <p className="text-gray-400 text-sm mt-0.5">Gestão de pagamentos e recebimentos</p>
        </div>
        <Link
          href="/admin/bpo"
          className="text-xs font-bold text-[var(--brand-yellow)] hover:underline mt-1"
        >
          Gerenciar Clientes
        </Link>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          title="Em breve"
          onClick={() => alert("Funcionalidade em breve")}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          <FileText size={13} /> Gerar PDF
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2 transition-colors"
        >
          <Plus size={13} /> Nova Cobrança
        </button>
        <button
          title="Em breve"
          onClick={() => alert("Funcionalidade em breve")}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          <Upload size={13} /> Importar Histórico
        </button>
        <button
          title="Em breve"
          onClick={() => alert("Funcionalidade em breve")}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={13} /> Sincronizar
        </button>
        <button
          title="Em breve"
          onClick={() => alert("Funcionalidade em breve")}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider px-4 py-2 hover:bg-gray-50 transition-colors"
        >
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
      <div className="border-b border-gray-200 flex gap-0">
        <button className={abaClass("cobracas")} onClick={() => setAba("cobracas")}>Cobranças</button>
        <button className={abaClass("despesas")} onClick={() => setAba("despesas")}>Despesas</button>
        <button className={abaClass("dre")} onClick={() => setAba("dre")}>DRE Consolidado</button>
      </div>

      {/* KPI Cards */}
      {aba !== "dre" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {aba === "cobracas" ? (
            <>
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
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* Cobranças tab content */}
      {aba === "cobracas" && (
        <div className="space-y-4">
          {/* Status sub-tabs */}
          <div className="flex flex-wrap gap-1">
            {(["todas", "pendentes", "pagas", "vencidas", "parciais"] as StatusFilter[]).map((s) => (
              <button key={s} className={statusTabClass(s)} onClick={() => setStatusFilter(s)}>
                {s === "todas" ? "Todas" : s === "pendentes" ? "Pendentes" : s === "pagas" ? "Pagas" : s === "vencidas" ? "Vencidas" : "Parciais"}
              </button>
            ))}
          </div>

          {/* Tipo sub-tabs */}
          <div className="flex flex-wrap gap-1">
            {(["todos", "honorario", "reembolso", "outros"] as TipoFilter[]).map((t) => (
              <button key={t} className={tipoTabClass(t)} onClick={() => setTipoFilter(t)}>
                {t === "todos" ? "Todos os tipos" : t === "honorario" ? "Honorários" : t === "reembolso" ? "Reembolsos" : "Outros"}
              </button>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
              />
            </div>
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.razaoSocial}</option>
              ))}
            </select>
            <select
              value={mesFilter}
              onChange={(e) => setMesFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
            >
              <option value="">Todos os meses</option>
              {allMeses.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={anoFilter}
              onChange={(e) => setAnoFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
            >
              <option value="">Todos os anos</option>
              {allAnos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <LancamentoTable items={cobracasFiltered} />
        </div>
      )}

      {/* Despesas tab content */}
      {aba === "despesas" && (
        <div className="space-y-4">
          {/* Status sub-tabs */}
          <div className="flex flex-wrap gap-1">
            {(["todas", "pendentes", "pagas", "vencidas"] as StatusFilter[]).map((s) => (
              <button key={s} className={statusTabClass(s)} onClick={() => setStatusFilter(s)}>
                {s === "todas" ? "Todas" : s === "pendentes" ? "Pendentes" : s === "pagas" ? "Pagas" : "Vencidas"}
              </button>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
              />
            </div>
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.razaoSocial}</option>
              ))}
            </select>
            <select
              value={mesFilter}
              onChange={(e) => setMesFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
            >
              <option value="">Todos os meses</option>
              {allMeses.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={anoFilter}
              onChange={(e) => setAnoFilter(e.target.value)}
              className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
            >
              <option value="">Todos os anos</option>
              {allAnos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <LancamentoTable items={despesasFiltered} />
        </div>
      )}

      {/* DRE tab content */}
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
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                        Nenhum lançamento para consolidar.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {dreRows.map(([comp, vals]) => {
                        const resultado = vals.cobracas - vals.despesas;
                        return (
                          <tr key={comp} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-[var(--brand-dark)]">{comp}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-bold">{formatCurrency(vals.cobracas)}</td>
                            <td className="px-4 py-3 text-right text-red-500 font-bold">{formatCurrency(vals.despesas)}</td>
                            <td className={`px-4 py-3 text-right font-black ${resultado >= 0 ? "text-green-700" : "text-red-700"}`}>
                              {formatCurrency(resultado)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-[var(--brand-dark)]">
                        <td className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total</td>
                        <td className="px-4 py-3 text-right font-black text-green-400">{formatCurrency(dreTotalCobracas)}</td>
                        <td className="px-4 py-3 text-right font-black text-red-400">{formatCurrency(dreTotalDespesas)}</td>
                        <td className={`px-4 py-3 text-right font-black ${dreTotalCobracas - dreTotalDespesas >= 0 ? "text-green-300" : "text-red-300"}`}>
                          {formatCurrency(dreTotalCobracas - dreTotalDespesas)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Nova Cobrança Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">Nova Cobrança</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCriarCobranca} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Cliente *
                </label>
                <select
                  name="clienteId"
                  required
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                >
                  <option value="">Selecionar cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Tipo *
                </label>
                <select
                  name="tipo"
                  required
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                >
                  <option value="honorario">Honorário</option>
                  <option value="despesa">Despesa</option>
                  <option value="reembolso">Reembolso</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Descrição *
                </label>
                <input
                  name="descricao"
                  type="text"
                  required
                  placeholder="Ex: Honorários BPO — junho/2026"
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    name="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Competência *
                  </label>
                  <input
                    name="competencia"
                    type="month"
                    required
                    defaultValue={currentMonth}
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Vencimento *
                </label>
                <input
                  name="vencimento"
                  type="date"
                  required
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider py-2.5 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2.5 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Criar Cobrança"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
