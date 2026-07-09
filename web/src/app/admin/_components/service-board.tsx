"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Phone, MessageSquare, ArrowRight, Calendar, Search,
  Home, Landmark, Tag, KeyRound, Banknote, Ruler, ScrollText,
  HardHat, PencilRuler, FileStack, LayoutGrid, Plus,
} from "lucide-react";
import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/lib/types/crm";
import { formatCurrency } from "@/lib/utils";

// Cliente/lead já achatado no server (props serializáveis).
export interface BoardLead {
  id: string;
  nome: string;
  telefone: string;
  servicos: string[];
  status: string;
  orcamento: number | null;
  corretorNome: string | null;
  criadoEm: string;        // ISO
  proximaVisita: string | null; // ISO
}

// Ordem canônica das colunas = serviços reais do site (SERVICOS do formulário de lead).
// Qualquer serviço fora desta lista cai em "Outros serviços".
const COLUNAS: { servico: string; Icon: typeof Home }[] = [
  { servico: "Compra de imóvel", Icon: Home },
  { servico: "Compra de lote", Icon: Landmark },
  { servico: "Venda de imóvel", Icon: Tag },
  { servico: "Locação", Icon: KeyRound },
  { servico: "Financiamento MCMV", Icon: Banknote },
  { servico: "Financiamento Convencional", Icon: Banknote },
  { servico: "Avaliação de imóvel", Icon: Ruler },
  { servico: "Regularização imobiliária", Icon: ScrollText },
  { servico: "Obra e reforma", Icon: HardHat },
  { servico: "Projeto de engenharia", Icon: PencilRuler },
];
const COLUNA_OUTROS = { servico: "Outros serviços", Icon: FileStack };
const CANONICOS = new Set(COLUNAS.map((c) => c.servico));

// Status legados no banco → status canônicos do CRM.
const STATUS_LEGADO: Record<string, LeadStatus> = {
  em_contato: "contato",
  proposta_enviada: "proposta",
  fechado: "ganho",
};
function normalizaStatus(s: string): LeadStatus {
  if (s in LEAD_STATUS_CONFIG) return s as LeadStatus;
  return STATUS_LEGADO[s] ?? "novo";
}

function iniciais(nome: string | null): string {
  if (!nome) return "—";
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase() || "—";
}

