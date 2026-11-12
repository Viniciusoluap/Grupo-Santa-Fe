"use client";


import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { GeoJSONSource, Map as MapaMl } from "maplibre-gl";
import { bbox as turfBbox } from "@turf/turf";
import type { LoteGerado } from "@/lib/geo/massa";
import { aplicarBase, criarMapaBase, type BaseMapa } from "./mapa-base-ml";
import { formatArea } from "@/lib/utils";

// Mapa que desenha a gleba + os lotes do cenário de massa.
// Motor MapLibre GL (11/11, pedido do dono: "quero o motor novo") — o mesmo do mapa
// do Terreno: satélite do Mapbox quando há token salvo, senão Esri no zoom nativo
// real da região (mapa-base-ml.ts). Lotes vendáveis em amarelo, institucional em
// azul, área verde em verde, restrições em cinza e sistema viário em cinza-claro.
//
// Ciclo de vida: o mapa é criado uma vez por gleba e destruído no cleanup; trocar
// de cenário só atualiza os dados (setData), sem recriar o mapa — por isso a
// regeneração rápida de cenário não deixa instância presa nem pisca a tela.

interface Props {
  geojson: string;
  lotes: LoteGerado[];
  /** Vias desenhadas (corredores + balões do cul-de-sac), [lng, lat]. */
  vias?: Position[][];
  height?: number;
}

/** Cores por destinação — mesma legenda exibida abaixo do mapa. */
export const CORES_MASSA = {
  vendavel: "#F5C400",
  institucional: "#3b82f6",
  verde: "#22c55e",
  nao_parcelavel: "#9ca3af",
  via: "#e5e7eb",
} as const;

function corDoLote(l: LoteGerado): string {
  if (l.tipo === "vendavel") return CORES_MASSA.vendavel;
  if (l.tipo === "nao_parcelavel") return CORES_MASSA.nao_parcelavel;
  return l.uso === "institucional" ? CORES_MASSA.institucional : CORES_MASSA.verde;
}

function rotuloDoLote(l: LoteGerado): string {
  if (l.tipo === "vendavel") return `${l.quadra ? `Quadra ${l.quadra} · Lote ${l.numero} · ` : ""}${formatArea(l.areaM2)}`;
  if (l.tipo === "nao_parcelavel") return `${formatArea(l.areaM2)} · Não parcelável (restrição)`;
  return `${formatArea(l.areaM2)} · ${l.uso === "institucional" ? "Institucional" : l.uso === "verde" ? "Área verde" : "Área pública"}`;
}

const fcDe = (feats: Feature<Geometry>[]): FeatureCollection => ({ type: "FeatureCollection", features: feats });

/** Fecha o anel se vier aberto e descarta o que não forma polígono. */
function poligono(anel: Position[], props: Record<string, unknown>): Feature<Geometry> | null {
  const pts = anel.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 3) return null;
  const [a, z] = [pts[0], pts[pts.length - 1]];
  const fechado = a[0] === z[0] && a[1] === z[1] ? pts : [...pts, a];
  return fechado.length >= 4 ? { type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [fechado] } } : null;
}

