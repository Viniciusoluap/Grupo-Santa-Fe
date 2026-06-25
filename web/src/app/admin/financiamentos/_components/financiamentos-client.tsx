"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, FileCheck, Pencil, Trash2 } from "lucide-react";
import { STATUS_CONFIG, TIPO_CONFIG, BANCO_CONFIG, FinanciamentoStatus } from "@/lib/types/financiamento";
import { formatCurrency } from "@/lib/utils";
import { excluirFinanciamento } from "@/lib/actions/financiamentos";

interface ChecklistItem {
  id: string;
  concluido: boolean;
}

interface Corretor {
  nome: string;
}

interface Financiamento {
  id: string;
  clienteNome: string;
  clienteTel: string;
  imovel: string;
  tipo: string;
  banco: string;
  valorImovel: number;
  valorFinanciado: number;
  entrada: number;
  taxa: number;
  prazo: number;
  parcela: number | null;
  status: string;
  protocolo: string | null;
  corretor: Corretor | null;
  checklist: ChecklistItem[];
}

interface Props {
  financiamentos: Financiamento[];
}

function ExcluirFinanciamentoBtn({ id, nome }: { id: string; nome: string }) {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    if (!confirm(`Excluir financiamento de "${nome}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => { await excluirFinanciamento(id); });
  }
  return (
    <button onClick={handleClick} disabled={isPending} title="Excluir"
      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 rounded">
      <Trash2 size={14} />
    </button>
  );
}

export function FinanciamentosClient({ financiamentos }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FinanciamentoStatus | "todos">("todos");

  const filtered = financiamentos.filter((f) => {
    const corretorNome = f.corretor?.nome ?? "";
    const matchSearch = !search ||
      f.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      f.imovel.toLowerCase().includes(search.toLowerCase()) ||
      corretorNome.toLowerCase().includes(search.toLowerCase()) ||
      (f.protocolo?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === "todos" || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalFinanciado = financiamentos.reduce((s, f) => s + f.valorFinanciado, 0);
  const ativos = financiamentos.filter((f) => f.status !== "cancelado" && f.status !== "liberado").length;
  const aprovados = financiamentos.filter((f) => f.status === "aprovado" || f.status === "liberado").length;
  const taxaMedia = financiamentos.length > 0
    ? (financiamentos.reduce((s, f) => s + f.taxa, 0) / financiamentos.length).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Financiamentos</h1>
          <p className="text-gray-400 text-sm mt-0.5">{financiamentos.length} processos cadastrados</p>
        </div>
        <Link href="/admin/financiamentos/novo" className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors">
          <Plus size={14} /> Novo Financiamento
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Em andamento", value: ativos, sub: "processos ativos" },
          { label: "Aprovados/Liberados", value: aprovados, sub: "concluídos com êxito" },
          { label: "Volume Total", value: formatCurrency(totalFinanciado), sub: "total financiado" },
          { label: "Taxa média", value: `${taxaMedia}% a.a.`, sub: "taxa de juros" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
            <p className="font-black text-[var(--brand-dark)] text-xl leading-none">{value}</p>
            <p className="text-gray-400 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter("todos")} className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${statusFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
          Todos ({financiamentos.length})
        </button>
        {(Object.entries(STATUS_CONFIG) as [FinanciamentoStatus, typeof STATUS_CONFIG[FinanciamentoStatus]][])
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([status, cfg]) => {
            const count = financiamentos.filter((f) => f.status === status).length;
            if (count === 0) return null;
            return (
              <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${statusFilter === status ? `${cfg.bgColor} ${cfg.color} border border-transparent` : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                {cfg.label} ({count})
              </button>
            );
          })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por cliente, imóvel, corretor ou protocolo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-dark)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Imóvel</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Tipo / Banco</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Checklist</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((f) => {
                const statusKey = f.status as FinanciamentoStatus;
                const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG["pre_analise"];
                const tipoKey = f.tipo as keyof typeof TIPO_CONFIG;
                const bancoKey = f.banco as keyof typeof BANCO_CONFIG;
                const done = f.checklist.filter((c) => c.concluido).length;
                const total = f.checklist.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--brand-dark)]">{f.clienteNome}</p>
                      <p className="text-xs text-gray-400">{f.corretor?.nome ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-gray-700 max-w-[200px] truncate">{f.imovel}</p>
                      {f.protocolo && <p className="text-xs text-gray-400">{f.protocolo}</p>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs font-medium text-[var(--brand-dark)]">{TIPO_CONFIG[tipoKey]?.label ?? f.tipo}</p>
                      <p className="text-xs text-gray-400">{BANCO_CONFIG[bancoKey]?.label ?? f.banco}</p>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <p className="font-bold text-sm">{formatCurrency(f.valorFinanciado)}</p>
                      <p className="text-xs text-gray-400">{f.taxa}% a.a.</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1 text-xs">
                          <FileCheck size={11} className="text-gray-400" />
                          <span className="font-bold">{done}/{total}</span>
                        </div>
                        <div className="w-16 h-1.5 bg-gray-100 overflow-hidden">
                          <div className={`h-full ${pct === 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/admin/financiamentos/${f.id}`} className="p-1.5 text-gray-400 hover:text-[var(--brand-yellow)] hover:bg-yellow-50 transition-colors rounded" title="Ver detalhes">
                          <FileCheck size={14} />
                        </Link>
                        <Link href={`/admin/financiamentos/${f.id}/editar`} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors rounded" title="Editar">
                          <Pencil size={14} />
                        </Link>
                        <ExcluirFinanciamentoBtn id={f.id} nome={f.clienteNome} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
