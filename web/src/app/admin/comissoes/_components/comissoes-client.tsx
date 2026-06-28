"use client";

import { useState, useTransition } from "react";
import { DollarSign, TrendingUp, Clock, CheckCircle2, Plus, Pencil, Trash2, Building2, UserCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { COMMISSION_STATUS_CONFIG, CommissionStatus } from "@/lib/types/corretor";
import { excluirComissao, alterarStatusComissao } from "@/lib/actions/comissoes";
import { ComissaoForm } from "./comissao-form";

type Corretor = { id: string; nome: string };
type NegocioItem = { id: string; label: string };

type DbComissao = {
  id: string;
  beneficiario: string;
  tipoNegocio: string;
  corretorId: string | null;
  contratoId: string | null;
  imovel: string;
  valor: number;
  percentual: number;
  status: string;
  vencimento: Date;
  pagamentoEm: Date | null;
  notas: string;
  corretor: Corretor | null;
  contrato: { id: string; numero: string } | null;
};

interface ComissoesClientProps {
  comissoes: DbComissao[];
  corretores: Corretor[];
  negociosPorTipo: Record<string, NegocioItem[]>;
}

const TIPO_NEGOCIO_LABELS: Record<string, string> = {
  venda: "Comissão de Venda",
  aluguel: "Comissão de Aluguel",
  financiamento: "Comissão de Financiamento",
  extra: "Extra",
  // legado
  imovel: "Venda de Imóvel",
  obra: "Obra",
  projeto: "Projeto de Engenharia",
  regularizacao: "Regularização",
  avaliacao: "Avaliação",
  bpo: "BPO Financeiro",
};

function StatusSelectComissao({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const cfg = COMMISSION_STATUS_CONFIG[status as CommissionStatus];
  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => startTransition(async () => { await alterarStatusComissao(id, e.target.value); })}
      className={`text-[10px] font-bold uppercase px-2 py-0.5 border rounded cursor-pointer focus:outline-none ${cfg ? `${cfg.bgColor} ${cfg.color}` : "bg-gray-100 text-gray-500"}`}
    >
      {Object.entries(COMMISSION_STATUS_CONFIG).map(([v, c]) => (
        <option key={v} value={v}>{c.label}</option>
      ))}
    </select>
  );
}

function ExcluirComissaoBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta comissão? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => { await excluirComissao(id); });
  }

  return (
    <button onClick={handleClick} disabled={isPending} title="Excluir comissão"
      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 rounded">
      <Trash2 size={14} />
    </button>
  );
}

export function ComissoesClient({ comissoes, corretores, negociosPorTipo }: ComissoesClientProps) {
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | "todas">("todas");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DbComissao | null>(null);

  const filtered = comissoes
    .filter((cm) => statusFilter === "todas" || cm.status === statusFilter)
    .sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime());

  const totalPago = comissoes.filter((c) => c.status === "paga").reduce((s, c) => s + c.valor, 0);
  const totalPendente = comissoes.filter((c) => c.status === "pendente").reduce((s, c) => s + c.valor, 0);
  const totalAprovado = comissoes.filter((c) => c.status === "aprovada").reduce((s, c) => s + c.valor, 0);
  const totalGeral = comissoes.filter((c) => c.status !== "cancelada").reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Comissões</h1>
          <p className="text-gray-400 text-sm mt-0.5">{comissoes.length} registros no total</p>
        </div>
        <button
          onClick={() => { setEditando(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors mt-6"
        >
          <Plus size={14} />
          Nova Comissão
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Geral", value: formatCurrency(totalGeral), icon: DollarSign, color: "text-[var(--brand-dark)]", bg: "bg-[var(--brand-yellow)]" },
          { label: "Pagas", value: formatCurrency(totalPago), icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
          { label: "Aprovadas", value: formatCurrency(totalAprovado), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "Pendentes", value: formatCurrency(totalPendente), icon: Clock, color: "text-orange-500", bg: "bg-orange-100" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className={`w-8 h-8 ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{value}</p>
            <p className="text-gray-400 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter("todas")}
          className={`px-4 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === "todas" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
          Todas ({comissoes.length})
        </button>
        {(Object.entries(COMMISSION_STATUS_CONFIG) as [CommissionStatus, typeof COMMISSION_STATUS_CONFIG[CommissionStatus]][]).map(([status, cfg]) => {
          const count = comissoes.filter((c) => c.status === status).length;
          return (
            <button key={status} onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === status ? `${cfg.bgColor} ${cfg.color} border border-transparent` : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-dark)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Beneficiário</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Negócio</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Taxa</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Comissão</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Vencimento</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((cm) => (
                <tr key={cm.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {cm.beneficiario === "empresa" ? (
                      <span className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-gray-400" />
                        <span className="font-medium text-[var(--brand-dark)]">Empresa</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <UserCheck size={14} className="text-gray-400" />
                        <span className="font-medium text-[var(--brand-dark)]">{cm.corretor?.nome ?? "—"}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-gray-500 text-xs">{TIPO_NEGOCIO_LABELS[cm.tipoNegocio] ?? cm.tipoNegocio}</p>
                    <p className="text-[var(--brand-dark)] text-sm">{cm.imovel}</p>
                    {cm.contrato && <p className="text-gray-400 text-xs">Contrato {cm.contrato.numero}</p>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs hidden md:table-cell">{cm.percentual}%</td>
                  <td className="px-4 py-3 text-right font-bold text-[var(--brand-dark)]">{formatCurrency(cm.valor)}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusSelectComissao id={cm.id} status={cm.status} />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400 hidden lg:table-cell">
                    {new Date(cm.vencimento).toLocaleDateString("pt-BR")}
                    {cm.pagamentoEm && <span className="block text-green-600">Pago {new Date(cm.pagamentoEm).toLocaleDateString("pt-BR")}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditando(cm); setShowForm(true); }} title="Editar comissão"
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors rounded">
                        <Pencil size={14} />
                      </button>
                      <ExcluirComissaoBtn id={cm.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhuma comissão encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ComissaoForm
          corretores={corretores}
          comissao={editando ?? undefined}
          negociosPorTipo={negociosPorTipo}
          onClose={() => { setShowForm(false); setEditando(null); }}
        />
      )}
    </div>
  );
}
