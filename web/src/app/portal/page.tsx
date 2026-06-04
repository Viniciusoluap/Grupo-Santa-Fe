import Link from "next/link";
import { FileText, CalendarDays, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { getClientProcess } from "@/lib/data/portal";
import { STAGE_CONFIG, DOC_STATUS_CONFIG } from "@/lib/types/portal";
import { formatCurrency } from "@/lib/utils";

export default function PortalDashboard() {
  const process = getClientProcess();
  const stageOrder = Object.entries(STAGE_CONFIG).sort(([, a], [, b]) => a.order - b.order);
  const currentStageOrder = STAGE_CONFIG[process.currentStage].order;

  const docsAprovados = process.documents.filter((d) => d.status === "aprovado").length;
  const docsPendentes = process.documents.filter((d) => d.status === "pendente").length;
  const docsEnviados = process.documents.filter((d) => d.status === "enviado").length;
  const lastUpdate = process.updates[process.updates.length - 1];

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <div className="bg-[var(--brand-dark)] p-5">
        <p className="text-gray-400 text-xs uppercase tracking-widest">Bem-vindo de volta</p>
        <h1 className="text-white font-black text-xl mt-1">{process.clientName}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{process.property}</p>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Progresso do Processo</p>
          <span className="font-black text-[var(--brand-dark)] text-xl">{process.progress}%</span>
        </div>
        <div className="h-3 bg-gray-100 overflow-hidden mb-5">
          <div
            className="h-full bg-[var(--brand-yellow)] transition-all"
            style={{ width: `${process.progress}%` }}
          />
        </div>

        {/* Stage pipeline */}
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {stageOrder.map(([stage, cfg], i, arr) => {
            const isActive = stage === process.currentStage;
            const isPast = cfg.order < currentStageOrder;
            return (
              <div key={stage} className="flex items-center shrink-0">
                <div className={`flex flex-col items-center px-2 py-1 ${isActive ? "opacity-100" : isPast ? "opacity-80" : "opacity-40"}`}>
                  <div className={`w-8 h-8 flex items-center justify-center text-base border-2 ${isActive ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]" : isPast ? "border-green-500 bg-green-500" : "border-gray-200 bg-white"}`}>
                    {isPast ? "✓" : cfg.icon}
                  </div>
                  <span className={`text-[9px] font-bold mt-1 uppercase text-center leading-tight max-w-[56px] ${isActive ? "text-[var(--brand-dark)]" : isPast ? "text-green-600" : "text-gray-400"}`}>
                    {cfg.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`h-0.5 w-4 shrink-0 ${isPast ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Document status card */}
        <Link href="/portal/documentos" className="bg-white border border-gray-100 p-5 hover:border-[var(--brand-yellow)] transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <FileText size={18} className="text-[var(--brand-yellow)]" />
            <span className="text-xs font-bold text-gray-400 group-hover:text-[var(--brand-dark)] transition-colors">Ver todos →</span>
          </div>
          <p className="font-black text-[var(--brand-dark)] text-2xl">{process.documents.length}</p>
          <p className="text-gray-400 text-xs mt-0.5">documentos no total</p>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={10} /> Aprovados</span>
              <span className="font-bold">{docsAprovados}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-blue-500"><Clock size={10} /> Em análise</span>
              <span className="font-bold">{docsEnviados}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-orange-400"><AlertCircle size={10} /> Pendentes</span>
              <span className="font-bold">{docsPendentes}</span>
            </div>
          </div>
        </Link>

        {/* Visits card */}
        <Link href="/portal/visitas" className="bg-white border border-gray-100 p-5 hover:border-[var(--brand-yellow)] transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <CalendarDays size={18} className="text-[var(--brand-yellow)]" />
            <span className="text-xs font-bold text-gray-400 group-hover:text-[var(--brand-dark)] transition-colors">Ver agenda →</span>
          </div>
          <p className="font-black text-[var(--brand-dark)] text-2xl">1</p>
          <p className="text-gray-400 text-xs mt-0.5">visita agendada</p>
          <div className="mt-3 bg-gray-50 p-2">
            <p className="text-xs font-bold text-[var(--brand-dark)]">Próxima visita</p>
            <p className="text-xs text-gray-400 mt-0.5">15/06/2026 às 10:00</p>
            <p className="text-xs text-gray-400">Residencial Jardim Novo</p>
          </div>
        </Link>

        {/* Financial card */}
        <div className="bg-[var(--brand-dark)] p-5">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Financeiro</p>
          <div className="space-y-3">
            {process.propertyValue && (
              <div>
                <p className="text-gray-400 text-xs">Valor do imóvel</p>
                <p className="text-white font-bold">{formatCurrency(process.propertyValue)}</p>
              </div>
            )}
            {process.financingValue && (
              <div>
                <p className="text-gray-400 text-xs">Valor financiado</p>
                <p className="text-[var(--brand-yellow)] font-bold">{formatCurrency(process.financingValue)}</p>
              </div>
            )}
            {process.estimatedEnd && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-gray-400 text-xs">Previsão de conclusão</p>
                <p className="text-white font-medium text-sm">{new Date(process.estimatedEnd).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Last update */}
      {lastUpdate && (
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Última Atualização</p>
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-yellow)] mt-1.5 shrink-0" />
            <div>
              <p className="text-sm text-[var(--brand-dark)]">{lastUpdate.message}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(lastUpdate.date).toLocaleDateString("pt-BR")} · por {lastUpdate.by}
              </p>
            </div>
          </div>
          <Link href="/portal/acompanhamento" className="mt-3 inline-block text-xs font-bold text-[var(--brand-yellow)] hover:underline">
            Ver histórico completo →
          </Link>
        </div>
      )}
    </div>
  );
}
