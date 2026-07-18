"use client";

import { useState } from "react";
import { TrendingUp, Sparkles, Loader2, Save } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { salvarMercado } from "@/lib/actions/incorporacao";
import { PrecificacaoComparaveis } from "./precificacao-comparaveis";
import { PesquisaPrimaria } from "./pesquisa-primaria";
import type { EstudoData } from "./incorporacao-detail";

interface Cidade {
  populacao: number; crescimentoAnualPct: number; pibPerCapita: number;
  principaisAtividades: string[]; rendaMediaMensal: number;
  deficitHabitacional: string; resumo: string;
}
interface Mercado {
  precoM2Lote: number; precoM2Casa: number; precoM2Apartamento: number;
  velocidadeVendas: string;
  demandaPorProduto: { produto: string; demanda: string; publico: string }[];
  concorrentes: { nome: string; produto: string; faixaPreco: string }[];
  comparaveis: { descricao: string; preco: number; area: number; precoPorM2: number }[];
  oportunidades: string; riscos: string;
}

export function MercadoTab({ estudo }: { estudo: EstudoData }) {
  const [cidade, setCidade] = useState<Cidade | null>(
    estudo.pesquisaCidadeJson ? JSON.parse(estudo.pesquisaCidadeJson) : null
  );
  const [mercado, setMercado] = useState<Mercado | null>(
    estudo.estudoMercadoJson ? JSON.parse(estudo.estudoMercadoJson) : null
  );
  const [meta, setMeta] = useState<{ fontes?: string[]; confiabilidade?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pesquisar() {
    setBusy(true);
    setErro(null);
    try {
      const res = await fetch("/api/incorporacao/mercado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipio: estudo.municipio, estado: estudo.estado }),
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Falha na pesquisa."); return; }
      setCidade(json.cidade);
      setMercado(json.mercado);
      setMeta({ fontes: json.fontes, confiabilidade: json.confiabilidade });
      await salvarMercado(estudo.id, { pesquisaCidade: json.cidade, estudoMercado: json.mercado });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <button onClick={pesquisar} disabled={busy}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy ? "Pesquisando (até 1 min)..." : cidade ? "Refazer pesquisa (IA)" : "Pesquisar cidade + mercado (IA)"}
        </button>
        <span className="text-xs text-gray-400">
          IBGE, prefeitura e portais imobiliários de {estudo.municipio}/{estudo.estado}
        </span>
        {cidade && <Save size={13} className="text-green-500" />}
      </div>
      {erro && <p className="text-xs text-red-500">{erro}</p>}

      <PrecificacaoComparaveis estudo={estudo} />

      <PesquisaPrimaria estudo={estudo} />

      {meta?.confiabilidade && (
        <p className="text-[11px] text-gray-400">Confiabilidade: <b>{meta.confiabilidade}</b>{meta.fontes?.filter(Boolean).length ? ` · Fontes: ${meta.fontes.filter(Boolean).join("; ")}` : ""}</p>
      )}

      {cidade && (
        <div className="bg-white border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={13} /> Pesquisa da cidade
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Dado label="População" valor={cidade.populacao ? cidade.populacao.toLocaleString("pt-BR") : "—"} />
            <Dado label="Crescimento anual" valor={cidade.crescimentoAnualPct ? `${cidade.crescimentoAnualPct}%` : "—"} />
            <Dado label="PIB per capita" valor={cidade.pibPerCapita ? formatCurrency(cidade.pibPerCapita) : "—"} />
            <Dado label="Renda média" valor={cidade.rendaMediaMensal ? formatCurrency(cidade.rendaMediaMensal) : "—"} />
          </div>
          {cidade.principaisAtividades?.length > 0 && (
            <p className="text-xs text-gray-500">Atividades: {cidade.principaisAtividades.join(", ")}</p>
          )}
          {cidade.deficitHabitacional && <p className="text-xs text-gray-500">Déficit habitacional: {cidade.deficitHabitacional}</p>}
          {cidade.resumo && <p className="text-sm text-[var(--brand-dark)] leading-relaxed">{cidade.resumo}</p>}
        </div>
      )}

      {mercado && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="m² Lote" value={mercado.precoM2Lote ? formatCurrency(mercado.precoM2Lote) : "—"} />
            <KPI label="m² Casa" value={mercado.precoM2Casa ? formatCurrency(mercado.precoM2Casa) : "—"} />
            <KPI label="m² Apartamento" value={mercado.precoM2Apartamento ? formatCurrency(mercado.precoM2Apartamento) : "—"} />
          </div>

          {mercado.demandaPorProduto?.length > 0 && (
            <div className="bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Demanda por produto</p>
              <div className="space-y-2">
                {mercado.demandaPorProduto.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${
                      d.demanda === "alta" ? "bg-green-50 text-green-700" :
                      d.demanda === "media" ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-500"
                    }`}>{d.demanda}</span>
                    <span className="font-bold text-[var(--brand-dark)]">{d.produto}</span>
                    <span className="text-gray-400 text-xs">{d.publico}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mercado.concorrentes?.length > 0 && (
              <div className="bg-white border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Concorrentes</p>
                <div className="space-y-2 text-sm">
                  {mercado.concorrentes.map((c, i) => (
                    <div key={i}>
                      <p className="font-bold text-[var(--brand-dark)]">{c.nome}</p>
                      <p className="text-xs text-gray-400">{c.produto} · {c.faixaPreco}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mercado.comparaveis?.length > 0 && (
              <div className="bg-white border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Comparáveis</p>
                <div className="space-y-2 text-sm">
                  {mercado.comparaveis.map((c, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-gray-600 text-xs">{c.descricao}</span>
                      <span className="font-bold text-[var(--brand-dark)] text-xs shrink-0">
                        {formatCurrency(c.preco)} · {c.area}m² · {formatCurrency(c.precoPorM2)}/m²
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(mercado.oportunidades || mercado.riscos) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mercado.oportunidades && (
                <div className="bg-green-50 border border-green-100 p-4">
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Oportunidades</p>
                  <p className="text-sm text-green-900">{mercado.oportunidades}</p>
                </div>
              )}
              {mercado.riscos && (
                <div className="bg-red-50 border border-red-100 p-4">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Riscos</p>
                  <p className="text-sm text-red-900">{mercado.riscos}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!cidade && !busy && (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <TrendingUp size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Pesquisa ainda não realizada</p>
          <p className="text-gray-400 text-sm mt-1">A IA busca dados reais da cidade e do mercado imobiliário local.</p>
        </div>
      )}
    </div>
  );
}

function Dado({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="font-black text-[var(--brand-dark)]">{valor}</p>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{value}</p>
    </div>
  );
}
