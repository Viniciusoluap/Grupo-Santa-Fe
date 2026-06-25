"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, LayoutGrid, List, Search } from "lucide-react";
import { LEAD_STATUS_CONFIG, LeadStatus } from "@/lib/types/crm";
import { LeadKanban } from "@/components/crm/lead-kanban";
import { formatCurrency, formatTelefone } from "@/lib/utils";

type DbLead = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  servico: string;
  status: string;
  origem: string;
  corretorId: string | null;
  orcamento: number | null;
  notas: string;
  criadoEm: Date;
  atualizadoEm: Date;
  corretor: { id: string; nome: string; email: string; telefone: string } | null;
  imovelInteresse: { id: string; titulo: string } | null;
  visitas: { id: string; status: string; agendadaPara: Date }[];
};

interface LeadsClientProps {
  leads: DbLead[];
}

export function LeadsClient({ leads }: LeadsClientProps) {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");

  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function parseServicos(servico: string): string[] {
    try { return JSON.parse(servico); } catch { return [servico]; }
  }

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const servicos = parseServicos(l.servico).join(" ").toLowerCase();
    return (
      l.nome.toLowerCase().includes(q) ||
      servicos.includes(q) ||
      (l.corretor?.nome ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">CRM — Leads</h1>
          <p className="text-gray-400 text-sm mt-0.5">{leads.length} leads no total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${view === "kanban" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-400 hover:bg-gray-50"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${view === "list" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-400 hover:bg-gray-50"}`}
            >
              <List size={14} />
            </button>
          </div>
          <Link
            href="/admin/leads/novo"
            className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
          >
            <Plus size={14} /> Novo Lead
          </Link>
        </div>
      </div>

      {/* Funil summary */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {(Object.entries(LEAD_STATUS_CONFIG) as [LeadStatus, (typeof LEAD_STATUS_CONFIG)[LeadStatus]][])
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([status, cfg]) => (
            <div
              key={status}
              className="bg-white border border-gray-100 p-3 text-center hover:border-[var(--brand-yellow)] transition-colors cursor-pointer"
            >
              <p className="font-black text-[var(--brand-dark)] text-2xl">{statusCounts[status] ?? 0}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 uppercase inline-block mt-1 ${cfg.bgColor} ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
          ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar lead por nome, serviço ou corretor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
        />
      </div>

      {/* View */}
      {view === "kanban" ? (
        <LeadKanban leads={filtered} />
      ) : (
        <div className="bg-white border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-dark)] text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide">Nome</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">Serviço</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Corretor</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Budget</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-400 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((lead) => {
                  const cfg = LEAD_STATUS_CONFIG[lead.status as LeadStatus] ?? {
                    bgColor: "bg-gray-100",
                    color: "text-gray-600",
                    label: lead.status,
                  };
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--brand-dark)]">{lead.nome}</p>
                        <p className="text-xs text-gray-400">{formatTelefone(lead.telefone)}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {parseServicos(lead.servico).map((s) => (
                            <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 font-medium">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-500">{lead.corretor?.nome ?? "—"}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-right font-bold text-sm">
                        {lead.orcamento ? formatCurrency(lead.orcamento) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/admin/leads/${lead.id}`} className="text-xs font-bold text-[var(--brand-yellow)] hover:underline">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
