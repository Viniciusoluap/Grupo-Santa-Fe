"use client";

import { useEffect, useRef } from "react";
import type { Feature, Polygon } from "geojson";

// Mapa Leaflet que desenha o polígono do terreno (GeoJSON). Segue o mesmo padrão
// de import dinâmico usado em src/components/map/property-map.tsx (Leaflet vanilla).

interface Props {
  geojson: string; // Feature<Polygon> serializado
  center?: [number, number]; // [lat, lng]
  height?: number;
}

export function MapaTerreno({ geojson, center, height = 380 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      // CSS do Leaflet (uma vez).
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

      // Evita reinicializar sobre um container já com mapa.
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }

      const map = L.map(ref.current).setView(center ?? [-6.5, -49.879], 15);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const layer = L.geoJSON(feature, {
        style: { color: "#F5C400", weight: 3, fillColor: "#F5C400", fillOpacity: 0.15 },
      }).addTo(map);

      try {
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } catch {
        /* bounds vazio */
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [geojson, center]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}
