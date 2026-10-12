"use client";

import Link from "next/link";
import { LEAD_TEMPERATURA_CONFIG, leadTemperaturaRotulo, type LeadTemperatura } from "@/lib/crm/temperatura-lead";
import { Phone, MessageSquare, Calendar, User, ArrowRight, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { LEAD_STAGES, LEAD_STAGE_CONFIG } from "@/lib/types/crm";
import { etapaDoLead, leadNoPipelineAtivo, parseServicosLead } from "@/lib/crm/pipeline";
import { formatCurrency } from "@/lib/utils";
import { alterarEtapaLead } from "@/lib/actions/leads";

export type KanbanLead = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  servico: string;
  status: string;
  temperatura: string;
  etapaOperacional: string | null;
  arquivadoEm: Date | null;
  excluidoEm: Date | null;
  atualizadoEm: Date;
  origem: string;
  orcamento: number | null;
  notas: string;
  corretor: { id: string; nome: string } | null;
  responsavel: { id: string; nome: string } | null;
  visitas: { id: string; status: string; agendadaPara: Date }[];
};

export function LeadCard({ lead, podeMover = true }: { lead: KanbanLead; podeMover?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const agendada = lead.visitas.find((v) => v.status === "agendada");
  const etapa = etapaDoLead(lead);
  const ativo = leadNoPipelineAtivo(lead);
  const phone = lead.telefone.replace(/\D/g, "");
  return (
    <article className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/admin/leads/${lead.id}`} className="block font-bold text-[var(--brand-dark)] text-sm leading-tight hover:underline">{lead.temperatura === "fechado" && <span className="mr-1" title="Negócio fechado">{LEAD_TEMPERATURA_CONFIG.fechado.emoji}</span>}{lead.nome}</Link>
      <p className={`text-[10px] font-bold mt-0.5 ${LEAD_TEMPERATURA_CONFIG[lead.temperatura as LeadTemperatura]?.color ?? "text-gray-500"}`}>{leadTemperaturaRotulo(lead.temperatura)}</p>
      <div className="flex flex-wrap gap-1 my-2">
        {parseServicosLead(lead.servico).map((s) => <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded" title={s}>{s}</span>)}
      </div>
      {lead.orcamento !== null && <p className="font-bold text-[var(--brand-dark)] text-sm mb-2">{formatCurrency(lead.orcamento)}</p>}
      <div className="flex items-center gap-1 text-gray-600 text-xs mb-2"><User size={12} /><span>{lead.responsavel?.nome ?? "Sem responsável"}</span></div>
      {!etapa && <p className="text-xs text-gray-600 mb-2">Status comercial original: {lead.status}</p>}
      {agendada && <div className="flex items-center gap-1 text-purple-600 text-xs bg-purple-50 p-2 mb-2"><Calendar size={12} />{new Date(agendada.agendadaPara).toLocaleString("pt-BR")}</div>}
      {podeMover && ativo && <label className="block text-[10px] font-bold text-gray-600">Mover para etapa
        <select aria-label={`Etapa de ${lead.nome}`} value={etapa ?? ""} disabled={isPending} className="mt-1 w-full border border-gray-200 rounded p-1.5 text-xs bg-white font-normal disabled:opacity-60" onChange={(e) => {
          const destino = e.target.value;
          if (!destino || isPending) return;
          setErro(null);
          startTransition(async () => {
            try { await alterarEtapaLead(lead.id, destino, lead.etapaOperacional, new Date(lead.atualizadoEm).toISOString()); }
            catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível alterar a etapa."); }
          });
        }}>
          {!etapa && <option value="">A CLASSIFICAR</option>}
          {LEAD_STAGES.map((s) => <option key={s} value={s}>{LEAD_STAGE_CONFIG[s].label}</option>)}
        </select>
      </label>}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
      <div className="flex gap-1 mt-3 pt-2 border-t border-gray-100">
        <a href={`tel:${lead.telefone}`} title="Ligar" className="flex-1 flex justify-center p-1 text-gray-600 hover:text-[var(--brand-dark)]"><Phone size={14} /></a>
        <a href={`https://wa.me/${phone.startsWith("55") ? phone : `55${phone}`}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="flex-1 flex justify-center p-1 text-gray-600 hover:text-green-700"><MessageSquare size={14} /></a>
        {ativo && <Link href={`/admin/leads/${lead.id}/editar`} title="Editar lead" className="flex-1 flex justify-center p-1 text-gray-600 hover:text-blue-600"><Pencil size={14} /></Link>}
        <Link href={`/admin/leads/${lead.id}`} title="Ver detalhes e histórico" className="flex-1 flex justify-center p-1 text-gray-600 hover:text-[var(--brand-dark)]"><ArrowRight size={14} /></Link>
      </div>
    </article>
  );
}

export function LeadKanban({ leads }: { leads: KanbanLead[] }) {
  const ativos = leads.filter(leadNoPipelineAtivo);
  const semEtapa = ativos.filter((lead) => !etapaDoLead(lead));
  return <div className="space-y-5">
    {semEtapa.length > 0 && <section className="border border-amber-200 bg-amber-50 rounded-lg p-4">
      <h2 className="text-sm font-bold text-amber-900">A CLASSIFICAR · {semEtapa.length}</h2>
      <p className="text-xs text-amber-800 mt-1 mb-3">Leads com status comercial original preservado. Selecione a etapa operacional após revisão.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{semEtapa.map((lead) => <LeadCard key={lead.id} lead={lead} />)}</div>
    </section>}
    <div className="flex gap-3 overflow-x-auto pb-4" aria-label="Pipeline de sete etapas">
      {LEAD_STAGES.map((stage) => {
        const cfg = LEAD_STAGE_CONFIG[stage];
        const col = ativos.filter((lead) => etapaDoLead(lead) === stage);
        return <section key={stage} className="shrink-0 w-64 rounded-lg bg-gray-50 border border-gray-100 p-2">
          <div className="flex items-center justify-between gap-2 mb-3 min-h-9"><h2 className={`text-[10px] font-black p-2 rounded ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</h2><span className="text-xs font-bold text-gray-600">{col.length}</span></div>
          <div className="space-y-2 min-h-20">{col.map((lead) => <LeadCard key={lead.id} lead={lead} />)}{col.length === 0 && <p className="border border-dashed border-gray-200 rounded p-5 text-center text-gray-600 text-xs">Nenhum lead</p>}</div>
        </section>;
      })}
    </div>
  </div>;
}
