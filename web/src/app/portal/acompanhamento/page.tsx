import { Clock } from "lucide-react";
import { getClientProcess } from "@/lib/data/portal";
import { STAGE_CONFIG } from "@/lib/types/portal";

export default function PortalAcompanhamentoPage() {
  const process = getClientProcess();
  const updates = [...process.updates].reverse();
  const stageOrder = Object.entries(STAGE_CONFIG).sort(([, a], [, b]) => a.order - b.order);
  const currentStageOrder = STAGE_CONFIG[process.currentStage].order;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Acompanhamento</h1>
        <p className="text-gray-400 text-sm mt-0.5">Histórico completo do seu processo</p>
      </div>

      {/* Current stage highlight */}
      <div className="bg-[var(--brand-dark)] p-5">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Etapa atual</p>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{STAGE_CONFIG[process.currentStage].icon}</span>
          <div>
            <p className="text-white font-black text-lg uppercase">{STAGE_CONFIG[process.currentStage].label}</p>
            <p className="text-gray-400 text-xs">Iniciado em {new Date(process.startDate).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>

      {/* Full stage pipeline */}
      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Etapas do Processo</p>
        <div className="space-y-3">
          {stageOrder.map(([stage, cfg]) => {
            const isActive = stage === process.currentStage;
            const isPast = cfg.order < currentStageOrder;
            const isFuture = cfg.order > currentStageOrder;
            return (
              <div key={stage} className={`flex items-center gap-4 p-3 ${isActive ? "bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)]" : isPast ? "bg-green-50 border border-green-100" : "bg-gray-50 border border-gray-100"}`}>
                <div className={`w-9 h-9 flex items-center justify-center text-lg shrink-0 ${isActive ? "bg-[var(--brand-yellow)]" : isPast ? "bg-green-500 text-white" : "bg-gray-200"}`}>
                  {isPast ? "✓" : cfg.icon}
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${isActive ? "text-[var(--brand-dark)]" : isPast ? "text-green-700" : "text-gray-400"}`}>
                    {cfg.label}
                    {isActive && <span className="ml-2 text-[10px] bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-2 py-0.5 uppercase font-black">Em andamento</span>}
                  </p>
                  {isPast && <p className="text-xs text-green-600">Concluído</p>}
                  {isFuture && <p className="text-xs text-gray-400">Aguardando</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Histórico de Atualizações</p>
        <div className="relative space-y-4">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
          {updates.map((update, i) => (
            <div key={update.id} className="relative flex gap-4 pl-10">
              <div className={`absolute left-0 w-8 h-8 border-2 rounded-full flex items-center justify-center text-sm bg-white ${i === 0 ? "border-[var(--brand-yellow)]" : "border-gray-200"}`}>
                {STAGE_CONFIG[update.stage].icon}
              </div>
              <div className={`flex-1 p-3 ${i === 0 ? "bg-[var(--brand-yellow)]/5 border border-[var(--brand-yellow)]/30" : "bg-gray-50"}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-[var(--brand-dark)] uppercase">{STAGE_CONFIG[update.stage].label}</span>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={10} />
                    {new Date(update.date).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <p className="text-sm text-gray-600">{update.message}</p>
                <p className="text-xs text-gray-400 mt-1">por {update.by}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
