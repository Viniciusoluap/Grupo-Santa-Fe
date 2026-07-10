"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, Polygon, LineString } from "geojson";
import { bbox as turfBbox, buffer as turfBuffer, lineString, intersect, featureCollection } from "@turf/turf";

// Mapa do terreno com base de SATÉLITE colorida (Esri World Imagery, keyless) e
// camadas de estudo sobre o KML: cursos d'água/nascentes, APP (faixa de proteção
// calculada por buffer dos rios), rodovias e linhas de transmissão — obtidas do
// OpenStreetMap via Overpass API (sem chave). Tudo best-effort: se o Overpass
// não responder, o mapa continua mostrando o terreno normalmente.

interface Props {
  geojson: string; // Feature<Polygon> serializado
  center?: [number, number]; // [lat, lng]
  height?: number;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
}

const CORES = {
  terreno: "#F5C400",
  agua: "#38bdf8",
  app: "#22c55e",
  rodovia: "#f97316",
  transmissao: "#ef4444",
  nascente: "#0ea5e9",
};

const APP_BUFFER_M = 30; // faixa de APP de 30 m ao longo dos cursos d'água (padrão APP hídrica)

export function MapaTerreno({ geojson, center, height = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [carregandoCamadas, setCarregandoCamadas] = useState(false);
  const [resumo, setResumo] = useState<{ agua: number; nascentes: number; rodovias: number; transmissao: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      let feature: Feature<Polygon>;
      try {
        feature = JSON.parse(geojson) as Feature<Polygon>;
      } catch {
        return;
      }

      if (mapRef.current) {
        (mapRef.current as import("leaflet").Map).remove();
        mapRef.current = null;
      }

      const map = L.map(ref.current).setView(center ?? [-6.5, -49.879], 15);
      mapRef.current = map;

      // Base satélite colorida + rótulos/vias por cima (keyless).
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
      ).addTo(map);
      L.tileLayer(
        "https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png",
        { attribution: "© Stamen · OSM", maxZoom: 19, opacity: 0.85 }
      ).addTo(map);

      const terrenoLayer = L.geoJSON(feature, {
        style: { color: CORES.terreno, weight: 3, fillColor: CORES.terreno, fillOpacity: 0.12 },
      }).addTo(map);

      try {
        map.fitBounds(terrenoLayer.getBounds(), { padding: [24, 24] });
      } catch {
        /* bounds vazio */
      }

      // ─── Camadas de estudo (Overpass) ───────────────────────────────────────
      const [minX, minY, maxX, maxY] = turfBbox(feature); // [W,S,E,N]
      const query =
        `[out:json][timeout:25];(` +
        `way["waterway"](${minY},${minX},${maxY},${maxX});` +
        `node["natural"="spring"](${minY},${minX},${maxY},${maxX});` +
        `way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](${minY},${minX},${maxY},${maxX});` +
        `way["power"~"line|minor_line"](${minY},${minX},${maxY},${maxX});` +
        `);out geom;`;

      setCarregandoCamadas(true);
      try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { elements: OverpassElement[] };
          const contagem = { agua: 0, nascentes: 0, rodovias: 0, transmissao: 0 };
          const linhasAgua: LineString[] = [];

          for (const el of data.elements) {
            const tags = el.tags ?? {};
            if (el.type === "node" && tags.natural === "spring" && el.lat != null && el.lon != null) {
              L.circleMarker([el.lat, el.lon], { radius: 5, color: CORES.nascente, fillColor: CORES.nascente, fillOpacity: 0.9, weight: 1 })
                .bindTooltip("Nascente").addTo(map);
              contagem.nascentes++;
              continue;
            }
            if (el.type === "way" && el.geometry && el.geometry.length > 1) {
              const latlngs = el.geometry.map((g) => [g.lat, g.lon] as [number, number]);
              if (tags.waterway) {
                L.polyline(latlngs, { color: CORES.agua, weight: 2.5 }).bindTooltip("Curso d'água").addTo(map);
                contagem.agua++;
                linhasAgua.push(lineString(el.geometry.map((g) => [g.lon, g.lat])).geometry);
              } else if (tags.highway) {
                L.polyline(latlngs, { color: CORES.rodovia, weight: 2, opacity: 0.8 }).bindTooltip("Via/Rodovia").addTo(map);
                contagem.rodovias++;
              } else if (tags.power) {
                L.polyline(latlngs, { color: CORES.transmissao, weight: 2, dashArray: "6 4" }).bindTooltip("Linha de transmissão").addTo(map);
                contagem.transmissao++;
              }
            }
          }

          // APP: buffer dos cursos d'água recortado pelo terreno.
          for (const linha of linhasAgua) {
            try {
              const faixa = turfBuffer(linha, APP_BUFFER_M, { units: "meters" });
              if (!faixa) continue;
              const dentro = intersect(featureCollection([faixa as Feature<Polygon>, feature]));
              const alvo = dentro ?? faixa;
              L.geoJSON(alvo, { style: { color: CORES.app, weight: 1, fillColor: CORES.app, fillOpacity: 0.25 } })
                .bindTooltip(`APP (${APP_BUFFER_M} m)`).addTo(map);
            } catch {
              /* buffer/interseção pode falhar em geometrias degeneradas */
            }
          }

          if (!cancelled) setResumo(contagem);
        }
      } catch {
        /* Overpass indisponível — mantém o terreno sem overlays */
      } finally {
        if (!cancelled) setCarregandoCamadas(false);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as import("leaflet").Map).remove();
        mapRef.current = null;
      }
    };
  }, [geojson, center]);

  return (
    <div className="space-y-2">
      <div ref={ref} style={{ height, width: "100%" }} className="border border-gray-200" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {[
          { c: CORES.terreno, l: "Terreno" },
          { c: CORES.agua, l: "Curso d'água" },
          { c: CORES.app, l: `APP (${APP_BUFFER_M} m)` },
          { c: CORES.nascente, l: "Nascente" },
          { c: CORES.rodovia, l: "Rodovia" },
          { c: CORES.transmissao, l: "L. transmissão" },
        ].map(({ c, l }) => (
          <span key={l} className="flex items-center gap-1">
            <span className="inline-block w-3 h-2" style={{ background: c }} /> {l}
          </span>
        ))}
        {carregandoCamadas && <span className="text-gray-400">carregando camadas…</span>}
        {resumo && !carregandoCamadas && (
          <span className="text-gray-400">
            {resumo.agua} cursos d&apos;água · {resumo.nascentes} nascentes · {resumo.rodovias} vias · {resumo.transmissao} linhas AT
          </span>
        )}
      </div>
    </div>
  );
}
