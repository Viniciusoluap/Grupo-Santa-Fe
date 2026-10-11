"use client";

import { useState } from "react";
import { agendarVisitaDoLead } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/ui/submit-button";

export function LeadAgendarVisita({ leadId }: { leadId: string }) {
  const [erro, setErro] = useState<string | null>(null);
  return (
    <form action={async (formData) => { setErro(null); try { await agendarVisitaDoLead(formData); } catch { setErro("Não foi possível agendar. Confira a data e o acesso ao lead."); } }} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input
        aria-label="Data e horário da visita"
        type="datetime-local"
        name="agendadaPara"
        required
        className="w-full border border-gray-200 px-3 py-2 text-xs placeholder:text-gray-600 placeholder:opacity-100 focus:outline-none focus:border-[var(--brand-yellow)]"
      />
      <input
        type="text"
        name="notas"
        placeholder="Observações (opcional)"
        className="w-full border border-gray-200 px-3 py-2 text-xs placeholder:text-gray-600 placeholder:opacity-100 focus:outline-none focus:border-[var(--brand-yellow)]"
      />
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      <SubmitButton
        pendingText="Agendando..."
        className="w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2 transition-colors disabled:opacity-60"
      >
        Agendar
      </SubmitButton>
    </form>
  );
}
