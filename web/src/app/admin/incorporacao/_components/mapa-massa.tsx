"use client";

import { useEffect, useRef } from "react";
import type { Feature, Polygon, Position } from "geojson";
import type { LoteGerado } from "@/lib/geo/massa";

// Mapa Leaflet que desenha a gleba + os lotes do cenário de massa.
// Lotes vendáveis em amarelo; áreas públicas (doação) em verde.

interface Props {
  geojson: string; // Feature<Polygon> da gleba
  lotes: LoteGerado[];
  height?: number;
}

export function MapaMassa({ geojson, lotes, height = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

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

      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }

      let gleba: Feature<Polygon>;
      try { gleba = JSON.parse(geojson) as Feature<Polygon>; } catch { return; }

      const map = L.map(ref.current);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);

      const glebaLayer = L.geoJSON(gleba, {
        style: { color: "#1A1A1A", weight: 2, fillOpacity: 0.02 },
      }).addTo(map);

      for (const lote of lotes) {
        const latlngs = lote.anel.map((p: Position) => [p[1], p[0]] as [number, number]);
        L.polygon(latlngs, {
          color: lote.tipo === "vendavel" ? "#F5C400" : "#22c55e",
          weight: 1,
          fillColor: lote.tipo === "vendavel" ? "#F5C400" : "#22c55e",
          fillOpacity: 0.35,
        })
          .bindTooltip(`${lote.areaM2} m² · ${lote.tipo === "vendavel" ? "Lote" : "Área pública"}`)
          .addTo(map);
      }

      try { map.fitBounds(glebaLayer.getBounds(), { padding: [16, 16] }); } catch {}
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [geojson, lotes]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}
