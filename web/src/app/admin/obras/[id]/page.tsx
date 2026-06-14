import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { getObraById } from "@/lib/data/obras";
import { OBRA_STATUS_CONFIG, OBRA_TIPO_CONFIG, WEATHER_CONFIG } from "@/lib/types/obra";
import { formatCurrency } from "@/lib/utils";

interface PageProps { params: Promise<{ id: string }> }

export default async function ObraDetailPage({ params }: PageProps) {
  const { id } = await params;
  const o = getObraById(id);
  if (!o) notFound();

  const cfg = OBRA_STATUS_CONFIG[o.status];
  const tipo = OBRA_TIPO_CONFIG[o.tipo];
  const totalBudgetPlanned = o.orcamento.reduce((s, r) => s + r.planned, 0);
  const totalBudgetExecuted = o.orcamento.reduce((s, r) => s + r.executed, 0);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase">{o.name}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Etapas */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Etapas da Obra ({o.etapas.filter((e) => e.status === "concluida").length}/{o.etapas.length})
            </h2>
            <div className="space-y-3">
              {o.etapas.map((e) => {
                const statusColor = e.status === "concluida" ? "bg-green-500" : e.status === "em_andamento" ? "bg-[var(--brand-yellow)]" : "bg-gray-200";
                const labelColor = e.status === "concluida" ? "text-green-600" : e.status === "em_andamento" ? "text-[var(--brand-dark)]" : "text-gray-400";
                return (
                  <div key={e.id} className={`p-3 border ${e.status === "em_andamento" ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5" : "border-gray-100"}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 flex items-center justify-center text-xs font-black rounded-full text-white ${e.status === "concluida" ? "bg-green-500" : e.status === "em_andamento" ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-gray-200 text-gray-400"}`}>
                          {e.status === "concluida" ? "✓" : e.order}
                        </span>
                        <span className={`text-sm font-bold ${labelColor}`}>{e.name}</span>
                        {e.status === "em_andamento" && (
                          <span className="text-[9px] font-bold bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-2 py-0.5 uppercase">Em andamento</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[var(--brand-dark)]">{e.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 overflow-hidden">
                      <div className={`h-full ${statusColor}`} style={{ width: `${e.progress}%` }} />
                    </div>
                    {e.responsible && <p className="text-xs text-gray-400 mt-1">Responsável: {e.responsible}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Orçamento */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Orçamento vs Executado
            </h2>
            <div className="space-y-3">
              {o.orcamento.map((r) => {
                const pct = r.planned > 0 ? Math.round((r.executed / r.planned) * 100) : 0;
                return (
                  <div key={r.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{r.category}</span>
                      <span className="text-xs text-gray-400">
                        {formatCurrency(r.executed)} / {formatCurrency(r.planned)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full ${pct > 100 ? "bg-red-400" : pct >= 80 ? "bg-[var(--brand-yellow)]" : "bg-green-400"}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">Total</span>
              <span className="text-sm font-bold text-[var(--brand-dark)]">
                {formatCurrency(totalBudgetExecuted)} / {formatCurrency(totalBudgetPlanned)}
              </span>
            </div>
          </div>

          {/* Diário de obra */}
          <div className="bg-white border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
                Diário de Obra ({o.diario.length} registros)
              </h2>
              <button className="flex items-center gap-1 text-xs bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold uppercase tracking-wide px-3 py-1.5 transition-colors">
                <Plus size={11} /> Novo Registro
              </button>
            </div>

            {o.diario.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Nenhum registro no diário ainda.</p>
            ) : (
              <div className="space-y-4">
                {o.diario.map((entry) => {
                  const weather = WEATHER_CONFIG[entry.weather];
                  return (
                    <div key={entry.id} className="border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--brand-dark)] text-sm">
                              {new Date(entry.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">por {entry.author}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-center">
                            <span className="text-xl">{weather.icon}</span>
                            <p className="text-[9px] text-gray-400">{weather.label}</p>
                          </div>
                          <div className="text-center bg-gray-50 px-3 py-1">
                            <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{entry.workers}</p>
                            <p className="text-[9px] text-gray-400">trabalhadores</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">Atividades</p>
                          <p className="text-sm text-gray-700">{entry.activities}</p>
                        </div>
                        {entry.materials && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">Materiais utilizados</p>
                            <p className="text-sm text-gray-700">{entry.materials}</p>
                          </div>
                        )}
                        {entry.observations && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">Observações</p>
                            <p className="text-sm text-gray-600 italic">{entry.observations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Cliente</p>
            <p className="text-white font-bold">{o.clientName}</p>
            <p className="text-gray-400 text-xs mt-1">{o.address}</p>
            <a href={`tel:${o.clientPhone}`} className="mt-3 flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
              <Phone size={14} /> {o.clientPhone}
            </a>
          </div>

          {/* Progress */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resumo</p>
            {[
              { label: "Tipo", value: `${tipo.icon} ${tipo.label}` },
              { label: "Engenheiro", value: o.responsibleEngineer },
              { label: "Área", value: `${o.area} m²` },
              { label: "Início", value: new Date(o.startDate).toLocaleDateString("pt-BR") },
              { label: "Previsão", value: new Date(o.expectedEnd).toLocaleDateString("pt-BR") },
              o.actualEnd ? { label: "Concluída em", value: new Date(o.actualEnd).toLocaleDateString("pt-BR") } : null,
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-medium text-[var(--brand-dark)]">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Financial */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Financeiro</p>
            {[
              { label: "Valor total", value: formatCurrency(o.totalValue), color: "text-[var(--brand-dark)]" },
              { label: "Recebido", value: formatCurrency(o.paidValue), color: "text-green-600" },
              { label: "A receber", value: formatCurrency(o.totalValue - o.paidValue), color: "text-orange-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className={`text-xs font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {o.notes && (
            <div className="bg-yellow-50 border border-yellow-100 p-4">
              <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1">Observações</p>
              <p className="text-xs text-yellow-800">{o.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
