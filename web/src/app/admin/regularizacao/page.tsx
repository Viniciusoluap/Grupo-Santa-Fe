"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, FileCheck } from "lucide-react";
import { regularizacoes } from "@/lib/data/regularizacoes";
import { REG_STATUS_CONFIG, REG_TIPO_CONFIG, RegStatus } from "@/lib/types/regularizacao";
import { formatCurrency } from "@/lib/utils";

export default function RegularizacaoPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RegStatus | "todos">("todos");

  const filtered = regularizacoes.filter((r) => {
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.address.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const ativos = regularizacoes.filter((r) => r.status !== "concluido" && r.status !== "cancelado").length;
  const totalValue = regularizacoes.reduce((s, r) => s + r.serviceValue, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Regularização Imobiliária</h1>
          <p className="text-gray-400 text-sm mt-0.5">{regularizacoes.length} processos cadastrados</p>
        </div>
        <Link href="/admin/regularizacao/novo" className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors">
          <Plus size={14} /> Novo Processo
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Em Andamento", value: ativos },
          { label: "Concluídos", value: regularizacoes.filter((r) => r.status === "concluido").length },
          { label: "Faturamento", value: formatCurrency(totalValue) },
          { label: "A Receber", value: formatCurrency(regularizacoes.reduce((s, r) => s + (r.serviceValue - r.paidValue), 0)) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
              <FileCheck size={15} className="text-[var(--brand-yellow)]" />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, cliente ou endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setStatusFilter("todos")} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
            Todos
          </button>
          {(Object.entries(REG_STATUS_CONFIG) as [RegStatus, typeof REG_STATUS_CONFIG[RegStatus]][])
            .sort(([, a], [, b]) => a.order - b.order)
            .map(([status, cfg]) => {
              const count = regularizacoes.filter((r) => r.status === status).length;
              if (count === 0) return null;
              return (
                <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === status ? `${cfg.bgColor} ${cfg.color} border border-transparent` : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                  {cfg.label} ({count})
                </button>
              );
            })}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((r) => {
          const cfg = REG_STATUS_CONFIG[r.status];
          const tipo = REG_TIPO_CONFIG[r.tipo];
          const docsOk = r.documents.filter((d) => d.status === "aprovado" || d.status === "obtido").length;
          return (
            <div key={r.id} className="bg-white border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl shrink-0 mt-0.5">{tipo.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-[var(--brand-dark)]">{r.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-gray-500 text-sm">{r.clientName}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{r.address}</p>
                    {r.matricula && <p className="text-gray-400 text-xs">{r.matricula}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[var(--brand-dark)]">{formatCurrency(r.serviceValue)}</p>
                  {r.paidValue < r.serviceValue && <p className="text-xs text-orange-400">A receber: {formatCurrency(r.serviceValue - r.paidValue)}</p>}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Resp.: {r.responsible}</span>
                  <span>Docs: {docsOk}/{r.documents.length} em ordem</span>
                  {r.estimatedEnd && <span>Previsão: {new Date(r.estimatedEnd).toLocaleDateString("pt-BR")}</span>}
                </div>
                <Link href={`/admin/regularizacao/${r.id}`} className="text-xs bg-[var(--brand-dark)] hover:bg-[var(--brand-dark-secondary)] text-[var(--brand-yellow)] font-bold uppercase tracking-wider px-4 py-1.5 transition-colors">
                  Ver Processo
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
