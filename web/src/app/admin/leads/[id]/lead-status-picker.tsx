"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { alterarStatusLead } from "@/lib/actions/leads";
import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/lib/types/crm";

export function LeadStatusPicker({ leadId, statusAtual }: { leadId: string; statusAtual: string }) {
  const [isPending, startTransition] = useTransition();

  function alterar(status: LeadStatus) {
    if (status === statusAtual || isPending) return;
    startTransition(async () => {
      await alterarStatusLead(leadId, status);
    });
  }

  return (
    <div className="space-y-1">
      {(Object.entries(LEAD_STATUS_CONFIG) as [LeadStatus, (typeof LEAD_STATUS_CONFIG)[LeadStatus]][])
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([status, c]) => {
          const ativo = statusAtual === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => alterar(status)}
              disabled={isPending}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold border transition-colors disabled:opacity-60 ${
                ativo
                  ? `${c.bgColor} ${c.color} border-transparent`
                  : "border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-600"
              }`}
            >
              {isPending && !ativo ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${ativo ? "bg-current" : "bg-gray-300"}`} />
              )}
              {c.label}
            </button>
          );
        })}
    </div>
  );
}
