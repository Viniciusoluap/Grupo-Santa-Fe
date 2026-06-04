"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { corretores } from "@/lib/data/corretores";
import { formatCurrency } from "@/lib/utils";
import { COMMISSION_STATUS_CONFIG, COMMISSION_TYPE_CONFIG, CommissionStatus } from "@/lib/types/corretor";
import Link from "next/link";

const allCommissions = corretores.flatMap((c) =>
  c.commissions.map((cm) => ({ ...cm, corretorName: c.name, corretorId: c.id }))
);

export default function ComissoesPage() {
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | "todas">("todas");

  const filtered = allCommissions
    .filter((cm) => statusFilter === "todas" || cm.status === statusFilter)
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const totalPago = allCommissions.filter((c) => c.status === "paga").reduce((s, c) => s + c.amount, 0);
  const totalPendente = allCommissions.filter((c) => c.status === "pendente").reduce((s, c) => s + c.amount, 0);
  const totalAprovado = allCommissions.filter((c) => c.status === "aprovada").reduce((s, c) => s + c.amount, 0);
  const totalGeral = allCommissions.filter((c) => c.status !== "cancelada").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Comissões</h1>
        <p className="text-gray-400 text-sm mt-0.5">{allCommissions.length} registros no total</p>
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
        <button
          onClick={() => setStatusFilter("todas")}
          className={`px-4 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === "todas" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}
        >
          Todas ({allCommissions.length})
        </button>
        {(Object.entries(COMMISSION_STATUS_CONFIG) as [CommissionStatus, typeof COMMISSION_STATUS_CONFIG[CommissionStatus]][]).map(([status, cfg]) => {
          const count = allCommissions.filter((c) => c.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === status ? `${cfg.bgColor} ${cfg.color} border border-transparent` : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}
            >
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
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Corretor</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Negócio</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Valor Venda</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Taxa</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Comissão</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Vencimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((cm) => {
                const cfg = COMMISSION_STATUS_CONFIG[cm.status];
                const tcfg = COMMISSION_TYPE_CONFIG[cm.type];
                return (
                  <tr key={cm.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/corretores/${cm.corretorId}`} className="font-medium text-[var(--brand-dark)] hover:text-[var(--brand-yellow)] transition-colors">
                        {cm.corretorName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-[var(--brand-dark)] text-sm">{cm.property}</p>
                      <p className="text-gray-400 text-xs">{cm.client}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span>{tcfg.icon}</span> {tcfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-sm hidden lg:table-cell">{formatCurrency(cm.saleValue)}</td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs hidden md:table-cell">{cm.rate}%</td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--brand-dark)]">{formatCurrency(cm.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400 hidden lg:table-cell">
                      {new Date(cm.dueDate).toLocaleDateString("pt-BR")}
                      {cm.paidAt && <span className="block text-green-600">Pago {new Date(cm.paidAt).toLocaleDateString("pt-BR")}</span>}
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