function LeadCard({ lead }: { lead: BoardLead }) {
  const st = normalizaStatus(lead.status);
  const cfg = LEAD_STATUS_CONFIG[st];
  return (
    <div className="bg-white border border-gray-100 hover:shadow-md transition-shadow group">
      {/* Faixa de status (etiqueta colorida, estilo Trello) */}
      <div className={`h-1.5 w-full ${cfg.bgColor}`} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-bold text-[var(--brand-dark)] text-sm leading-tight">{lead.nome}</p>
          <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {lead.orcamento != null && lead.orcamento > 0 && (
          <p className="text-[var(--brand-dark)] font-black text-base mb-2">
            {formatCurrency(lead.orcamento)}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs min-w-0">
            <span className="w-5 h-5 rounded-full bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-[9px] font-black flex items-center justify-center shrink-0">
              {iniciais(lead.corretorNome)}
            </span>
            <span className="truncate">{lead.corretorNome ?? "Sem responsável"}</span>
          </div>
          <span className="text-[10px] text-gray-300 shrink-0">
            {new Date(lead.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        </div>

        {lead.proximaVisita && (
          <div className="flex items-center gap-1 text-purple-600 text-[11px] bg-purple-50 px-2 py-1 mb-2">
            <Calendar size={10} />
            {new Date(lead.proximaVisita).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            })}
          </div>
        )}

        <div className="flex gap-1 pt-2 border-t border-gray-50">
          <a href={`tel:${lead.telefone}`} title="Ligar"
            className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-[var(--brand-dark)] hover:bg-gray-50 transition-colors">
            <Phone size={12} />
          </a>
          <a href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
            className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors">
            <MessageSquare size={12} />
          </a>
          <Link href={`/admin/leads/${lead.id}`} title="Abrir cliente"
            className="flex-1 flex items-center justify-center py-1 text-gray-400 hover:text-[var(--brand-yellow)] hover:bg-yellow-50 transition-colors">
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ServiceBoard({ leads }: { leads: BoardLead[] }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | LeadStatus>("todos");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && !l.nome.toLowerCase().includes(q)) return false;
      if (statusFiltro !== "todos" && normalizaStatus(l.status) !== statusFiltro) return false;
      return true;
    });
  }, [leads, busca, statusFiltro]);

  // Agrupa por serviço. Um cliente com N serviços aparece em N colunas (espelhado).
  const porServico = useMemo(() => {
    const map = new Map<string, BoardLead[]>();
    for (const col of COLUNAS) map.set(col.servico, []);
    map.set(COLUNA_OUTROS.servico, []);
    for (const l of filtrados) {
      const servicos = l.servicos.length ? l.servicos : [];
      const alvos = new Set<string>();
      for (const s of servicos) alvos.add(CANONICOS.has(s) ? s : COLUNA_OUTROS.servico);
      if (alvos.size === 0) alvos.add(COLUNA_OUTROS.servico);
      for (const alvo of alvos) map.get(alvo)!.push(l);
    }
    return map;
  }, [filtrados]);

  // Só mostra colunas que têm ao menos 1 card (mantém o quadro limpo).
  const colunasVisiveis = [...COLUNAS, COLUNA_OUTROS].filter(
    (c) => (porServico.get(c.servico)?.length ?? 0) > 0
  );

  const totalClientes = filtrados.length;
  const totalPipeline = filtrados.reduce((s, l) => s + (l.orcamento ?? 0), 0);
  const totalGanhos = filtrados.filter((l) => normalizaStatus(l.status) === "ganho").length;

  return (
    <div className="space-y-4">
      {/* Barra de totais + filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-3">
          {[
            { label: "Clientes", value: totalClientes },
            { label: "Pipeline", value: formatCurrency(totalPipeline) },
            { label: "Ganhos", value: totalGanhos },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-gray-100 px-4 py-2">
              <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{value}</p>
              <p className="text-gray-400 text-[10px] uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-[180px] relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full text-sm border border-gray-200 pl-8 pr-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]"
          />
        </div>

        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value as "todos" | LeadStatus)}
          className="text-sm border border-gray-200 px-3 py-2 bg-white focus:outline-none focus:border-[var(--brand-yellow)]"
        >
          <option value="todos">Todos os status</option>
          {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{LEAD_STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        <Link
          href="/admin/leads/novo"
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Novo cliente
        </Link>
      </div>

      {/* Quadro */}
      {colunasVisiveis.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 p-12 text-center">
          <LayoutGrid size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum cliente para exibir</p>
          <p className="text-gray-400 text-sm mt-1">Ajuste os filtros ou cadastre um novo cliente.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {colunasVisiveis.map(({ servico, Icon }) => {
            const col = porServico.get(servico) ?? [];
            const totalColuna = col.reduce((s, l) => s + (l.orcamento ?? 0), 0);
            return (
              <div key={servico} className="flex-shrink-0 w-64">
                <div className="bg-[var(--brand-dark)] px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={14} className="text-[var(--brand-yellow)] shrink-0" />
                    <p className="text-white text-xs font-bold uppercase tracking-wide truncate">{servico}</p>
                  </div>
                  <span className="text-[10px] font-black text-[var(--brand-dark)] bg-[var(--brand-yellow)] px-1.5 py-0.5 shrink-0">
                    {col.length}
                  </span>
                </div>
                {totalColuna > 0 && (
                  <div className="bg-gray-50 border-x border-gray-100 px-3 py-1.5 text-[11px] text-gray-500">
                    Pipeline: <span className="font-bold text-[var(--brand-dark)]">{formatCurrency(totalColuna)}</span>
                  </div>
                )}
                <div className="space-y-2 mt-2 min-h-20">
                  {col.map((lead) => (
                    <LeadCard key={`${servico}-${lead.id}`} lead={lead} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
