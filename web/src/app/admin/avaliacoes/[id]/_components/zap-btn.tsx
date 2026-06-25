"use client";

import { useState } from "react";
import { Home, X, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  avaliacaoId: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipo: string;
  areaConstruida: number | null;
}

interface ZapComparavel {
  descricao: string;
  preco: number;
  area: number;
  precoPorM2: number;
}

interface ZapResult {
  comparaveis: ZapComparavel[];
  valorMedio: number;
  precoPorM2Medio: number;
  totalEncontrados: number;
  bairroConsultado: string;
  url: string;
}

export function ZapComparaveisBtn({ avaliacaoId, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ZapResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buscarComparaveis() {
    setLoading(true);
    setError(null);
    setResult(null);
    setOpen(true);
    try {
      const res = await fetch("/api/avaliacoes/comparaveis-zap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...props }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Erro desconhecido");
      setResult(data as ZapResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar comparáveis");
    } finally {
      setLoading(false);
    }
  }

  function aplicarValor() {
    if (!result) return;
    const valor = props.areaConstruida
      ? Math.round(result.precoPorM2Medio * props.areaConstruida)
      : result.valorMedio;
    const form = document.getElementById(`form-valor-${avaliacaoId}`) as HTMLFormElement | null;
    if (form) {
      const input = form.querySelector<HTMLInputElement>('input[name="valorEstimado"]');
      if (input) {
        input.value = String(valor);
        form.requestSubmit();
      }
    }
    setOpen(false);
  }

  const valorSugerido = result
    ? props.areaConstruida
      ? Math.round(result.precoPorM2Medio * props.areaConstruida)
      : result.valorMedio
    : 0;

  return (
    <>
      <button
        type="button"
        onClick={buscarComparaveis}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-2 border border-blue-300 text-[var(--brand-dark)] hover:bg-blue-50 transition-colors"
      >
        <Home size={13} /> Comparáveis ZAP
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[var(--brand-dark)]">
              <div className="flex items-center gap-2">
                <Home size={15} className="text-blue-400" />
                <p className="font-black text-white text-sm uppercase tracking-wide">
                  Comparáveis ZAP Imóveis
                </p>
              </div>
              {!loading && (
                <button onClick={() => setOpen(false)}>
                  <X size={16} className="text-gray-400 hover:text-white" />
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={32} className="text-blue-400 animate-spin" />
                  <p className="text-sm font-bold text-[var(--brand-dark)] uppercase tracking-wide">
                    Buscando no ZAP Imóveis...
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    Pesquisando em {props.bairro}, {props.cidade}
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 p-4 text-center space-y-2">
                  <AlertCircle size={20} className="text-red-400 mx-auto" />
                  <p className="text-sm font-bold text-red-600">Não foi possível buscar os dados</p>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {result && (
                <>
                  <div className="bg-[var(--brand-dark)] p-4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                      {props.areaConstruida
                        ? `${formatCurrency(result.precoPorM2Medio)}/m² × ${props.areaConstruida} m²`
                        : "Valor Médio dos Comparáveis"}
                    </p>
                    <p className="font-black text-3xl text-blue-400">
                      {formatCurrency(valorSugerido)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {result.totalEncontrados} imóveis encontrados · {result.bairroConsultado}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 text-center">
                      <p className="font-black text-[var(--brand-dark)]">
                        {formatCurrency(result.precoPorM2Medio)}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase">R$/m² médio</p>
                    </div>
                    <div className="bg-gray-50 p-3 text-center">
                      <p className="font-black text-[var(--brand-dark)]">{result.comparaveis.length}</p>
                      <p className="text-[10px] text-gray-400 uppercase">Comparáveis</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                      Imóveis Encontrados
                    </p>
                    <div className="space-y-2">
                      {result.comparaveis.map((c, i) => (
                        <div key={i} className="bg-gray-50 p-2.5 text-xs">
                          <p className="font-medium text-[var(--brand-dark)]">{c.descricao}</p>
                          <div className="flex gap-3 mt-1 text-gray-400">
                            <span>{c.area} m²</span>
                            <span className="font-bold text-[var(--brand-dark)]">
                              {formatCurrency(c.preco)}
                            </span>
                            <span>{formatCurrency(c.precoPorM2)}/m²</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700"
                  >
                    <ExternalLink size={10} /> Ver busca completa no ZAP
                  </a>

                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={aplicarValor}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider py-3 transition-colors"
                    >
                      Aplicar {formatCurrency(valorSugerido)}
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
