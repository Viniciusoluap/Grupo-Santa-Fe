"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Ruler, Pencil, Trash2 } from "lucide-react";
import { PROJETO_STATUS_CONFIG, PROJETO_TIPO_CONFIG, ProjetoStatus } from "@/lib/types/projeto";
import { formatCurrency } from "@/lib/utils";
import { excluirProjeto, alterarStatusProjeto } from "@/lib/actions/projetos";

interface Projeto {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  clienteNome: string;
  clienteTel: string;
  engenheiro: string;
  valorProjeto: number;
  valorPago: number;
  prazoEntrega: Date | null;
}

interface Props {
  projetos: Projeto[];
}

function parseTipos(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return [raw]; }
}

function TiposResumo({ raw }: { raw: string }) {
  const tipos = parseTipos(raw);
  if (tipos.length === 0) return <span className="text-gray-400 text-xs">—</span>;
  const first = PROJETO_TIPO_CONFIG[tipos[0] as keyof typeof PROJETO_TIPO_CONFIG];
  const label = first ? `${first.icon} ${first.label}` : tipos[0];
  return (
    <span className="text-xs text-gray-500">
      {label}{tipos.length > 1 && <span className="text-gray-400 ml-1">+{tipos.length - 1}</span>}
    </span>
  );
}

function StatusSelectProjeto({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => startTransition(async () => { await alterarStatusProjeto(id, e.target.value); })}
      className="text-[10px] font-bold uppercase px-2 py-0.5 border-0 bg-transparent cursor-pointer focus:outline-none"
      style={{ color: PROJETO_STATUS_CONFIG[status as ProjetoStatus]?.color?.replace("text-", "") ?? "inherit" }}
    >
      {Object.entries(PROJETO_STATUS_CONFIG).map(([v, cfg]) => (
        <option key={v} value={v}>{cfg.label}</option>
      ))}
    </select>
  );
}

function ExcluirProjetoBtn({ id, nome }: { id: string; nome: string }) {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    if (!confirm(`Excluir projeto "${nome}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => { await excluirProjeto(id); });
  }
  return (
    <button onClick={handleClick} disabled={isPending} title="Excluir"
      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 rounded">
      <Trash2 size={14} />
    </button>
  );
}

export function ProjetosClient({ projetos }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjetoStatus | "todos">("todos");

  const filtered = projetos.filter((p) => {
    const matchSearch = !search ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      p.engenheiro.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalValue = projetos.reduce((s, p) => s + p.valorProjeto, 0);
  const emAndamento = projetos.filter((p) => p.status === "em_elaboracao" || p.status === "revisao").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Projetos e Orçamentos</h1>
          <p className="text-gray-400 text-sm mt-0.5">{projetos.length} projetos cadastrados</p>
        </div>
        <Link href="/admin/projetos/novo" className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors">
          <Plus size={14} /> Novo Projeto
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Em Andamento", value: emAndamento },
          { label: "Entregues", value: projetos.filter((p) => p.status === "entregue").length },
          { label: "Faturamento Total", value: formatCurrency(totalValue) },
          { label: "A Receber", value: formatCurrency(projetos.reduce((s, p) => s + (p.valorProjeto - p.valorPago), 0)) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
              <Ruler size={15} className="text-[var(--brand-yellow)]" />
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
            placeholder="Buscar por nome, cliente ou engenheiro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setStatusFilter("todos")} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
            Todos
          </button>
          {(Object.entries(PROJETO_STATUS_CONFIG) as [ProjetoStatus, typeof PROJETO_STATUS_CONFIG[ProjetoStatus]][])
            .sort(([, a], [, b]) => a.order - b.order)
            .map(([status, cfg]) => {
              const count = projetos.filter((p) => p.status === status).length;
              if (count === 0) return null;
              return (
                <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === status ? `${cfg.bgColor} ${cfg.color} border border-transparent` : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                  {cfg.label} ({count})
                </button>
              );
            })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-dark)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Projeto</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Engenheiro</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Entrega</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => {
                const statusKey = p.status as ProjetoStatus;
                const cfg = PROJETO_STATUS_CONFIG[statusKey] ?? PROJETO_STATUS_CONFIG["solicitado"];
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--brand-dark)] leading-tight">{p.nome}</p>
                      <TiposResumo raw={p.tipo} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-gray-700">{p.clienteNome}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-500">{p.engenheiro}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-right">
                      <p className="font-bold text-sm">{formatCurrency(p.valorProjeto)}</p>
                      {p.valorPago < p.valorProjeto && (
                        <p className="text-xs text-orange-400">A receber: {formatCurrency(p.valorProjeto - p.valorPago)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400 hidden md:table-cell">
                      {p.prazoEntrega ? new Date(p.prazoEntrega).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusSelectProjeto id={p.id} status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/admin/projetos/${p.id}`} className="p-1.5 text-gray-400 hover:text-[var(--brand-yellow)] hover:bg-yellow-50 transition-colors rounded" title="Ver detalhes">
                          <Ruler size={14} />
                        </Link>
                        <Link href={`/admin/projetos/${p.id}/editar`} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors rounded" title="Editar">
                          <Pencil size={14} />
                        </Link>
                        <ExcluirProjetoBtn id={p.id} nome={p.nome} />
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
