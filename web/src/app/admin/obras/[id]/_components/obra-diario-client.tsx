"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { criarDiarioObra } from "@/lib/actions/obras";
import { WEATHER_CONFIG } from "@/lib/types/obra";

interface DiarioEntry {
  id: string;
  data: Date | string;
  descricao: string;
  responsavel: string;
  clima: string | null;
  fotos: string;
}

interface Props {
  obraId: string;
  diario: DiarioEntry[];
  weatherConfig: Record<string, { label: string; icon: string }>;
}

function toDatetimeLocal(d?: Date | string) {
  if (!d) return "";
  const dt = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function ObraDiarioClient({ obraId, diario, weatherConfig }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await criarDiarioObra(obraId, formData);
      setShowModal(false);
    });
  }

  const now = toDatetimeLocal(new Date());

  return (
    <div className="bg-white border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
        <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">
          Diário de Obra ({diario.length > 0 ? `${diario.length} registros recentes` : "sem registros"})
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-xs bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold uppercase tracking-wide px-3 py-1.5 transition-colors"
        >
          <Plus size={11} /> Novo Registro
        </button>
      </div>

      {diario.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">Nenhum registro no diário ainda.</p>
      ) : (
        <div className="space-y-4">
          {diario.map((entry) => {
            const weather = entry.clima
              ? (WEATHER_CONFIG[entry.clima as keyof typeof WEATHER_CONFIG] ?? weatherConfig[entry.clima] ?? { label: entry.clima, icon: "🌤️" })
              : null;
            let fotos: string[] = [];
            try { fotos = JSON.parse(entry.fotos) as string[]; } catch { /* ignore */ }
            return (
              <div key={entry.id} className="border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--brand-dark)] text-sm">
                        {new Date(entry.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">por {entry.responsavel}</p>
                  </div>
                  {weather && (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <span className="text-xl">{weather.icon}</span>
                        <p className="text-[9px] text-gray-400">{weather.label}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">Descrição</p>
                    <p className="text-sm text-gray-700">{entry.descricao}</p>
                  </div>
                  {fotos.length > 0 && (
                    <p className="text-xs text-gray-400">{fotos.length} foto(s) anexada(s)</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[var(--brand-dark)] text-lg uppercase tracking-wide">
                Novo Registro de Diário
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Data e Hora *
                </label>
                <input
                  type="datetime-local"
                  name="data"
                  required
                  defaultValue={now}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Responsável *
                </label>
                <input
                  type="text"
                  name="responsavel"
                  required
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Clima
                </label>
                <select
                  name="clima"
                  defaultValue=""
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
                >
                  <option value="">Não informado</option>
                  <option value="sol">Ensolarado</option>
                  <option value="parcialmente_nublado">Parcialmente nublado</option>
                  <option value="nublado">Nublado</option>
                  <option value="chuva">Chuvoso</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Descrição *
                </label>
                <textarea
                  name="descricao"
                  required
                  rows={4}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPending ? "Salvando..." : "Salvar Registro"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
