"use client";

import { useTransition } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { STATUS_CONFIG } from "@/lib/types/financiamento";
import {
  toggleChecklistItem,
  alterarStatusFinanciamento,
} from "@/lib/actions/financiamentos";

interface ChecklistItemData {
  id: string;
  grupo: string;
  item: string;
  concluido: boolean;
  concluidoEm: Date | string | null;
  notas: string;
}

interface Props {
  financiamentoId: string;
  checklist: ChecklistItemData[];
  statusAtual?: string;
}

const stageOrder = [
  "pre_analise",
  "documentacao",
  "analise_banco",
  "aprovado",
  "contrato",
  "registro",
  "liberado",
  "cancelado",
] as const;

export default function FinanciamentoChecklistClient({
  financiamentoId,
  checklist,
  statusAtual,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const totalChecklist = checklist.length;
  const doneChecklist = checklist.filter((i) => i.concluido).length;
  const progressPct =
    totalChecklist > 0 ? Math.round((doneChecklist / totalChecklist) * 100) : 0;

  const checklistByGroup = checklist.reduce((acc, item) => {
    if (!acc[item.grupo]) acc[item.grupo] = [];
    acc[item.grupo].push(item);
    return acc;
  }, {} as Record<string, ChecklistItemData[]>);

  function handleToggle(item: ChecklistItemData) {
    startTransition(() => {
      toggleChecklistItem(item.id, !item.concluido, financiamentoId);
    });
  }

  function handleStatusChange(status: string) {
    startTransition(() => {
      alterarStatusFinanciamento(financiamentoId, status);
    });
  }

  return (
    <div className="bg-white border border-gray-100 p-5 space-y-5">
      {/* Status change section */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Alterar Status
        </p>
        <div className="flex flex-wrap gap-2">
          {stageOrder.map((stage) => {
            const sc = STATUS_CONFIG[stage];
            const isActive = stage === statusAtual;
            return (
              <button
                key={stage}
                onClick={() => handleStatusChange(stage)}
                disabled={isPending || isActive}
                className={`text-[10px] font-bold px-3 py-1.5 uppercase tracking-wide transition-all border ${
                  isActive
                    ? `${sc.bgColor} ${sc.color} border-transparent cursor-default`
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
                } disabled:opacity-60`}
              >
                {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checklist progress */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
            Checklist Documental
          </h2>
          <span className="text-xs font-bold text-gray-500">
            {doneChecklist}/{totalChecklist} concluídos
          </span>
        </div>
        <div className="h-2 bg-gray-100 mb-5 overflow-hidden">
          <div
            className={`h-full transition-all ${
              progressPct === 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {totalChecklist === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Nenhum item no checklist.
          </p>
        ) : (
          Object.entries(checklistByGroup).map(([grupo, items]) => (
            <div key={grupo} className="mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                {grupo}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2.5 bg-gray-50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        onChange={() => handleToggle(item)}
                        disabled={isPending}
                        className="w-4 h-4 accent-[var(--brand-yellow)] cursor-pointer shrink-0"
                      />
                      {item.concluido ? (
                        <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                      ) : (
                        <AlertCircle size={14} className="text-orange-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--brand-dark)] truncate">
                          {item.item}
                        </p>
                        {item.concluidoEm && (
                          <p className="text-xs text-gray-400">
                            Concluído em{" "}
                            {new Date(item.concluidoEm).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        {item.notas && (
                          <p className="text-xs text-orange-500">{item.notas}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 uppercase shrink-0 ${
                        item.concluido
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-600"
                      }`}
                    >
                      {item.concluido ? "Concluído" : "Pendente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
