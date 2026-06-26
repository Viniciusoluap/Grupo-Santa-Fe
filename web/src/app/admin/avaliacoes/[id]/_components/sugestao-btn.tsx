"use client";

import { useState } from "react";
import { Sparkles, X, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  avaliacaoId: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipo: string;
  areaConstruida: number | null;
  areaTerreno: number | null;
  quartos: number | null;
  banheiros: number | null;
  caracteristicas?: string;
}

interface Comparavel {
  descricao: string;
  preco: number;
  area: number;
  precoPorM2: number;
}

interface SugestaoResult {
  valorSugerido: number;
  valorMin: number;
  valorMax: number;
  precoPorM2: number;
  estadoGeral: string;
  comparaveis: Comparavel[];
  fontes: string[];
  metodologia: string;
  confiabilidade: "alta" | "media" | "baixa";
  observacoes: string;
}

const CONFIABILIDADE_CONFIG = {
  alta:  { label: "Alta", color: "text-green-600", bg: "bg-green-50",  icon: CheckCircle2 },
  media: { label: "Média", color: "text-yellow-600", bg: "bg-yellow-50", icon: AlertCircle },
  baixa: { label: "Baixa", color: "text-red-500", bg: "bg-red-50", icon: AlertCircle },
};

export function SugestaoAvaliacaoBtn({ avaliacaoId, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SugestaoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buscarSugestao() {
    setLoading(true);
    setError(null);
    setResult(null);
    setOpen(true);
    try {
      const res = await fetch("/api/avaliacoes/sugestao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...props, caracteristicas: props.caracteristicas ?? "" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Erro desconhecido");
      setResult(data as SugestaoResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar sugestão");
    } finally {
      setLoading(false);
    }
  }

  async function aplicarValor() {
    if (!result) return;
    const form = document.getElementById(`form-valor-${avaliacaoId}`) as HTMLFormElement | null;
    if (form) {
      const input = form.querySelector<HTMLInputElement>('input[name="valorEstimado"]');
      if (input) {
        input.value = String(result.valorSugerido);
        form.requestSubmit();
      }
    }
    setOpen(false);
  }

  const cfg = result ? CONFIABILIDADE_CONFIG[result.confiabilidade] : null;
  const CfgIcon = cfg?.icon;

  return (
    <>
      <button
        type="button"
        onClick={buscarSugestao}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-2 border border-[var(--brand-yellow)] text-[var(--brand-dark)] hover:bg-[var(--brand-yellow)] transition-colors"
      >
        <Sparkles size={13} /> Sugestão de Avaliação
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !loading && setOpen(false)}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[var(--brand-dark)]">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[var(--brand-yellow)]" />
                <p className="font-black text-white text-sm uppercase tracking-wide">Sugestão de Avaliação</p>
              </div>
              {!loading && <button onClick={() => setOpen(false)}><X size={16} className="text-gray-400 hover:text-white" /></button>}
            </div>

            <div className="p-5 space-y-4">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={32} className="text-[var(--brand-yellow)] animate-spin" />
                  <p className="text-sm font-bold text-[var(--brand-dark)] uppercase tracking-wide">Pesquisando imóveis similares...</p>
                  <p className="text-xs text-gray-400 text-center">Buscando comparáveis em {props.cidade}/{props.estado} e calculando R$/m²</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 p-4 text-center space-y-2">
                  <AlertCircle size={20} className="text-red-400 mx-auto" />
                  <p className="text-sm font-bold text-red-600">Não foi possível obter a sugestão</p>
                  <p className="text-xs text-red-400">{error}</p>
                  {error.includes("ANTHROPIC_API_KEY") && (
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2">
                      Adicione <strong>ANTHROPIC_API_KEY</strong> nas variáveis de ambiente do Vercel para ativar esta funcionalidade.
                    </p>
                  )}
                </div>
              )}

              {result && cfg && CfgIcon && (
                <>
                  {/* Valor sugerido */}
                  <div className="bg-[var(--brand-dark)] p-4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Valor Estimado de Mercado</p>
                    <p className="font-black text-3xl text-[var(--brand-yellow)]">{formatCurrency(result.valorSugerido)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Faixa: {formatCurrency(result.valorMin)} – {formatCurrency(result.valorMax)}
                    </p>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 text-center">
                      <TrendingUp size={14} className="text-[var(--brand-yellow)] mx-auto mb-1" />
                      <p className="font-black text-[var(--brand-dark)]">{formatCurrency(result.precoPorM2)}</p>
                      <p className="text-[10px] text-gray-400 uppercase">por m²</p>
                    </div>
                    <div className={`p-3 text-center ${cfg.bg}`}>
                      <CfgIcon size={14} className={`${cfg.color} mx-auto mb-1`} />
                      <p className={`font-black ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-[10px] text-gray-400 uppercase">Confiabilidade</p>
                    </div>
                  </div>

                  {/* Metodologia */}
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metodologia</p>
                    <p className="text-xs text-gray-600">{result.metodologia}</p>
                  </div>

                  {/* Comparáveis */}
                  {result.comparaveis.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                        Imóveis Comparáveis ({result.comparaveis.length})
                      </p>
                      <div className="space-y-2">
                        {result.comparaveis.map((c, i) => (
                          <div key={i} className="bg-gray-50 p-2.5 text-xs">
                            <p className="font-medium text-[var(--brand-dark)]">{c.descricao}</p>
                            <div className="flex gap-3 mt-1 text-gray-400">
                              <span>{c.area} m²</span>
                              <span className="font-bold text-[var(--brand-dark)]">{formatCurrency(c.preco)}</span>
                              <span>{formatCurrency(c.precoPorM2)}/m²</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observações */}
                  {result.observacoes && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3">
                      <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1">Observações</p>
                      <p className="text-xs text-yellow-800">{result.observacoes}</p>
                    </div>
                  )}

                  {/* Fontes */}
                  {result.fontes.length > 0 && (
                    <p className="text-[10px] text-gray-400">
                      Fontes: {result.fontes.join(" · ")}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={aplicarValor}
                      className="flex-1 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-black text-xs uppercase tracking-wider py-3 transition-colors"
                    >
                      Aplicar {formatCurrency(result.valorSugerido)}
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      className="px-4 border border-gray-200 text-xs font-bold text-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
