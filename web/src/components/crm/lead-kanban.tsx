"use client";

import Link from "next/link";
import { Phone, MessageSquare, Calendar, User, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { LEAD_STATUS_CONFIG, LeadStatus } from "@/lib/types/crm";
import { formatCurrency } from "@/lib/utils";
import { excluirLead } from "@/lib/actions/leads";

type DbVisita = {
  id: string;
  status: string;
  agendadaPara: Date;
};

type DbLead = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  servico: string;
  status: string;
  origem: string;
  orcamento: number | null;
  notas: string;
  corretor: { id: string; nome: string } | null;
  visitas: DbVisita[];
};

const KANBAN_COLUMNS: LeadStatus[] = [
  "novo",
  "contato",
  "visita_agendada",
  "proposta",
  "negociacao",
  "ganho",
  "perdido",
];

function ExcluirLeadBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Excluir este lead? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      await excluirLead(id);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title="Excluir lead"
      className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      <Trash2 size={12} />
    </button>
  );
}

function LeadCard({ lead }: { lead: DbLead }) {
  const agendada = lead.visitas.find((v) => v.status === "agendada");

  return (
    <div className="bg-white border border-gray-100 p-3 hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-[var(--brand-dark)] text-sm leading-tight">{lead.nome}</p>
        <Link
          href={`/admin/leads/${lead.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[var(--brand-yellow)]"
        >
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {(() => { try { return JSON.parse(lead.servico) as string[]; } catch { return [lead.servico]; } })().map((s: string) => (
          <span key={s} className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 font-medium truncate max-w-[120px]">{s}</span>
        ))}
      </div>

      {lead.orcamento && (
        <p className="text-[var(--brand-yellow)] font-black text-sm mb-2">
          {formatCurrency(lead.orcamento)}
        </p>
      )}

      <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
        <User size={10} />
        <span className="truncate">{lead.corretor?.nome ?? "—"}</span>
      </div>

      {agendada && (
        <div className="flex items-center gap-1 text-purple-600 text-xs bg-purple-50 px-2 py-1 mb-2">
          <Calendar size={10} />
          {new Date(agendada.agendadaPara).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      <div className="flex gap-1 pt-2 border-t border-gray-50">
        <a
          href={`tel:${lead.telefone}`}
          title="Ligar"
          className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-[var(--brand-dark)] hover:bg-gray-50 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Phone size={12} />
        </a>
        <a
          href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp"
          className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquare size={12} />
        </a>
        <Link
          href={`/admin/leads/${lead.id}/editar`}
          title="Editar lead"
          className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil size={12} />
        </Link>
        <Link
          href={`/admin/leads/${lead.id}`}
          title="Ver detalhes"
          className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-[var(--brand-yellow)] hover:bg-yellow-50 transition-colors"
        >
          <ArrowRight size={12} />
        </Link>
        <ExcluirLeadBtn id={lead.id} />
      </div>
    </div>
  );
}

export function LeadKanban({ leads }: { leads: DbLead[] }) {
  const byStatus = (status: string) => leads.filter((l) => l.status === status);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const cfg = LEAD_STATUS_CONFIG[status];
        const col = byStatus(status);
        return (
          <div key={status} className="flex-shrink-0 w-60">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {col.length}
              </span>
            </div>

            <div className="space-y-2 min-h-20">
              {col.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
              {col.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 p-4 text-center">
                  <p className="text-gray-300 text-xs">Nenhum lead</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
