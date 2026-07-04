"use client";

import { useState } from "react";
import { Landmark, Sparkles, Loader2, Save, Calculator } from "lucide-react";
import {
  calcularPotencial,
  PARAMETROS_DEFAULT,
  type ParametrosUrbanisticos,
  type PotencialConstrutivo,
} from "@/lib/urbanismo/potencial";
import { salvarUrbanistico } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

export function UrbanisticoTab({ estudo }: { estudo: EstudoData }) {
  const salvos: ParametrosUrbanisticos | null = estudo.parametrosJson
    ? JSON.parse(estudo.parametrosJson)
    : null;
  const [params, setParams] = useState<ParametrosUrbanisticos>(salvos ?? PARAMETROS_DEFAULT);
  const [areaMediaUnid, setAreaMediaUnid] = useState<number>(60);
  const [potencial, setPotencial] = useState<PotencialConstrutivo | null>(
    estudo.potencialJson ? JSON.parse(estudo.potencialJson) : null
  );
  const [iaInfo, setIaInfo] = useState<{ fontes?: string[]; confiabilidade?: string; observacoes?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function upd<K extends keyof ParametrosUrbanisticos>(k: K, v: string) {
    setParams({ ...params, [k]: k === "zona" ? v : parseFloat(v) || 0 });
  }

  async function preencherComIa() {
    setBusy(true);
    setErro(null);
    try {
      const res = await fetch("/api/incorporacao/urbanistico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipio: estudo.municipio, estado: estudo.estado, zona: params.zona }),
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Falha na busca."); return; }
      const { fontes, confiabilidade, observacoes, ...rest } = json;
      setParams({ ...PARAMETROS_DEFAULT, ...rest });
      setIaInfo({ fontes, confiabilidade, observacoes });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  function calcular() {
    setPotencial(calcularPotencial(estudo.areaM2, params, areaMediaUnid || undefined));
  }

  async function salvar() {
    if (!potencial) return;
    setBusy(true);
    try {
      await salvarUrbanistico(estudo.id, {
        parametros: params,
        potencial,
        parecer: iaInfo?.observacoes,
      });
    } finally {
      setBusy(false);
    }
  }

  const campos: { k: keyof ParametrosUrbanisticos; label: string; step?: string }[] = [
    { k: "taxaOcupacao", label: "Taxa de ocupação (0-1)", step: "0.05" },
    { k: "coefAproveitamento", label: "Coef. aproveitamento", step: "0.1" },
    { k: "recuoFrontalM", label: "Recuo frontal (m)" },
    { k: "recuoLateralM", label: "Recuo lateral (m)", step: "0.5" },
    { k: "recuoFundosM", label: "Recuo fundos (m)" },
    { k: "loteMinimoM2", label: "Lote mínimo (m²)" },
    { k: "testadaMinimaM", label: "Testada mínima (m)" },
    { k: "gabaritoPavimentos", label: "Gabarito (pavimentos)" },
    { k: "percentInstitucional", label: "% institucional (0-1)", step: "0.01" },
    { k: "percentAreaVerde", label: "% área verde (0-1)", step: "0.01" },
    { k: "percentViario", label: "% viário (0-1)", step: "0.01" },
    { k: "vagasPorUnidade", label: "Vagas por unidade", step: "0.5" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Landmark size={13} /> Parâmetros do Plano Diretor — {estudo.municipio}/{estudo.estado}
          </p>
          <button onClick={preencherComIa} disabled={busy}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Pré-preencher com IA
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Zona</label>
            <input value={params.zona} onChange={(e) => upd("zona", e.target.value)} placeholder="Ex.: ZR2"
              className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]" />
          </div>
          {campos.map((c) => (
            <div key={c.k}>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">{c.label}</label>
              <input type="number" step={c.step ?? "any"} value={params[c.k] as number}
                onChange={(e) => upd(c.k, e.target.value)}
                className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]" />
            </div>
          ))}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Área média unid. (m²)</label>
            <input type="number" value={areaMediaUnid} onChange={(e) => setAreaMediaUnid(parseFloat(e.target.value) || 0)}
              className="w-full text-sm border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-[var(--brand-yellow)]" />
          </div>
        </div>

        {iaInfo && (
          <div className="mt-3 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 p-3">
            <b>IA ({iaInfo.confiabilidade ?? "?"})</b>: confira os valores antes de usar.
            {iaInfo.observacoes && <> Obs.: {iaInfo.observacoes}</>}
            {iaInfo.fontes && iaInfo.fontes.filter(Boolean).length > 0 && (
              <> Fontes: {iaInfo.fontes.filter(Boolean).join("; ")}</>
            )}
          </div>
        )}
        {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={calcular}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90">
            <Calculator size={13} /> Calcular potencial
          </button>
          {potencial && (
            <button onClick={salvar} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] hover:opacity-90 disabled:opacity-50">
              <Save size={13} /> Salvar
            </button>
          )}
        </div>
      </div>

      {potencial && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Área edificável máx." value={`${potencial.areaEdificavelMaxM2.toLocaleString("pt-BR")} m²`} destaque />
          <KPI label="Projeção máx. (térreo)" value={`${potencial.projecaoMaxTerreoM2.toLocaleString("pt-BR")} m²`} />
          <KPI label="Área loteável líquida" value={`${potencial.areaLoteavelLiquidaM2.toLocaleString("pt-BR")} m²`} />
          <KPI label="Doações obrigatórias" value={`${potencial.areaDoacaoM2.toLocaleString("pt-BR")} m²`} />
          <KPI label="Lotes máx. (parcelamento)" value={String(potencial.lotesMax)} />
          <KPI label="Unidades máx. (vertical)" value={potencial.unidadesMaxVertical != null ? `${potencial.unidadesMaxVertical} (${potencial.vagasExigidas} vagas)` : "—"} />
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, destaque }: { label: string; value: string; destaque?: boolean }) {
  return (
    <div className={`border p-4 ${destaque ? "bg-[var(--brand-dark)] border-[var(--brand-dark)]" : "bg-white border-gray-100"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${destaque ? "text-[var(--brand-yellow)]" : "text-gray-400"}`}>{label}</p>
      <p className={`font-black text-lg leading-none ${destaque ? "text-white" : "text-[var(--brand-dark)]"}`}>{value}</p>
    </div>
  );
}
