import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, TrendingUp, Award, Calendar } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { getCorretorById, getTotalCommissions, getPendingCommissions } from "@/lib/data/corretores";
import { COMMISSION_STATUS_CONFIG, COMMISSION_TYPE_CONFIG } from "@/lib/types/corretor";
import { formatCurrency } from "@/lib/utils";

interface PageProps { params: Promise<{ id: string }> }

export default async function CorretorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const c = getCorretorById(id);
  if (!c) notFound();

  const totalComissao = getTotalCommissions(id);
  const pendente = getPendingCommissions(id);
  const pago = c.commissions.filter((cm) => cm.status === "paga").reduce((s, cm) => s + cm.amount, 0);
  const recentMonths = c.monthlyTargets.slice(-3);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">{c.name}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {c.active ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Performance */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Leads", value: c.leadsCount, color: "text-blue-500" },
                { label: "Vendas", value: c.closedDeals, color: "text-green-500" },
                { label: "Conversão", value: `${c.conversionRate.toFixed(1)}%`, color: "text-[var(--brand-yellow)]" },
                { label: "Total Comissão", value: formatCurrency(totalComissao), color: "text-[var(--brand-dark)]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 p-3 text-center">
                  <p className={`font-black text-xl ${color}`}>{value}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly targets */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Meta Mensal (últimos {recentMonths.length} meses)
            </h2>
            <div className="space-y-3">
              {recentMonths.map((m) => {
                const pct = Math.min(100, Math.round((m.achieved / m.target) * 100));
                const [year, month] = m.month.split("-");
                const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });
                return (
                  <div key={m.month}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 capitalize">{label}</span>
                      <span className="text-xs font-bold text-[var(--brand-dark)]">
                        {formatCurrency(m.achieved)} / {formatCurrency(m.target)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-[var(--brand-yellow)]" : "bg-orange-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commissions table */}
          <div className="bg-white border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Comissões ({c.commissions.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Negócio</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Valor Venda</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Comissão</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {c.commissions.map((cm) => {
                    const cfg = COMMISSION_STATUS_CONFIG[cm.status];
                    const tcfg = COMMISSION_TYPE_CONFIG[cm.type];
                    return (
                      <tr key={cm.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{tcfg.icon}</span>
                            <div>
                              <p className="font-medium text-[var(--brand-dark)]">{cm.property}</p>
                              <p className="text-xs text-gray-400">{cm.client} · {tcfg.label} · {cm.rate}%</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{formatCurrency(cm.saleValue)}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(cm.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Profile */}
          <div className="bg-[var(--brand-dark)] p-5">
            <div className="w-16 h-16 bg-[var(--brand-yellow)] flex items-center justify-center mb-4">
              <span className="text-[var(--brand-dark)] font-black text-2xl">{c.name[0]}</span>
            </div>
            <p className="text-white font-bold">{c.name}</p>
            <p className="text-gray-400 text-xs mt-0.5">{c.creci}</p>
            <div className="mt-4 flex flex-wrap gap-1">
              {c.specialties.map((s) => (
                <span key={s} className="text-[9px] font-bold bg-white/10 text-gray-300 px-2 py-0.5 uppercase">{s}</span>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <a href={`tel:${c.phone}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors">
                <Phone size={14} /> {c.phone}
              </a>
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors">
                <Mail size={14} /> E-mail
              </a>
            </div>
          </div>

          {/* Financial summary */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Financeiro</p>
            {[
              { label: "Total comissões", value: formatCurrency(totalComissao), color: "text-[var(--brand-dark)]" },
              { label: "Já pago", value: formatCurrency(pago), color: "text-green-600" },
              { label: "A receber", value: formatCurrency(pendente), color: "text-orange-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`font-bold text-sm ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Informações</p>
            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Data de admissão</p>
                <p className="text-sm font-medium">{new Date(c.hireDate).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
