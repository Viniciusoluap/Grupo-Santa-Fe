"use client";

import { useState } from "react";
import { agendarVisitaDoLead } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/ui/submit-button";

const TIPOS = [
  ["imovel", "Imóvel"], ["lote", "Lote"], ["obra", "Obra"], ["escritorio", "Escritório"],
  ["regularizacao", "Regularização"], ["avaliacao", "Avaliação"], ["financiamento", "Financiamento"],
  ["terreno", "Terreno"], ["reuniao", "Reunião"], ["outro", "Outro"],
] as const;

const campo = "w-full border border-gray-300 px-3 py-2 text-xs text-[var(--brand-dark)] placeholder:text-gray-600 placeholder:opacity-100 focus:outline-none focus:border-[var(--brand-yellow)]";

/** Item 10 (18/10): agendamento de visita do lead, gravado na Agenda do sistema. */
export function LeadAgendarVisita({ leadId, responsaveis, corretores, interno }: {
  leadId: string;
  responsaveis: { id: string; label: string }[];
  corretores: { id: string; nome: string }[];
  interno: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <form
      action={async (formData) => {
        setErro(null);
        setOk(false);
        try {
          await agendarVisitaDoLead(formData);
          setOk(true);
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Não foi possível agendar. Confira a data e o acesso ao lead.");
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input aria-label="Data e horário da visita" type="datetime-local" name="agendadaPara" required className={campo} />
      {interno && (
        <>
          <select aria-label="Responsável pela visita" name="responsavelId" defaultValue="" className={campo}>
            <option value="">Responsável (você)</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select aria-label="Corretor da visita" name="corretorId" defaultValue="" className={campo}>
            <option value="">Corretor (opcional)</option>
            {corretores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </>
      )}
      <select aria-label="Tipo de visita" name="tipoVisita" defaultValue="imovel" className={campo}>
        {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <textarea name="notas" rows={2} placeholder="Observações (opcional)" className={campo} />
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      {ok && <p role="status" className="text-xs text-green-800">Visita agendada e incluída na Agenda.</p>}
      <SubmitButton
        pendingText="Agendando..."
        className="w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2 transition-colors disabled:opacity-60"
      >
        Agendar visita
      </SubmitButton>
    </form>
  );
}
