"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Mountain, Upload, Loader2 } from "lucide-react";
import { salvarElevacao, uploadLevantamento } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";
import type { Feature, Polygon } from "geojson";

const Viewer3D = dynamic(() => import("./viewer-3d").then((m) => m.Viewer3D), {
  ssr: false,
  loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: 420 }} />,
});

interface GridElevacao {
  ncols: number; nrows: number; z: number[][]; min: number; max: number;
  cellsizeX: number; cellsizeY: number; fonte: string;
}

function bboxDoGeojson(geojson: string) {
  const f = JSON.parse(geojson) as Feature<Polygon>;
  const anel = f.geometry.coordinates[0];
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [lng, lat] of anel) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, east, south, north };
}

export function TopografiaTab({ estudo }: { estudo: EstudoData }) {
  const inicial = estudo.elevacaoJson ? (JSON.parse(estudo.elevacaoJson) as GridElevacao) : null;
  const [grid, setGrid] = useState<GridElevacao | null>(inicial);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function gerar() {
    if (!estudo.geojson) return;
    setBusy(true);
    setErro(null);
    try {
      const bbox = bboxDoGeojson(estudo.geojson);
      const res = await fetch("/api/incorporacao/elevacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bbox),
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.error ?? "Falha ao obter elevação."); return; }
      setGrid(json);
      await salvarElevacao(estudo.id, JSON.stringify(json));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function enviarLevantamento(formData: FormData) {
    setBusy(true);
    try { await uploadLevantamento(estudo.id, formData); window.location.reload(); }
    finally { setBusy(false); }
  }

  const amplitude = grid ? Math.round(grid.max - grid.min) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <button onClick={gerar} disabled={busy}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Mountain size={14} />}
          {busy ? "Processando relevo..." : grid ? "Regenerar topografia 3D" : "Gerar topografia 3D real"}
        </button>
        <form action={enviarLevantamento}>
          <input ref={inputRef} type="file" name="arquivo" accept=".csv,.txt,.xyz,.dxf" className="hidden"
            onChange={(e) => { if (e.target.files?.length) e.target.form?.requestSubmit(); }} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 border border-gray-200 text-[var(--brand-dark)] hover:border-[var(--brand-yellow)] disabled:opacity-50">
            <Upload size={14} /> Subir meu levantamento
          </button>
        </form>
      </div>
      {erro && <p className="text-xs text-red-500">{erro}</p>}

      {grid ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Metric label="Cota mínima" value={`${Math.round(grid.min)} m`} />
            <Metric label="Cota máxima" value={`${Math.round(grid.max)} m`} />
            <Metric label="Desnível" value={`${amplitude} m`} />
          </div>
          <div className="bg-white border border-gray-100 p-2">
            <Viewer3D grid={grid} />
          </div>
          <p className="text-[10px] text-gray-400">Fonte: {grid.fonte}. Relevo com exagero vertical para leitura.</p>
        </>
      ) : (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <Mountain size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Topografia ainda não gerada</p>
          <p className="text-gray-400 text-sm mt-1">Gere o relevo 3D real a partir do terreno ou envie seu levantamento.</p>
        </div>
      )}

      {estudo.levantamentoUrl && (
        <a href={estudo.levantamentoUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-dark)] underline">
          <Upload size={12} /> Levantamento enviado (baixar)
        </a>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{value}</p>
    </div>
  );
}
