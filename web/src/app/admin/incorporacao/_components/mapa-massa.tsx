"use client";


import { useEffect, useRef } from "react";
import type { Feature, Polygon, Position } from "geojson";
import type { LoteGerado } from "@/lib/geo/massa";
import { adicionarCamadasBase } from "./camadas-base";
import { formatArea } from "@/lib/utils";

// Mapa Leaflet que desenha a gleba + os lotes do cenário de massa.
// Base satélite + ruas (camadas-base.ts). Lotes vendáveis em amarelo, institucional
// em azul, área verde em verde, restrições em cinza e balões do cul-de-sac.
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
  /** Balões de retorno do cul-de-sac ([lng, lat]). */
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

export function MapaMassa({ geojson, lotes, vias, height = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapaLeaflet | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      // destrói uma instância anterior (ex.: regeneração rápida de cenário)
      // antes de criar a nova — nunca duas instâncias vivas no mesmo container.
      removerMapaSeguro(mapRef);

      let gleba: Feature<Polygon>;
      try { gleba = JSON.parse(geojson) as Feature<Polygon>; } catch { return; }

      // o cleanup pode ter corrido enquanto aguardávamos o import/parse acima
      if (cancelled || !ref.current) return;

      const map = L.map(ref.current, { maxZoom: 20, zoomSnap: 0.5 });
      mapRef.current = map;

      try {
        adicionarCamadasBase(L, map);

        const glebaLayer = L.geoJSON(gleba, {
          style: { color: "#ffffff", weight: 2.5, fillOpacity: 0.02 },
        }).addTo(map);

        for (const via of vias ?? []) {
          try {
            L.polygon(via.map((p: Position) => [p[1], p[0]] as [number, number]), {
              color: "#6b7280", weight: 1, fillColor: CORES_MASSA.via, fillOpacity: 0.85,
            }).bindTooltip("Balão de retorno (cul-de-sac)").addTo(map);
          } catch { /* geometria inválida */ }
        }

        for (const lote of lotes) {
          try {
            const latlngs = lote.anel.map((p: Position) => [p[1], p[0]] as [number, number]);
            const cor = corDoLote(lote);
            L.polygon(latlngs, { color: cor, weight: 1, fillColor: cor, fillOpacity: 0.45 })
              .bindTooltip(rotuloDoLote(lote))
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
  }, [geojson, lotes, vias]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}
