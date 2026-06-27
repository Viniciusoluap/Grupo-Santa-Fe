"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, FileDown, ClipboardList } from "lucide-react";
import { ExcluirAvaliacaoBtn } from "./excluir-avaliacao-btn";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  solicitada:   { label: "Solicitada",     bg: "bg-gray-100",   text: "text-gray-600" },
  vistoria:     { label: "Vistoria",       bg: "bg-blue-100",   text: "text-blue-700" },
  elaboracao:   { label: "Em Elaboração",  bg: "bg-yellow-100", text: "text-yellow-700" },
  revisao:      { label: "Revisão",        bg: "bg-orange-100", text: "text-orange-700" },
  entregue:     { label: "Entregue",       bg: "bg-green-100",  text: "text-green-700" },
  cancelada:    { label: "Cancelada",      bg: "bg-red-100",    text: "text-red-600" },
};

const TIPO_LABELS: Record<string, string> = {
  mercado:        "Avaliação de Mercado",
  locacao:        "Avaliação p/ Locação",
  judicial:       "Avaliação Judicial",
  parecer_tecnico: "Parecer Técnico",
};

export interface AvaliacaoRow {
  id: string;
  numero: string;
  clienteNome: string;
  endereco: string;
  bairro: string;
  tipo: string;
  avaliador: string | null;
  valorEstimado: number | null;
  status: string;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function AvaliacoesClient({ avaliacoes }: { avaliacoes: AvaliacaoRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(avaliacoes.map((a) => a.id)) : new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev: Set<string>) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleBaixarLaudos() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    window.open(`/admin/avaliacoes/batch-laudos?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  const allChecked = avaliacoes.length > 0 && selected.size === avaliacoes.length;
  const someChecked = selected.size > 0 && !allChecked;

  if (avaliacoes.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
        <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Nenhuma avaliação cadastrada</p>
        <p className="text-gray-400 text-sm mt-1">
          <Link href="/admin/avaliacoes/nova" className="text-[var(--brand-yellow)] hover:underline">
            Solicitar primeira avaliação
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Batch action bar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {selected.size > 0
            ? `${selected.size} avaliação${selected.size > 1 ? "ões" : ""} selecionada${selected.size > 1 ? "s" : ""}`
            : "Selecione avaliações para baixar laudos em lote"}
        </p>
        <button
          type="button"
          onClick={handleBaixarLaudos}
          disabled={selected.size === 0}
          className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileDown size={14} />
          Baixar Laudos {selected.size > 0 ? `(${selected.size})` : ""}
        </button>
      </div>

      <div className="bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-dark)]">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[var(--brand-yellow)] cursor-pointer"
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Número</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Cliente / Endereço</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase hidden md:table-cell">Tipo</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase hidden lg:table-cell">Avaliador</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase hidden lg:table-cell">Valor Estimado</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {avaliacoes.map((a) => {
                const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.solicitada;
                const isSelected = selected.has(a.id);
                return (
                  <tr
                    key={a.id}
                    className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-yellow-50/40" : ""}`}
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(a.id)}
                        className="w-3.5 h-3.5 accent-[var(--brand-yellow)] cursor-pointer"
                        aria-label={`Selecionar ${a.clienteNome}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.numero}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/avaliacoes/${a.id}`}
                        className="font-medium text-[var(--brand-dark)] hover:text-[var(--brand-yellow)] hover:underline"
                      >
                        {a.clienteNome}
                      </Link>
                      <p className="text-xs text-gray-400">{a.endereco}, {a.bairro}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">
                      {TIPO_LABELS[a.tipo] ?? a.tipo}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-600">{a.avaliador}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-right font-bold text-[var(--brand-dark)]">
                      {a.valorEstimado ? formatCurrency(a.valorEstimado) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <Link
                        href={`/admin/avaliacoes/${a.id}/editar`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-yellow)] hover:underline"
                      >
                        <Pencil size={12} />Editar
                      </Link>
                      <ExcluirAvaliacaoBtn id={a.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
