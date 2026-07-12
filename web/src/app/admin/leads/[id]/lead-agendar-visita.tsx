"use client";

import { criarVisita } from "@/lib/actions/agenda";
import { SubmitButton } from "@/components/ui/submit-button";

export function LeadAgendarVisita({ leadId }: { leadId: string }) {
  return (
    <form action={criarVisita} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input
        type="datetime-local"
        name="agendadaPara"
        required
        className="w-full border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-[var(--brand-yellow)]"
      />
      <input
        type="text"
        name="notas"
        placeholder="Observações (opcional)"
        className="w-full border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-[var(--brand-yellow)]"
      />
      <SubmitButton
        pendingText="Agendando..."
        className="w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2 transition-colors disabled:opacity-60"
      >
        Agendar
      </SubmitButton>
    </form>
  );
}
