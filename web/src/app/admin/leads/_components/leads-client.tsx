"use client";

import { useState } from "react";
import { LEAD_TEMPERATURAS, leadTemperaturaRotulo } from "@/lib/crm/temperatura-lead";
import Link from "next/link";
import { Plus, LayoutGrid, List, Search, CalendarDays, ArrowRight } from "lucide-react";
import { LEAD_STAGE_CONFIG, LEAD_STAGES, LEAD_STATUS_CONFIG, type LeadStatus } from "@/lib/types/crm";
import { LeadKanban, type KanbanLead } from "@/components/crm/lead-kanban";
import { etapaDoLead, leadNoPipelineAtivo, parseServicosLead } from "@/lib/crm/pipeline";
import { formatCurrency, formatTelefone } from "@/lib/utils";

export type LeadListItem = KanbanLead & { responsavelId: string | null; criadoEm: Date };
type HistoricoFiltro = "ativos" | "a_classificar" | "perdidos" | "arquivados" | "excluidos" | "todos";

export function LeadsClient({ leads }: { leads: LeadListItem[] }) {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [servico, setServico] = useState("");
  const [situacao, setSituacao] = useState<HistoricoFiltro>("ativos");
  const [stage, setStage] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const responsaveis = [...new Map(leads.flatMap((l) => l.responsavel ? [[l.responsavel.id, l.responsavel] as const] : [])).values()].sort((a, b) => a.nome.localeCompare(b.nome));
  const servicos = [...new Set(leads.flatMap((l) => parseServicosLead(l.servico)))].sort();
  const encontrados = leads.filter((l) => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return (!q || [l.nome, l.telefone, l.email ?? "", parseServicosLead(l.servico).join(" "), l.responsavel?.nome ?? "", l.corretor?.nome ?? ""].some((v) => v.toLocaleLowerCase("pt-BR").includes(q))) &&
      (!responsavel || (responsavel === "sem" ? !l.responsavelId : l.responsavelId === responsavel)) &&
      (!servico || parseServicosLead(l.servico).includes(servico)) &&
      (!temperatura || l.temperatura === temperatura);
  });
  const ativos = encontrados.filter(leadNoPipelineAtivo);
  const counts = Object.fromEntries(LEAD_STAGES.map((s) => [s, ativos.filter((l) => etapaDoLead(l) === s).length]));
  const naoClassificados = ativos.filter((l) => !etapaDoLead(l)).length;
  const filtrados = encontrados.filter((l) => {
    const visible = situacao === "todos" ||
      (situacao === "ativos" && leadNoPipelineAtivo(l)) ||
      (situacao === "a_classificar" && leadNoPipelineAtivo(l) && !etapaDoLead(l)) ||
      (situacao === "perdidos" && !l.excluidoEm && ["perdido", "lost"].includes(l.status)) ||
      (situacao === "arquivados" && !l.excluidoEm && (!!l.arquivadoEm || ["arquivado", "archived"].includes(l.status))) ||
      (situacao === "excluidos" && (!!l.excluidoEm || ["excluido", "deleted"].includes(l.status)));
    return visible && (!stage || etapaDoLead(l) === stage);
  });
  const kanban = view === "kanban" && ["ativos", "a_classificar"].includes(situacao);
  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white placeholder:text-gray-600 placeholder:opacity-100 focus:outline-none focus:border-[var(--brand-yellow)]";
  return <div className="space-y-5 min-w-0">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div><h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">CRM Santa Fé</h1><p className="text-gray-600 text-sm mt-1">{leads.filter(leadNoPipelineAtivo).length} ativos · {leads.length} registros preservados</p></div>
      <div className="flex items-center gap-2">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button aria-label="Ver kanban" aria-pressed={view === "kanban"} onClick={() => setView("kanban")} className={`px-3 py-2 ${view === "kanban" ? "bg-[var(--brand-dark)] text-white" : "bg-white text-gray-600"}`}><LayoutGrid size={16} /></button>
          <button aria-label="Ver lista" aria-pressed={view === "list"} onClick={() => setView("list")} className={`px-3 py-2 ${view === "list" ? "bg-[var(--brand-dark)] text-white" : "bg-white text-gray-600"}`}><List size={16} /></button>
        </div>
        <Link href="/admin/leads/novo" className="flex items-center gap-1.5 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase px-4 py-2.5 rounded-lg"><Plus size={14} /> Novo Lead</Link>
      </div>
    </div>
    <Link href="/admin/agenda" className="inline-flex min-h-11 w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-yellow)] sm:w-auto">
      <CalendarDays size={20} className="shrink-0" aria-hidden="true" />
      <span>Tarefas e Agendamentos</span>
      <ArrowRight size={16} className="ml-auto shrink-0" aria-hidden="true" />
    </Link>
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
      {LEAD_STAGES.map((s) => <button type="button" key={s} aria-pressed={stage === s} onClick={() => { setStage(stage === s ? "" : s); setSituacao("ativos"); }} className={`bg-white border rounded-lg p-3 text-center ${stage === s ? "border-[var(--brand-yellow)]" : "border-gray-100"}`}><p className="font-black text-[var(--brand-dark)] text-2xl">{counts[s]}</p><span className="block text-[10px] font-bold text-gray-600 mt-1">{LEAD_STAGE_CONFIG[s].label}</span></button>)}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      <label className="text-xs text-gray-600">Buscar<div className="relative mt-1"><Search size={14} className="absolute left-3 top-3.5 text-gray-600" /><input aria-label="Buscar leads" placeholder="Nome, telefone, e-mail ou serviço" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} /></div></label>
      <label className="text-xs text-gray-600">Responsável<select className={`${inputClass} mt-1`} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}><option value="">Todos os responsáveis</option><option value="sem">Sem responsável</option>{responsaveis.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
      <label className="text-xs text-gray-600">Serviço<select className={`${inputClass} mt-1`} value={servico} onChange={(e) => setServico(e.target.value)}><option value="">Todos os serviços</option>{servicos.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      <label className="text-xs text-gray-600">Temperatura<select className={`${inputClass} mt-1`} value={temperatura} onChange={(e) => setTemperatura(e.target.value)}><option value="">Todas as temperaturas</option>{LEAD_TEMPERATURAS.map((t) => <option key={t} value={t}>{leadTemperaturaRotulo(t)}</option>)}</select></label>
      <label className="text-xs text-gray-600">Situação<select className={`${inputClass} mt-1`} value={situacao} onChange={(e) => { setSituacao(e.target.value as HistoricoFiltro); setStage(""); }}><option value="ativos">Pipeline ativo</option><option value="a_classificar">A classificar ({naoClassificados})</option><option value="perdidos">Perdidos</option><option value="arquivados">Arquivados</option><option value="excluidos">Excluídos · histórico</option><option value="todos">Todos · histórico completo</option></select></label>
    </div>
    <div className="flex justify-between gap-3 text-xs text-gray-600"><p>{filtrados.length} leads encontrados{stage && ` · ${LEAD_STAGE_CONFIG[stage as keyof typeof LEAD_STAGE_CONFIG].label}`}</p>{(stage || search || responsavel || servico || temperatura || situacao !== "ativos") && <button className="font-bold hover:underline" onClick={() => { setSearch(""); setResponsavel(""); setServico(""); setTemperatura(""); setStage(""); setSituacao("ativos"); }}>Limpar filtros</button>}</div>
    {kanban ? <LeadKanban leads={filtrados} /> : <div className="bg-white border border-gray-100 rounded-lg overflow-x-auto">
      <table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-600"><tr>{["Lead", "Serviços", "Responsável", "Orçamento", "Etapa / situação", "Histórico"].map((label) => <th key={label} className="px-4 py-3 text-left font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
        {filtrados.map((lead) => {
          const etapa = etapaDoLead(lead);
          return <tr key={lead.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Link href={`/admin/leads/${lead.id}`} className="font-bold text-[var(--brand-dark)] hover:underline">{lead.nome}</Link><p className="text-xs text-gray-600">{formatTelefone(lead.telefone)} · {leadTemperaturaRotulo(lead.temperatura)}</p></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{parseServicosLead(lead.servico).map((s) => <span key={s} className="text-[10px] rounded bg-gray-100 text-gray-600 px-1.5 py-0.5">{s}</span>)}</div></td><td className="px-4 py-3 text-gray-600">{lead.responsavel?.nome ?? "Sem responsável"}</td><td className="px-4 py-3 text-gray-600">{lead.orcamento !== null ? formatCurrency(lead.orcamento) : "—"}</td><td className="px-4 py-3"><p className="text-[10px] font-bold">{lead.excluidoEm || ["excluido", "deleted"].includes(lead.status) ? "EXCLUÍDO" : lead.arquivadoEm || ["arquivado", "archived"].includes(lead.status) ? "ARQUIVADO" : ["perdido", "lost"].includes(lead.status) ? "PERDIDO" : etapa ? LEAD_STAGE_CONFIG[etapa].label : "A CLASSIFICAR"}</p><p className="text-[10px] text-gray-600 mt-1">Original: {LEAD_STATUS_CONFIG[lead.status as LeadStatus]?.label ?? lead.status}</p></td><td className="px-4 py-3"><Link href={`/admin/leads/${lead.id}`} className="font-bold text-xs hover:underline">Ver detalhes</Link></td></tr>;
        })}
        {filtrados.length === 0 && <tr><td colSpan={6} className="text-center p-8 text-gray-600">Nenhum lead para estes filtros.</td></tr>}
      </tbody></table>
    </div>}
  </div>;
}
