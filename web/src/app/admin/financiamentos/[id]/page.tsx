import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, Mail, CheckCircle2, Clock, AlertCircle, XCircle, Upload } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { getFinanciamentoById, getChecklistProgress } from "@/lib/data/financiamentos";
import { STATUS_CONFIG, TIPO_CONFIG, BANCO_CONFIG, CHECKLIST_CATEGORIES, FinanciamentoStatus } from "@/lib/types/financiamento";
import { formatCurrency } from "@/lib/utils";

interface PageProps { params: Promise<{ id: string }> }

const stageOrder: FinanciamentoStatus[] = ["pre_analise", "documentacao", "analise_banco", "aprovado", "contrato", "registro", "liberado"];

export default async function FinanciamentoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const f = getFinanciamentoById(id);
  if (!f) notFound();

  const cfg = STATUS_CONFIG[f.status];
  const progress = getChecklistProgress(f);
  const currentOrder = STATUS_CONFIG[f.status].order;

  const docStatusIcon = {
    aprovado: <CheckCircle2 size={14} className="text-green-600" />,
    enviado: <Clock size={14} className="text-blue-500" />,
    pendente: <AlertCircle size={14} className="text-orange-400" />,
    rejeitado: <XCircle size={14} className="text-red-500" />,
  };

  const categorized = (Object.entries(CHECKLIST_CATEGORIES) as [keyof typeof CHECKLIST_CATEGORIES, string][]).map(([cat, label]) => ({
    cat,
    label,
    items: f.checklist.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase">{f.clientName}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Pipeline */}
      <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {stageOrder.map((stage, i, arr) => {
            const sc = STATUS_CONFIG[stage];
            const isActive = stage === f.status;
            const isPast = sc.order < currentOrder && f.status !== "cancelado";
            return (
              <div key={stage} className="flex items-center">
                <div className={`flex flex-col items-center px-2 py-1 ${isActive ? "opacity-100" : "opacity-50"}`}>
                  <div className={`w-3 h-3 rounded-full border-2 ${isActive ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]" : isPast ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"}`} />
                  <span className={`text-[10px] font-bold mt-1 uppercase text-center ${isActive ? "text-[var(--brand-dark)]" : "text-gray-400"}`}>{sc.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`h-0.5 w-6 ${isPast || isActive ? "bg-[var(--brand-yellow)]" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: checklist */}
        <div className="lg:col-span-2 space-y-5">
          {/* Checklist progress */}
          <div className="bg-white border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Checklist Documental</h2>
              <span className="text-xs font-bold text-gray-500">{progress.done}/{progress.total} aprovados</span>
            </div>
            <div className="h-2 bg-gray-100 mb-5 overflow-hidden">
              <div className={`h-full transition-all ${progress.pct === 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`} style={{ width: `${progress.pct}%` }} />
            </div>

            {categorized.map(({ cat, label, items }) => (
              <div key={cat} className="mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
                <div className="space-y-2">
                  {items.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {docStatusIcon[doc.status]}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-[var(--brand-dark)] truncate">{doc.name}</p>
                            {doc.required && <span className="text-[9px] font-bold bg-red-50 text-red-500 px-1 shrink-0">Obrig.</span>}
                          </div>
                          {doc.uploadedAt && <p className="text-xs text-gray-400">Enviado em {new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}</p>}
                          {doc.notes && <p className="text-xs text-red-500">{doc.notes}</p>}
                        </div>
                      </div>
                      {(doc.status === "pendente" || doc.status === "rejeitado") && (
                        <button className="flex items-center gap-1 shrink-0 text-[10px] bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold uppercase px-2 py-1 transition-colors">
                          <Upload size={10} /> Upload
                        </button>
                      )}
                      {doc.status === "enviado" && (
                        <button className="shrink-0 text-[10px] bg-green-100 hover:bg-green-200 text-green-700 font-bold uppercase px-2 py-1 transition-colors">
                          Aprovar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Cliente</p>
            <p className="text-white font-bold">{f.clientName}</p>
            <p className="text-gray-400 text-sm mt-0.5">{f.property}</p>
            <div className="mt-4 space-y-2">
              <a href={`tel:${f.clientPhone}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
                <Phone size={14} /> {f.clientPhone}
              </a>
              <a href={`mailto:${f.clientEmail}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
                <Mail size={14} /> E-mail
              </a>
            </div>
          </div>

          {/* Financial summary */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resumo Financeiro</p>
            {[
              { label: "Valor do imóvel", value: formatCurrency(f.propertyValue) },
              { label: "Valor financiado", value: formatCurrency(f.financingValue) },
              { label: "Entrada", value: formatCurrency(f.entry) },
              f.fgts > 0 ? { label: "FGTS", value: formatCurrency(f.fgts) } : null,
              { label: "Parcela", value: formatCurrency(f.installment) },
              { label: "Prazo", value: `${f.term} meses` },
              { label: "Taxa", value: `${f.rate}% a.a.` },
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="font-bold text-xs text-[var(--brand-dark)]">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Process info */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Processo</p>
            {[
              { label: "Tipo", value: TIPO_CONFIG[f.tipo].label },
              { label: "Banco", value: BANCO_CONFIG[f.banco].label },
              { label: "Corretor", value: f.corretor },
              { label: "Protocolo", value: f.protocolNumber || "—" },
              { label: "Iniciado em", value: new Date(f.startDate).toLocaleDateString("pt-BR") },
              f.expectedEnd ? { label: "Previsão", value: new Date(f.expectedEnd).toLocaleDateString("pt-BR") } : null,
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0 gap-2">
                <span className="text-xs text-gray-500 shrink-0">{item.label}</span>
                <span className="text-xs font-medium text-[var(--brand-dark)] text-right">{item.value}</span>
              </div>
            ))}
          </div>

          {f.notes && (
            <div className="bg-yellow-50 border border-yellow-100 p-4">
              <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1">Observações</p>
              <p className="text-xs text-yellow-800">{f.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
