"use client";

import { useMemo, useState } from "react";
import { FILTROS_OBRAS_VAZIOS, filtrarObras, filtrosAtivos, type FiltrosObras, type OrdemObras } from "@/lib/obras-filtro";
import { formatarPercentual } from "@/lib/financeiro/progresso";
import Link from "next/link";
import { Search, HardHat, Pencil } from "lucide-react";
import { OBRA_STATUS_CONFIG, ObraStatus, tipoProjetoObra } from "@/lib/types/obra";
import { formatCurrency } from "@/lib/utils";
import { excluirObra, cancelarObra } from "@/lib/actions/obras";
import { AcoesExcluirCancelar } from "@/components/admin/acoes-excluir-cancelar";

interface ObraEtapa {
  id: string;
  status: string;
}

interface Obra {
  id: string;
  nome: string;
  tipo: string | null;
  servicoLead: { servico: string } | null;
  status: string;
  clienteNome: string;
  clienteTel: string;
  endereco: string | null;
  area: number | null;
  valorTotal: number | null;
  valorPago: number;
  vgv: number | null;
  progresso: number;
  engenheiroResp: string | null;
  dataInicio: Date | null;
  dataPrevisaoFim: Date | null;
  dataConclusao: Date | null;
  etapas: ObraEtapa[];
  criadoEm: Date;
  empreiteiroNome: string | null;
}

/** Código curto e estável exibido e pesquisável (o ID interno é longo). */
export function codigoObra(id: string) {
  return `OB-${id.slice(-6).toUpperCase()}`;
}

interface Props {
  obras: Obra[];
}

