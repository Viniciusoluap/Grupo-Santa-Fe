// Mapa base em MapLibre GL compartilhado pelo mapa do Terreno e pelo Estudo de Massa
// (pedido do dono de 11/11: "quero o motor novo" também no Estudo de Massa).
// Satélite do Mapbox quando há token público salvo (Admin › Integrações); senão,
// Esri World Imagery no zoom nativo REAL da região (consultado no tilemap) com
// ladrilhos em dobro em tela retina. Botão Satélite/Ruas fica no componente.
// Gêmeo de Prospecta/client/src/components/incorporacao/estudo/mapa-base-ml.ts.
import type { Map as MapaMl, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ESRI_IMAGERY, zoomNativoEsri } from "@/lib/geo/camadas-terreno";
import { ATRIBUICAO_MAPBOX, urlSateliteMapbox } from "@/lib/geo/mapbox-token";

export const ROTA_MAPA_BASE = "/api/incorporacao/mapa-base";
export type BaseMapa = "satelite" | "ruas";

export function estiloBase(sat: { tiles: string[]; tileSize: number; maxzoom: number; attribution: string }, retina: boolean): StyleSpecification {
  const ref = (servico: string) => ({
    type: "raster" as const, tiles: [`${ESRI_IMAGERY.replace("World_Imagery", servico)}/tile/{z}/{y}/{x}`],
    tileSize: retina ? 128 : 256, maxzoom: 18, attribution: "Ruas e rótulos © Esri",
  });
  return {
    version: 8,
    sources: {
      satelite: { type: "raster", tiles: sat.tiles, tileSize: sat.tileSize, maxzoom: sat.maxzoom, attribution: sat.attribution },
      ruasRef: ref("Reference/World_Transportation"),
      rotulos: ref("Reference/World_Boundaries_and_Places"),
      osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: retina ? 128 : 256, maxzoom: 19, attribution: "© OpenStreetMap" },
    },
    layers: [
      { id: "satelite", type: "raster", source: "satelite" },
      { id: "ruasRef", type: "raster", source: "ruasRef", paint: { "raster-opacity": 0.9 } },
      { id: "rotulos", type: "raster", source: "rotulos" },
      { id: "osm", type: "raster", source: "osm", layout: { visibility: "none" } },
    ],
  };
}

export type MapaBaseCriado = { map: MapaMl; info: string };

/**
 * Cria o mapa base já enquadrado em `limites` [oeste, sul, leste, norte].
 * Devolve null se `cancelado()` ficar verdadeiro durante a carga (componente desmontado).
 */
export async function criarMapaBase(
  container: HTMLElement, limites: [number, number, number, number],
  opcoes: { centro?: [number, number]; atribuicao?: string; cancelado?: () => boolean } = {},
): Promise<MapaBaseCriado | null> {
  const [b0, b1, b2, b3] = limites;
  const lat = opcoes.centro?.[0] ?? (b1 + b3) / 2, lng = opcoes.centro?.[1] ?? (b0 + b2) / 2;
  const retina = typeof window !== "undefined" && window.devicePixelRatio >= 1.5;
  const [ml, token, zNativo] = await Promise.all([
    import("maplibre-gl").then(m => m.default ?? m),
    fetch(ROTA_MAPA_BASE, { credentials: "include", signal: AbortSignal.timeout(5000) }).then(r => (r.ok ? r.json() : null)).then(j => (j?.mapboxToken as string | null) ?? null).catch(() => null),
    zoomNativoEsri(lat, lng),
  ]);
  if (opcoes.cancelado?.()) return null;
  const sat = token
    ? { tiles: [urlSateliteMapbox(token)], tileSize: 512, maxzoom: 22, attribution: ATRIBUICAO_MAPBOX }
    // retina: ladrilho de 128 px → a tela pede o nível seguinte (foto 2× mais densa) até o zoom nativo
    : { tiles: [`${ESRI_IMAGERY}/tile/{z}/{y}/{x}`], tileSize: retina ? 128 : 256, maxzoom: zNativo, attribution: "Imagens © Esri, Maxar, Earthstar Geographics" };
  const map = new ml.Map({
    container, style: estiloBase(sat, retina), bounds: [[b0, b1], [b2, b3]],
    fitBoundsOptions: { padding: 32 }, maxZoom: token ? 21 : zNativo + 2, attributionControl: false,
  });
  map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
  map.addControl(new ml.AttributionControl({ compact: true, customAttribution: opcoes.atribuicao }), "bottom-right");
  // atribuição começa recolhida (no celular ela cobria metade do mapa); o "i" abre
  map.once("load", () => container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
  return { map, info: token ? "Satélite Mapbox (Maxar)" : `Satélite Esri · foto até o nível ${zNativo}` };
}

/** Alterna entre satélite (com ruas e rótulos) e mapa de ruas. */
export function aplicarBase(map: MapaMl, base: BaseMapa) {
  const sat = base === "satelite" ? "visible" : "none";
  for (const id of ["satelite", "ruasRef", "rotulos"]) map.setLayoutProperty(id, "visibility", sat);
  map.setLayoutProperty("osm", "visibility", base === "ruas" ? "visible" : "none");
}