export function MapaMassa({ geojson, lotes, vias, height = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapaMl | null>(null);
  const [pronto, setPronto] = useState(false);
  const [base, setBase] = useState<BaseMapa>("satelite");
  const [dica, setDica] = useState<string | null>(null);

  // ─── Mapa base: um por gleba ─────────────────────────────────────────────
  useEffect(() => {
    if (!ref.current) return;
    let gleba: Feature<Geometry> | Geometry;
    let limites: [number, number, number, number];
    try {
      gleba = JSON.parse(geojson) as Feature<Geometry> | Geometry;
      limites = turfBbox(gleba as Feature<Geometry>) as [number, number, number, number];
      if (!limites.every(Number.isFinite)) return;
    } catch { return; }
    let cancelado = false;
    let map: MapaMl | null = null;
    (async () => {
      try {
        const criado = await criarMapaBase(ref.current!, limites, { atribuicao: "Estudo de massa", cancelado: () => cancelado || !ref.current });
        if (!criado) return;
        map = criado.map;
        if (cancelado) { map.remove(); return; }
        map.on("load", () => {
          if (cancelado || !map) return;
          for (const id of ["vias", "lotes", "gleba"]) map.addSource(id, { type: "geojson", data: fcDe([]) });
          map.addLayer({ id: "vias-fill", type: "fill", source: "vias", paint: { "fill-color": CORES_MASSA.via, "fill-opacity": 0.85 } });
          map.addLayer({ id: "vias-line", type: "line", source: "vias", paint: { "line-color": "#6b7280", "line-width": 1 } });
          map.addLayer({ id: "lotes-fill", type: "fill", source: "lotes", paint: { "fill-color": ["get", "cor"], "fill-opacity": 0.45 } });
          map.addLayer({ id: "lotes-line", type: "line", source: "lotes", paint: { "line-color": ["get", "cor"], "line-width": 1 } });
          map.addLayer({ id: "gleba-line", type: "line", source: "gleba", paint: { "line-color": "#ffffff", "line-width": 2.5 } });
          (map.getSource("gleba") as GeoJSONSource).setData(gleba as Feature<Geometry>);
          // rótulo do lote/via ao passar o mouse ou tocar (substitui o tooltip do Leaflet)
          const mostrar = (e: { features?: { properties?: Record<string, unknown> | null }[] }) => setDica(String(e.features?.[0]?.properties?.rotulo ?? "") || null);
          for (const camada of ["lotes-fill", "vias-fill"]) {
            map.on("mousemove", camada, mostrar);
            map.on("click", camada, mostrar);
            map.on("mouseleave", camada, () => setDica(null));
          }
          mapRef.current = map;
          setPronto(true);
        });
      } catch {
        // falha ao montar o mapa: não deixa instância parcial presa na tela
        try { map?.remove(); } catch { /* já removido */ }
      }
    })();
    return () => {
      cancelado = true;
      setPronto(false);
      mapRef.current = null;
      try { map?.remove(); } catch { /* instância já destruída (ex.: StrictMode) */ }
    };
  }, [geojson]);

  // ─── Lotes e vias: só troca os dados quando o cenário muda ───────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pronto) return;
    const lotesFc = lotes.flatMap(l => { const f = poligono(l.anel, { cor: corDoLote(l), rotulo: rotuloDoLote(l) }); return f ? [f] : []; });
    const viasFc = (vias ?? []).flatMap(v => { const f = poligono(v, { rotulo: "Sistema viário" }); return f ? [f] : []; });
    (map.getSource("lotes") as GeoJSONSource | undefined)?.setData(fcDe(lotesFc));
    (map.getSource("vias") as GeoJSONSource | undefined)?.setData(fcDe(viasFc));
  }, [lotes, vias, pronto]);

  useEffect(() => {
    if (mapRef.current && pronto) aplicarBase(mapRef.current, base);
  }, [base, pronto]);

  return (
    <div className="relative">
      <div ref={ref} style={{ height, width: "100%" }} className="bg-gray-100" data-testid="mapa-massa" />
      <div className="absolute left-2 top-2 flex overflow-hidden border border-gray-300 bg-white text-[11px] font-bold shadow-sm">
        {(["satelite", "ruas"] as const).map(b => (
          <button key={b} type="button" onClick={() => setBase(b)}
            className={`px-2.5 py-1 ${base === b ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-600 hover:bg-gray-50"}`}>
            {b === "satelite" ? "Satélite" : "Ruas"}
          </button>
        ))}
      </div>
      {dica && <div className="pointer-events-none absolute bottom-8 left-2 max-w-[90%] bg-white/95 px-2 py-1 text-[11px] font-bold text-gray-700 shadow">{dica}</div>}
    </div>
  );
}
