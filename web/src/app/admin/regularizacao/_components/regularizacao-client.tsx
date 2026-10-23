"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, FileCheck, Pencil } from "lucide-react";
import { REG_STATUS_CONFIG, REG_TIPO_CONFIG, RegStatus } from "@/lib/types/regularizacao";
import { formatCurrency } from "@/lib/utils";
import { excluirRegularizacao } from "@/lib/actions/regularizacoes";
import { AcoesExcluir } from "@/components/admin/acoes-excluir";
import { alterarStatusRegularizacao } from "@/lib/actions/regularizacao";
import { STATUS_PROCESSO, ehStatusProcesso } from "@/lib/financeiro/regularizacao";

function parseTiposLabelReg(tipo: string | null): string {
  try {
    const arr = JSON.parse(tipo ?? "[]");
    if (Array.isArray(arr)) {
      return arr.map((t: string) => REG_TIPO_CONFIG[t as keyof typeof REG_TIPO_CONFIG]?.label ?? t).join(", ");
    }
  } catch {}
  return REG_TIPO_CONFIG[tipo as keyof typeof REG_TIPO_CONFIG]?.label ?? tipo ?? "Pendente de configuração";
}

function parseTipoIconReg(tipo: string | null): string {
  try {
    const arr = JSON.parse(tipo ?? "[]");
    if (Array.isArray(arr) && arr.length > 0) {
      return REG_TIPO_CONFIG[arr[0] as keyof typeof REG_TIPO_CONFIG]?.icon ?? "📋";
    }
  } catch {}
  return REG_TIPO_CONFIG[tipo as keyof typeof REG_TIPO_CONFIG]?.icon ?? "📋";
}

interface Regularizacao {
  id: string;
  nome: string;
  tipo: string | null;
  status: string;
  clienteNome: string;
  clienteTel: string;
  endereco: string | null;
  matricula: string | null;
  responsavel: string | null;
  valorServico: number | null;
  previsaoFim: Date | null;
}

interface Props {
  regularizacoes: Regularizacao[];
  indicadores: { contratado: number; recebido: number };
}

function StatusSelectReg({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => startTransition(async () => { await alterarStatusRegularizacao(id, e.target.value); })}
      className="text-[10px] font-bold uppercase border border-gray-200 bg-white px-2 py-1 focus:outline-none focus:border-[var(--brand-yellow)] disabled:opacity-60 cursor-pointer"
    >
      {/* Lote 6: só as 3 situações; a atual aparece mesmo se for da fila do CRM. */}
      {[...(ehStatusProcesso(status) ? [] : [status]), ...STATUS_PROCESSO].map((s) =>
        <option key={s} value={s} disabled={!ehStatusProcesso(s)}>{REG_STATUS_CONFIG[s as RegStatus]?.label ?? s}</option>)}
    </select>
  );
}

export function RegularizacaoClient({ regularizacoes, indicadores }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RegStatus | "todos">("todos");

  const filtered = regularizacoes.filter((r) => {
    const matchSearch = !search ||
      r.nome.toLowerCase().includes(search.toLowerCase()) ||
      r.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      r.endereco?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const ativos = regularizacoes.filter((r) => r.status !== "concluido" && r.status !== "cancelado").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Regularização Imobiliária</h1>
          <p className="text-gray-600 text-sm mt-0.5">{regularizacoes.length} processos cadastrados</p>
        </div>
        <Link href="/admin/leads" className="text-sm font-bold text-[var(--brand-dark)]">Abrir CRM</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Em Andamento", value: ativos },
          { label: "Valor já recebido", value: formatCurrency(indicadores.recebido / 100) },
          { label: "Valor contratado", value: formatCurrency(indicadores.contratado / 100) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</span>
              <FileCheck size={15} className="text-[var(--brand-yellow)]" />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            placeholder="Buscar por nome, cliente ou endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setStatusFilter("todos")} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
            Todos
          </button>
          {(Object.entries(REG_STATUS_CONFIG) as [RegStatus, typeof REG_STATUS_CONFIG[RegStatus]][])
            .sort(([, a], [, b]) => a.order - b.order)
            .map(([status, cfg]) => {
              const count = regularizacoes.filter((r) => r.status === status).length;
              if (count === 0) return null;
              return (
                <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${statusFilter === status ? `${cfg.bgColor} ${cfg.color} border border-transparent` : "border border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                  {cfg.label} ({count})
                </button>
              );
            })}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((r) => {
          const tipo = { icon: parseTipoIconReg(r.tipo), label: parseTiposLabelReg(r.tipo) };
          return (
            <div key={r.id} className="bg-white border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl shrink-0 mt-0.5">{tipo.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-[var(--brand-dark)]">{r.nome}</h3>
                      <StatusSelectReg id={r.id} status={r.status} />
                    </div>
                    <p className="text-gray-500 text-sm">{r.clienteNome}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{r.endereco}</p>
                    {r.matricula && <p className="text-gray-600 text-xs">{r.matricula}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[var(--brand-dark)]">{formatCurrency(r.valorServico)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  {r.responsavel && <span>Resp.: {r.responsavel}</span>}
                  {r.previsaoFim && <span>Previsão: {new Date(r.previsaoFim).toLocaleDateString("pt-BR")}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/regularizacao/${r.id}`} className="text-xs bg-[var(--brand-dark)] hover:bg-[var(--brand-dark-secondary)] text-[var(--brand-yellow)] font-bold uppercase tracking-wider px-4 py-1.5 transition-colors">
                    Ver Processo
                  </Link>
                  <Link href={`/admin/regularizacao/${r.id}/editar`} className="text-xs border border-gray-200 hover:border-blue-300 hover:text-blue-500 text-gray-500 font-bold px-3 py-1.5 transition-colors flex items-center gap-1">
                    <Pencil size={12} /> Editar
                  </Link>
                  <AcoesExcluir id={r.id} rotulo={r.nome} excluir={excluirRegularizacao} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
