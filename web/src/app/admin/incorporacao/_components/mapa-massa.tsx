"use client";

import { useEffect, useRef } from "react";
import type { Feature, Polygon, Position } from "geojson";
import type { LoteGerado } from "@/lib/geo/massa";

// Mapa Leaflet que desenha a gleba + os lotes do cenário de massa.
// Lotes vendáveis em amarelo; áreas públicas (doação) em verde.
//
// Ciclo de vida: a instância do Leaflet (`L.map`) é criada uma vez por
// execução do efeito e sempre destruída (`map.remove()`) antes de uma nova
// ser criada — no cleanup do efeito (unmount / troca de cenário/gleba) e,
// defensivamente, no início de uma nova execução (regeneração de cenário
// disparada enquanto uma instância anterior ainda não terminou de montar).
// `removerMapaSeguro` garante que essa remoção nunca é feita duas vezes
// sobre a mesma instância (o que o Leaflet lança como erro) e nunca deixa
// uma exceção do Leaflet derrubar a página.

interface Props {
  geojson: string; // Feature<Polygon> da gleba
  lotes: LoteGerado[];
  height?: number;
}

type MapaLeaflet = { remove: () => void };

function removerMapaSeguro(mapRef: { current: MapaLeaflet | null }) {
  if (!mapRef.current) return; // já removido — evita remoção duplicada
  const instancia = mapRef.current;
  mapRef.current = null; // zera antes de tentar remover: nunca reentra aqui
  try {
    instancia.remove();
  } catch {
    // instância já destruída/inconsistente (ex.: StrictMode remontando o
    // efeito) — ignora para não derrubar a página com uma exceção do Leaflet
  }
}

export function MapaMassa({ geojson, lotes, height = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapaLeaflet | null>(null);

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

      // destrói uma instância anterior (ex.: regeneração rápida de cenário)
      // antes de criar a nova — nunca duas instâncias vivas no mesmo container.
      removerMapaSeguro(mapRef);

      let gleba: Feature<Polygon>;
      try { gleba = JSON.parse(geojson) as Feature<Polygon>; } catch { return; }

      // o cleanup pode ter corrido enquanto aguardávamos o import/parse acima
      if (cancelled || !ref.current) return;

      const map = L.map(ref.current);
      mapRef.current = map;

      try {
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap", maxZoom: 19,
        }).addTo(map);

        const glebaLayer = L.geoJSON(gleba, {
          style: { color: "#1A1A1A", weight: 2, fillOpacity: 0.02 },
        }).addTo(map);

        for (const lote of lotes) {
          try {
            const latlngs = lote.anel.map((p: Position) => [p[1], p[0]] as [number, number]);
            L.polygon(latlngs, {
              color: lote.tipo === "vendavel" ? "#F5C400" : "#22c55e",
              weight: 1,
              fillColor: lote.tipo === "vendavel" ? "#F5C400" : "#22c55e",
              fillOpacity: 0.35,
            })
              .bindTooltip(`${lote.areaM2} m² · ${lote.tipo === "vendavel" ? "Lote" : "Área pública"}`)
              .addTo(map);
          } catch {
            // lote com geometria inválida — pula e segue desenhando os demais
          }
        }

        try { map.fitBounds(glebaLayer.getBounds(), { padding: [16, 16] }); } catch { /* bounds inválidos */ }
      } catch {
        // falha ao montar as camadas — remove a instância para não deixar
        // um mapa parcialmente inicializado preso na tela
        removerMapaSeguro(mapRef);
      }
    })();

    return () => {
      cancelled = true;
      removerMapaSeguro(mapRef);
    };
  }, [geojson, lotes]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}
