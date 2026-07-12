"use client";

import { useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Mountain, Upload, Loader2 } from "lucide-react";
import { salvarElevacao, uploadLevantamento } from "@/lib/actions/incorporacao";
import {
  declividadeGrade, declividadeMedia, distribuicaoDeclividade, celulaEmMetros,
} from "@/lib/geo/relevo";
import type { ModoRelevo } from "./viewer-3d";
import type { EstudoData } from "./incorporacao-detail";
import type { Feature, Polygon } from "geojson";

const Viewer3D = dynamic(() => import("./viewer-3d").then((m) => m.Viewer3D), {
  ssr: false,
  loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: 440 }} />,
});

interface GridElevacao {
  ncols: number; nrows: number; z: number[][]; min: number; max: number;
  cellsizeX: number; cellsizeY: number; west: number; south: number; fonte: string;
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
  const [modo, setModo] = useState<ModoRelevo>("elevacao");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Latitude central do terreno (para converter célula de graus → metros).
  const latCentro = useMemo(() => {
    if (estudo.centroLat != null) return estudo.centroLat;
    if (estudo.geojson) { const b = bboxDoGeojson(estudo.geojson); return (b.south + b.north) / 2; }
    return -6.5;
  }, [estudo.centroLat, estudo.geojson]);

  const slopes = useMemo(() => {
    if (!grid) return null;
    const { x, y } = celulaEmMetros(grid.cellsizeX, grid.cellsizeY, latCentro);
    return declividadeGrade(grid, x, y);
  }, [grid, latCentro]);

  const distribuicao = useMemo(() => (slopes ? distribuicaoDeclividade(slopes) : []), [slopes]);
  const declivMedia = useMemo(() => (slopes ? declividadeMedia(slopes) : 0), [slopes]);

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Cota mínima" value={`${Math.round(grid.min)} m`} />
            <Metric label="Cota máxima" value={`${Math.round(grid.max)} m`} />
            <Metric label="Desnível" value={`${amplitude} m`} />
            <Metric label="Declividade média" value={`${declivMedia.toFixed(1)}%`} />
          </div>

          {/* Alternância de modo */}
          <div className="flex items-center gap-2">
            {([["elevacao", "Elevação"], ["declividade", "Declividade"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => setModo(m)}
                className={`text-xs font-bold px-4 py-2 transition-colors ${
                  modo === m ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-100 p-2">
            <Viewer3D grid={grid} geojson={estudo.geojson} modo={modo} />
            {/* Legenda */}
            {modo === "elevacao" ? (
              <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-gray-500">
                <span>{Math.round(grid.min)} m</span>
                <span className="flex-1 h-2" style={{ background: "linear-gradient(to right,#2c6fbb,#3f9d8a,#63a45f,#9aa55a,#b3985f,#8a6a45)" }} />
                <span>{Math.round(grid.max)} m</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 py-2 text-[11px] text-gray-500">
                {distribuicao.map((f) => (
                  <span key={f.chave} className="flex items-center gap-1">
                    <span className="inline-block w-3 h-2" style={{ background: f.corHex }} /> {f.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Distribuição de declividades (tabela) */}
          <div className="bg-white border border-gray-100 overflow-hidden">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-4 pt-3">Distribuição de declividades</p>
            <div className="p-3 space-y-1.5">
              {distribuicao.map((f) => (
                <div key={f.chave} className="flex items-center gap-2">
                  <span className="w-28 text-xs text-gray-600 shrink-0">{f.label}</span>
                  <div className="flex-1 bg-gray-100 h-3 overflow-hidden">
                    <div className="h-full" style={{ width: `${(f.pct * 100).toFixed(1)}%`, background: f.corHex }} />
                  </div>
                  <span className="w-12 text-right text-xs font-bold text-[var(--brand-dark)]">{(f.pct * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-gray-400">Fonte: {grid.fonte}. Superfície recortada no polígono do terreno, suavizada e com curvas de nível cotadas; exagero vertical contido para leitura. Declividade por diferenças centrais sobre o DEM.</p>
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