export function ObrasClient({ obras }: Props) {
  const [filtros, setFiltros] = useState<FiltrosObras>(FILTROS_OBRAS_VAZIOS);
  const set = <K extends keyof FiltrosObras>(campo: K, valor: FiltrosObras[K]) => setFiltros((f) => ({ ...f, [campo]: valor }));

  // Item 01: todos os filtros funcionam juntos (lib/obras-filtro, igual ao Prospecta).
  const filtered = useMemo(() => filtrarObras(obras.map((o) => ({
    ...o, codigo: codigoObra(o.id), cliente: o.clienteNome, responsaveis: [o.engenheiroResp, o.empreiteiroNome],
    inicio: o.dataInicio, fim: o.dataConclusao ?? o.dataPrevisaoFim,
  })), filtros), [obras, filtros]);
  const ativos = filtrosAtivos(filtros);

  const emAndamento = obras.filter((o) => o.status === "em_andamento").length;
  // EPIC-020 Lote 2: volume pelo VGV (Valores da Operação); valorTotal antigo
  // só entra como referência legada quando a obra ainda não tem VGV.
  const totalValue = obras.reduce((s, o) => s + (o.vgv ?? 0), 0);
  const semVgv = obras.filter((o) => o.vgv == null).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Obras e Reformas</h1>
          <p className="text-gray-400 text-sm mt-0.5">{obras.length} projetos cadastrados</p>
        </div>
        <Link href="/admin/leads" className="text-sm font-bold text-[var(--brand-dark)]">Abrir CRM</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Em Andamento", value: emAndamento, sub: "obras ativas" },
          { label: "Concluídas", value: obras.filter((o) => o.status === "concluida").length, sub: "no histórico" },
          { label: "VGV Total", value: formatCurrency(totalValue), sub: semVgv ? `${semVgv} sem VGV informado` : "todas com VGV" },
          { label: "Sem VGV", value: semVgv, sub: "preencher em Valores da Operação" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
              <HardHat size={15} className="text-[var(--brand-yellow)]" />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl leading-none">{value}</p>
            <p className="text-gray-400 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros (item 01) */}
      <div className="bg-white border border-gray-100 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase">Nome da obra
            <span className="relative block mt-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={filtros.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Buscar obra" className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white pl-9 font-normal normal-case" /></span>
          </label>
          <label className="text-xs font-bold text-gray-500 uppercase">Cliente
            <input value={filtros.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nome do cliente" className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white mt-1 font-normal normal-case" />
          </label>
          <label className="text-xs font-bold text-gray-500 uppercase">Código
            <input value={filtros.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="OB-…" className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white mt-1 font-normal normal-case" />
          </label>
          <label className="text-xs font-bold text-gray-500 uppercase">Responsável
            <input value={filtros.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Engenheiro ou empreiteiro" className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white mt-1 font-normal normal-case" />
          </label>
        </div>
        {/* Datas com espaço próprio: cada intervalo ocupa a sua coluna, com "De" e "Até"
            lado a lado e encolhendo junto (pedido A3, 13/10/2026). */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="min-w-0 text-xs font-bold text-gray-500 uppercase">Situação
            <select value={filtros.status} onChange={(e) => set("status", e.target.value)} className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white mt-1 font-normal normal-case">
              <option value="">Todas</option>
              {(Object.entries(OBRA_STATUS_CONFIG) as [ObraStatus, typeof OBRA_STATUS_CONFIG[ObraStatus]][])
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([status, cfg]) => <option key={status} value={status}>{cfg.label} ({obras.filter((o) => o.status === status).length})</option>)}
            </select>
          </label>
          <IntervaloDatas titulo="Período de execução" de={filtros.periodoDe} ate={filtros.periodoAte} onDe={(v) => set("periodoDe", v)} onAte={(v) => set("periodoAte", v)} />
          <IntervaloDatas titulo="Data de criação" de={filtros.criadoDe} ate={filtros.criadoAte} onDe={(v) => set("criadoDe", v)} onAte={(v) => set("criadoAte", v)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">Ordenar
            <select value={filtros.ordem} onChange={(e) => set("ordem", e.target.value as OrdemObras)} className="px-3 py-2 border border-gray-200 text-sm bg-white font-normal normal-case">
              <option value="recentes">Mais recentes</option><option value="antigas">Mais antigas</option><option value="az">Nome A–Z</option><option value="za">Nome Z–A</option>
            </select>
          </label>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{filtered.length} de {obras.length} obra(s){ativos ? ` · ${ativos} filtro(s) ativo(s)` : ""}</span>
            <button type="button" onClick={() => setFiltros(FILTROS_OBRAS_VAZIOS)} disabled={!ativos && filtros.ordem === "recentes"}
              className="px-3 py-2 border border-gray-200 font-bold uppercase hover:bg-gray-50 disabled:opacity-40">Limpar filtros</button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((o) => {
          const statusKey = o.status as ObraStatus;
          const cfg = OBRA_STATUS_CONFIG[statusKey] ?? { label: o.status, bgColor: "bg-gray-100", color: "text-gray-600" };
          const tipo = tipoProjetoObra(o);
          const etapasFeitas = o.etapas.filter((e) => e.status === "concluida").length;
          return (
            <div key={o.id} className="bg-white border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg" title={tipo.label}>{tipo.icon}</span>
                    <h3 className="font-bold text-[var(--brand-dark)]">{o.nome}</h3>
                    <span className="text-[10px] font-mono text-gray-400">{o.codigo}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <p className="text-gray-400 text-sm">{o.clienteNome} · {o.endereco}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Resp.: {o.engenheiroResp} · {o.area} m²</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-[var(--brand-dark)] text-lg">{o.vgv == null ? "VGV não informado" : formatCurrency(o.vgv)}</p>
                  {o.vgv == null && o.valorTotal != null && <p className="text-xs text-gray-400">Valor total (legado): {formatCurrency(o.valorTotal)}</p>}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Progresso geral</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 overflow-hidden">
                      <div className={`h-full ${o.progresso >= 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`} style={{ width: `${Math.min(100, o.progresso)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[var(--brand-dark)]">{formatarPercentual(o.progresso)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Etapas</p>
                  <p className="text-sm font-bold text-[var(--brand-dark)]">{etapasFeitas}/{o.etapas.length} concluídas</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Diário</p>
                  <p className="text-sm font-bold text-[var(--brand-dark)]">—</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <Link href={`/admin/obras/${o.id}`} className="text-xs bg-[var(--brand-dark)] hover:bg-[var(--brand-dark-secondary)] text-[var(--brand-yellow)] font-bold uppercase tracking-wider px-4 py-2 transition-colors">
                  Abrir Obra
                </Link>
                <Link href={`/admin/obras/${o.id}/editar`} className="text-xs border border-gray-200 hover:border-blue-300 hover:text-blue-500 text-gray-500 font-bold px-3 py-2 transition-colors flex items-center gap-1">
                  <Pencil size={12} /> Editar
                </Link>
                <AcoesExcluirCancelar id={o.id} rotulo={o.nome} cancelado={o.status === "cancelada"} cancelar={cancelarObra} excluir={excluirObra} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntervaloDatas({ titulo, de, ate, onDe, onAte }: { titulo: string; de: string; ate: string; onDe: (v: string) => void; onAte: (v: string) => void }) {
  const campo = "mt-1 w-full min-w-0 px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white font-normal";
  return (
    <fieldset className="min-w-0 text-xs font-bold text-gray-500 uppercase">
      <legend>{titulo}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0 text-[11px] font-normal normal-case text-gray-400">De<input type="date" aria-label={`${titulo}: de`} value={de} onChange={(e) => onDe(e.target.value)} className={campo} /></label>
        <label className="min-w-0 text-[11px] font-normal normal-case text-gray-400">Até<input type="date" aria-label={`${titulo}: até`} value={ate} onChange={(e) => onAte(e.target.value)} className={campo} /></label>
      </div>
    </fieldset>
  );
}
