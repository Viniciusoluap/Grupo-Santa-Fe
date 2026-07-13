"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Grid3x3, Loader2, Save, Send, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { gerarCenariosMassa, type CenarioMassa, type ParametrosMassa } from "@/lib/geo/massa";
import { salvarMassa } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";
import type { Feature, Polygon } from "geojson";

const MapaMassa = dynamic(() => import("./mapa-massa").then((m) => m.MapaMassa), {
  ssr: false,
  loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: 420 }} />,
});

export function MassaTab({ estudo }: { estudo: EstudoData }) {
  // Defaults herdados do urbanístico e do mercado, quando existirem.
  const urb = estudo.parametrosJson ? JSON.parse(estudo.parametrosJson) : null;
  const mercado = estudo.estudoMercadoJson ? JSON.parse(estudo.estudoMercadoJson) : null;

  const [params, setParams] = useState<ParametrosMassa>(() => {
    const salvo = estudo.massaCenariosJson ? JSON.parse(estudo.massaCenariosJson) : null;
    return (
      salvo?.params ?? {
        larguraViaM: 12,
        testadaLoteM: urb?.testadaMinimaM ?? 10,
        profundidadeLoteM: 25,
        loteMinimoM2: urb?.loteMinimoM2 ?? 250,
        comprimentoMaxQuadraM: 120,
        percentInstitucional: urb?.percentInstitucional ?? 0.05,
        percentAreaVerde: urb?.percentAreaVerde ?? 0.1,
        precoM2Lote: mercado?.precoM2Lote || 500,
      }
    );
  });
  const [cenarios, setCenarios] = useState<CenarioMassa[]>(() => {
    const salvo = estudo.massaCenariosJson ? JSON.parse(estudo.massaCenariosJson) : null;
    return salvo?.cenarios ?? [];
  });
  const [selecionado, setSelecionado] = useState<string | null>(estudo.cenarioEscolhidoId);
  const [busy, setBusy] = useState(false);
  const [gerando, setGerando] = useState(false);

  function upd<K extends keyof ParametrosMassa>(k: K, v: string) {
    setParams({ ...params, [k]: parseFloat(v) || 0 });
  }

  function gerar() {
    if (!estudo.geojson || !estudo.centroLat || !estudo.centroLng) return;
    setGerando(true);
    // deixa o spinner pintar antes do cálculo síncrono
    setTimeout(() => {
      try {
        const feature = JSON.parse(estudo.geojson!) as Feature<Polygon>;
        const anel = feature.geometry.coordinates[0];
        const novos = gerarCenariosMassa(
          anel,
          [estudo.centroLng!, estudo.centroLat!],
          params,
          { populacao: 14, geracoes: 12, seed: Date.now() % 100000, nCenarios: 3 }
        );
        setCenarios(novos);
        setSelecionado(novos[0]?.id ?? null);
      } finally {
        setGerando(false);
      }
    }, 30);
  }

  async function salvar() {
    setBusy(true);
    try {
      await salvarMassa(estudo.id, { params, cenarios }, selecionado);
    } finally {
      setBusy(false);
    }
  }

  async function usarNoEve() {
    const c = cenarios.find((x) => x.id === selecionado);
    if (!c) return;
    setBusy(true);
    try {
      const areaMedia = c.kpis.lotesVendaveis > 0 ? Math.round(c.kpis.areaVendavelM2 / c.kpis.lotesVendaveis) : 0;
      const mix = [{
        nome: `Lote ${areaMedia}m² (massa ${c.id})`,
        quantidade: c.kpis.lotesVendaveis,
        areaUnidadeM2: areaMedia,
        precoM2: params.precoM2Lote,
      }];
      await salvarMassa(estudo.id, { params, cenarios }, selecionado, mix);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  const cenarioAtivo = cenarios.find((c) => c.id === selecionado) ?? cenarios[0];

  const campos: { k: keyof ParametrosMassa; label: string; step?: string }[] = [
    { k: "testadaLoteM", label: "Testada do lote (m)", step: "0.5" },
    { k: "profundidadeLoteM", label: "Profundidade (m)" },
    { k: "loteMinimoM2", label: "Lote mínimo (m²)" },
    { k: "larguraViaM", label: "Largura da via (m)" },
    { k: "comprimentoMaxQuadraM", label: "Quadra máx. (m)" },
    { k: "precoM2Lote", label: "Preço lote (R$/m²)" },
    { k: "percentInstitucional", label: "% institucional (0-1)", step: "0.01" },
    { k: "percentAreaVerde", label: "% área verde (0-1)", step: "0.01" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Grid3x3 size={13} /> Parâmetros do parcelamento
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {campos.map((c) => (
            <div key={c.k}>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">{c.label}</label>
              <input type="number" step={c.step ?? "any"} value={params[c.k]}
                onChange={(e) => upd(c.k, e.target.value)}
                className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]" />
            </div>
          ))}
        </div>
        <button onClick={gerar} disabled={gerando || !estudo.geojson}
          className="mt-4 flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <Grid3x3 size={14} />}
          {gerando ? "Otimizando cenários (algoritmo genético)..." : "Gerar cenários otimizados"}
        </button>
      </div>

      {cenarios.length > 0 && (
        <>
          {/* Comparação de cenários */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cenarios.map((c, i) => {
              const ativo = c.id === selecionado;
              return (
                <button key={c.id} onClick={() => setSelecionado(c.id)}
                  className={`text-left border p-4 transition-colors ${ativo ? "border-[var(--brand-yellow)] bg-yellow-50/40" : "border-gray-100 bg-white hover:border-gray-300"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-[var(--brand-dark)] uppercase flex items-center gap-1">
                      {i === 0 && <Trophy size={12} className="text-[var(--brand-yellow)]" />} Cenário {i + 1}
                    </p>
                    <span className="text-[10px] text-gray-400">malha {c.anguloVia}°</span>
                  </div>
                  <p className="font-black text-[var(--brand-dark)] text-xl leading-none mb-1">{c.kpis.lotesVendaveis} lotes</p>
                  <p className="text-[11px] text-gray-500">
                    {c.kpis.areaVendavelM2.toLocaleString("pt-BR")} m² vendáveis · {(c.kpis.aproveitamento * 100).toFixed(0)}% aproveitamento
                  </p>
                  <p className="text-sm font-bold text-green-600 mt-1">VGV {formatCurrency(c.kpis.vgv)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    lote {c.testadaLoteM}×{c.profundidadeLoteM}m · via {c.larguraViaM}m
                  </p>
                </button>
              );
            })}
          </div>

          {/* Mapa do cenário selecionado */}
          {cenarioAtivo && estudo.geojson && (
            <div className="bg-white border border-gray-100 p-2">
              <MapaMassa geojson={estudo.geojson} lotes={cenarioAtivo.lotes} />
              <p className="text-[10px] text-gray-400 p-2">
                Amarelo = lotes vendáveis · Verde = doação (institucional/área verde). Estudo de aproveitamento — não substitui projeto urbanístico aprovado.
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={salvar} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 disabled:opacity-50">
              <Save size={13} /> Salvar cenários
            </button>
            <button onClick={usarNoEve} disabled={busy || !selecionado}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] disabled:opacity-50">
              <Send size={13} /> Usar cenário na Viabilidade (mix de produtos)
            </button>
          </div>
        </>
      )}

      {cenarios.length === 0 && !gerando && (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <Grid3x3 size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum cenário gerado</p>
          <p className="text-gray-400 text-sm mt-1">
            O motor testa dezenas de malhas viárias e dimensões de lote e devolve as 3 melhores por VGV.
          </p>
        </div>
      )}
    </div>
  );
}
