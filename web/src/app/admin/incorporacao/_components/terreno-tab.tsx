"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Upload, MapPinned, Ruler } from "lucide-react";
import { uploadKml } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";

const MapaTerreno = dynamic(() => import("./mapa-terreno").then((m) => m.MapaTerreno), {
  ssr: false,
  loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: 380 }} />,
});

function hectares(m2: number) {
  return `${(m2 / 10_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`;
}

export function TerrenoTab({ estudo }: { estudo: EstudoData }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(formData: FormData) {
    setBusy(true);
    setErro(null);
    try {
      const res = await uploadKml(estudo.id, formData);
      if (res?.error) setErro(res.error);
      else window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  const temTerreno = !!estudo.geojson;

  return (
    <div className="space-y-4">
      {/* Upload */}
      <form action={enviar} className="bg-white border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <input ref={inputRef} type="file" name="kml" accept=".kml" className="hidden"
          onChange={(e) => { if (e.target.files?.length) e.target.form?.requestSubmit(); }} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
          <Upload size={14} /> {busy ? "Processando..." : temTerreno ? "Trocar KML" : "Enviar KML do terreno"}
        </button>
        <span className="text-xs text-gray-400">Formato .kml (polígono do terreno)</span>
      </form>
      {erro && <p className="text-xs text-red-500">{erro}</p>}

      {temTerreno ? (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Metric label="Área" value={hectares(estudo.areaM2)} sub={`${estudo.areaM2.toLocaleString("pt-BR")} m²`} icon={MapPinned} />
            <Metric label="Perímetro" value={`${estudo.perimetroM.toLocaleString("pt-BR")} m`} icon={Ruler} />
            <Metric label="Centro" value={estudo.centroLat && estudo.centroLng ? `${estudo.centroLat.toFixed(5)}, ${estudo.centroLng.toFixed(5)}` : "—"} icon={MapPinned} />
          </div>
          {/* Mapa */}
          <div className="bg-white border border-gray-100 p-2">
            <MapaTerreno
              geojson={estudo.geojson!}
              center={estudo.centroLat && estudo.centroLng ? [estudo.centroLat, estudo.centroLng] : undefined}
              estudoId={estudo.id}
            />
          </div>
        </>
      ) : (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <MapPinned size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum terreno carregado</p>
          <p className="text-gray-400 text-sm mt-1">Envie o KML para desenhar o polígono e calcular área e perímetro.</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <Icon size={14} className="text-gray-300" />
      </div>
      <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
