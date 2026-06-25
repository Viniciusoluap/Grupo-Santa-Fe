"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, HardHat, Pencil, Trash2 } from "lucide-react";
import { OBRA_STATUS_CONFIG, OBRA_TIPO_CONFIG, ObraStatus } from "@/lib/types/obra";
import { formatCurrency } from "@/lib/utils";
import { excluirObra } from "@/lib/actions/obras";

interface ObraEtapa {
  id: string;
  status: string;
}

interface Obra {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  clienteNome: string;
  clienteTel: string;
  endereco: string;
  area: number;
  valorTotal: number;
  valorPago: number;
  progresso: number;
  engenheiroResp: string;
  dataInicio: Date | null;
  dataPrevisaoFim: Date | null;
  dataConclusao: Date | null;
  etapas: ObraEtapa[];
}

interface Props {
  obras: Obra[];
}

function ExcluirObraBtn({ id, nome }: { id: string; nome: string }) {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    if (!confirm(`Excluir obra "${nome}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => { await excluirObra(id); });
  }
  return (
    <button onClick={handleClick} disabled={isPending} title="Excluir"
      className="text-xs border border-red-200 hover:bg-red-50 text-red-400 hover:text-red-600 font-bold px-3 py-2 transition-colors disabled:opacity-40 flex items-center gap-1">
      <Trash2 size={12} /> Excluir
    </button>
  );
}

export function ObrasClient({ obras }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ObraStatus | "todas">("todas");

  const filtered = obras.filter((o) => {
    const matchSearch = !search ||
      o.nome.toLowerCase().includes(search.toLowerCase()) ||
      o.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      o.endereco.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todas" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const emAndamento = obras.filter((o) => o.status === "em_andamento").length;
  const totalValue = obras.reduce((s, o) => s + o.valorTotal, 0);
  const totalPaid = obras.reduce((s, o) => s + o.valorPago, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Obras e Reformas</h1>
          <p className="text-gray-400 text-sm mt-0.5">{obras.length} projetos cadastrados</p>
        </div>
        <Link href="/admin/obras/novo" className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors">
          <Plus size={14} /> Nova Obra
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Em Andamento", value: emAndamento, sub: "obras ativas" },
          { label: "Concluídas", value: obras.filter((o) => o.status === "concluida").length, sub: "no histórico" },
          { label: "Volume Total", value: formatCurrency(totalValue), sub: "contratos" },
          { label: "Recebido", value: formatCurrency(totalPaid), sub: "pagamentos" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
              <HardHat size={15} className="text-[var(--brand-yellow)]" />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl leading-none">{value}</p>
            <p className="text-gray-400 text-xs mt-1">{sub}</p>
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
          <button onClick={() => setStatusFilter("todas")} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === "todas" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
            Todas
          </button>
          {(Object.entries(OBRA_STATUS_CONFIG) as [ObraStatus, typeof OBRA_STATUS_CONFIG[ObraStatus]][])
            .sort(([, a], [, b]) => a.order - b.order)
            .map(([status, cfg]) => {
              const count = obras.filter((o) => o.status === status).length;
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
        {filtered.map((o) => {
          const statusKey = o.status as ObraStatus;
          const cfg = OBRA_STATUS_CONFIG[statusKey] ?? OBRA_STATUS_CONFIG["orcamento"];
          const tipoKey = o.tipo as keyof typeof OBRA_TIPO_CONFIG;
          const tipo = OBRA_TIPO_CONFIG[tipoKey] ?? { icon: "🏗️", label: o.tipo };
          const etapasFeitas = o.etapas.filter((e) => e.status === "concluida").length;
          const saldo = o.valorTotal - o.valorPago;
          return (
            <div key={o.id} className="bg-white border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg">{tipo.icon}</span>
                    <h3 className="font-bold text-[var(--brand-dark)]">{o.nome}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <p className="text-gray-400 text-sm">{o.clienteNome} · {o.endereco}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Resp.: {o.engenheiroResp} · {o.area} m²</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-[var(--brand-dark)] text-lg">{formatCurrency(o.valorTotal)}</p>
                  {saldo > 0 && <p className="text-xs text-orange-500">A receber: {formatCurrency(saldo)}</p>}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Progresso geral</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 overflow-hidden">
                      <div className={`h-full ${o.progresso === 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`} style={{ width: `${o.progresso}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[var(--brand-dark)]">{o.progresso}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Etapas</p>
                  <p className="text-sm font-bold text-[var(--brand-dark)]">{etapasFeitas}/{o.etapas.length} concluídas</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Diário</p>
                  <p className="text-sm font-bold text-[var(--brand-dark)]">—</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <Link href={`/admin/obras/${o.id}`} className="text-xs bg-[var(--brand-dark)] hover:bg-[var(--brand-dark-secondary)] text-[var(--brand-yellow)] font-bold uppercase tracking-wider px-4 py-2 transition-colors">
                  Abrir Obra
                </Link>
                <Link href={`/admin/obras/${o.id}/editar`} className="text-xs border border-gray-200 hover:border-blue-300 hover:text-blue-500 text-gray-500 font-bold px-3 py-2 transition-colors flex items-center gap-1">
                  <Pencil size={12} /> Editar
                </Link>
                <ExcluirObraBtn id={o.id} nome={o.nome} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
