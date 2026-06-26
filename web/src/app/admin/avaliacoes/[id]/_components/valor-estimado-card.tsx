"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { atualizarStatusAvaliacao } from "@/lib/actions/avaliacoes";

interface Props {
  avaliacaoId: string;
  valorEstimado: number;
  status: string;
  dataEntrega: Date | null;
}

function toDisplayBR(v: number): string {
  if (!v) return "";
  const [int, dec] = v.toFixed(2).split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}

function parseDisplayBR(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

export function ValorEstimadoCard({ avaliacaoId, valorEstimado, status, dataEntrega }: Props) {
  const [editing, setEditing] = useState(false);
  const [display, setDisplay] = useState(() => toDisplayBR(valorEstimado));
  const [raw, setRaw] = useState(valorEstimado);

  function handleEdit() {
    setDisplay(toDisplayBR(valorEstimado));
    setRaw(valorEstimado);
    setEditing((v) => !v);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <p className="font-black text-[var(--brand-dark)] text-3xl">{formatCurrency(valorEstimado)}</p>
        <button
          type="button"
          onClick={handleEdit}
          title={editing ? "Cancelar edição" : "Editar valor"}
          className="text-gray-300 hover:text-[var(--brand-dark)] transition-colors"
        >
          {editing ? <X size={16} /> : <Pencil size={15} />}
        </button>
      </div>

      {editing && (
        <form id={`form-valor-${avaliacaoId}`} action={atualizarStatusAvaliacao} className="flex gap-3 items-end mt-3">
          <input type="hidden" name="id" value={avaliacaoId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="valorEstimado" value={raw || ""} />
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Novo valor (R$)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={display}
              onChange={(e) => {
                setDisplay(e.target.value);
                setRaw(parseDisplayBR(e.target.value));
              }}
              placeholder="300.000,00"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
            />
          </div>
          <button
            type="submit"
            className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-4 py-2 transition-colors hover:bg-black"
          >
            Salvar
          </button>
        </form>
      )}

      {dataEntrega && !editing && (
        <p className="text-xs text-green-600 mt-2">
          Entregue em {new Date(dataEntrega).toLocaleDateString("pt-BR")}
        </p>
      )}
    </>
  );
}
