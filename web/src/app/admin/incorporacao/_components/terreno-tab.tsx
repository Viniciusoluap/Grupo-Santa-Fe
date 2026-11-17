"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Upload, MapPinned, Ruler } from "lucide-react";
import type { uploadKml } from "@/lib/actions/incorporacao";
import type { EstudoData } from "./incorporacao-detail";
import { enviarComProgresso, publicarEnvio } from "@/lib/envio-progresso";
import { enviarEmPartes } from "@/lib/incorporacao/envio-partes";
import { SemKmlToggle } from "./lotes-avulsos-editor";
import { AVISO_SEM_POLIGONAL } from "@/lib/incorporacao/lotes-avulsos";
import { formatArea } from "@/lib/utils";

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
  const [aviso, setAviso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(formData: FormData) {
    setBusy(true);
    setErro(null);
    setAviso(null);
    try {
      // Paridade 17/11 (S-08): KML ou KMZ até 20 MB, enviado em partes de 1 MiB
      const file = formData.get("kml");
      if (!(file instanceof File) || file.size === 0) { setErro("Selecione um arquivo KML ou KMZ."); return; }
      if (!/\.(kml|kmz)$/i.test(file.name)) { setErro("Envie um arquivo .kml ou .kmz."); return; }
      const uploadId = await enviarEmPartes("incorporacao.terreno.parte", file, { estudoId: estudo.id });
      const res = await enviarComProgresso<Awaited<ReturnType<typeof uploadKml>>>("incorporacao.kml", { estudoId: estudo.id, uploadId, fileName: file.name }, { item: "arquivo" });
      if (res?.error) setErro(res.error);
      else if (res?.aviso) { setAviso(res.aviso); window.setTimeout(() => window.location.reload(), 2500); }
      else window.location.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      publicarEnvio(null);
      setBusy(false);
    }
  }

  const temTerreno = !!estudo.geojson;

  return (
    <div className="space-y-4">
      {/* Upload */}
      <form action={enviar} className="bg-white border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <input ref={inputRef} type="file" name="kml" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" className="hidden"
          onChange={(e) => { if (e.target.files?.length) e.target.form?.requestSubmit(); }} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
          <Upload size={14} /> {busy ? "Processando..." : temTerreno ? "Trocar KML/KMZ" : "Enviar KML/KMZ do terreno"}
        </button>
        <span className="text-xs text-gray-600">Formato .kml ou .kmz (polígono do terreno, até 20 MB)</span>
      </form>
      {erro && <p className="text-xs text-red-500">{erro}{temTerreno ? " O terreno já salvo foi mantido." : ""}</p>}
      {aviso && <p className="text-xs text-amber-700">{aviso}</p>}

      {/* Correção 06: empreendimento sem KML + lotes avulsos */}
      <SemKmlToggle estudo={estudo} />

      {temTerreno ? (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Metric label="Área" value={hectares(estudo.areaM2)} sub={formatArea(estudo.areaM2)} icon={MapPinned} />
            <Metric label="Perímetro" value={`${estudo.perimetroM.toLocaleString("pt-BR")} m`} icon={Ruler} />
            <Metric label="Centro" value={estudo.centroLat && estudo.centroLng ? `${estudo.centroLat.toFixed(5)}, ${estudo.centroLng.toFixed(5)}` : "—"} icon={MapPinned} />
          </div>
          {/* Mapa */}
          <div className="bg-white border border-gray-100 p-2">
            <MapaTerreno
              geojson={estudo.geojson!}
              center={estudo.centroLat && estudo.centroLng ? [estudo.centroLat, estudo.centroLng] : undefined}
              estudoId={estudo.id}
              largurasJson={estudo.largurasFaixaJson}
              carInformado={estudo.carRegistro}
            />
          </div>
        </>
      ) : (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <MapPinned size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{estudo.semKml ? "Sem poligonal" : "Nenhum terreno carregado"}</p>
          <p className="text-gray-600 text-sm mt-1">{estudo.semKml ? AVISO_SEM_POLIGONAL : "Envie o KML para desenhar o polígono e calcular área e perímetro."}</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="bg-white border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</p>
        <Icon size={14} className="text-gray-500" />
      </div>
      <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}
