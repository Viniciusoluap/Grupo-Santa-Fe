"use client";

import { useState, useTransition } from "react";
import { alterarEtapaLead, arquivarLead, excluirLead } from "@/lib/actions/leads";
import { LEAD_STAGE_CONFIG, LEAD_STAGES } from "@/lib/types/crm";
import { etapaDoLead, leadNoPipelineAtivo } from "@/lib/crm/pipeline";

type Props = {
  leadId: string;
  statusAtual: string;
  etapaOperacional: string | null;
  atualizadoEm: string;
  arquivadoEm: string | null;
  excluidoEm: string | null;
  interno: boolean;
};

export function LeadStatusPicker(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const etapa = etapaDoLead({ ...props, status: props.statusAtual });
  const ativo = leadNoPipelineAtivo({ ...props, status: props.statusAtual });
  function run(action: () => Promise<void>) {
    setErro(null);
    startTransition(async () => { try { await action(); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); } });
  }
  return <div className="space-y-2">
    {!etapa && <p className="text-xs text-amber-800">A CLASSIFICAR · status original: {props.statusAtual}</p>}
    {LEAD_STAGES.map((stage) => {
      const cfg = LEAD_STAGE_CONFIG[stage];
      return <button key={stage} type="button" aria-pressed={etapa === stage} onClick={() => run(() => alterarEtapaLead(props.leadId, stage, props.etapaOperacional, props.atualizadoEm))} disabled={isPending || !ativo || props.etapaOperacional === stage} className={`w-full text-left rounded px-3 py-2 text-xs font-bold border disabled:cursor-not-allowed ${etapa === stage ? `${cfg.bgColor} ${cfg.color} border-transparent` : "border-gray-100 text-gray-600 hover:border-gray-300"}`}>{cfg.label}</button>;
    })}
    {!ativo && <p className="text-xs text-gray-600">Lead fora do pipeline ativo. Histórico e serviços preservados.</p>}
    {props.interno && !props.excluidoEm && <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
      <button disabled={isPending} type="button" className="text-xs font-bold border border-gray-200 px-3 py-2 rounded disabled:cursor-not-allowed" onClick={() => run(() => arquivarLead(props.leadId, !props.arquivadoEm))}>{props.arquivadoEm ? "Desarquivar" : "Arquivar lead"}</button>
      <button disabled={isPending} type="button" className="text-xs font-bold text-red-700 border border-red-100 px-3 py-2 rounded disabled:cursor-not-allowed" onClick={() => { if (confirm("Excluir este lead da operação? O cadastro, o histórico e os serviços serão preservados.")) run(() => excluirLead(props.leadId)); }}>Excluir da operação</button>
    </div>}
    {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
  </div>;
}
