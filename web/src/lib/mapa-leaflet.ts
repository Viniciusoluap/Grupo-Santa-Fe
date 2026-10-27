/**
 * Lote 02, correção 05 — montagem do Mapa Operacional no Leaflet: satélite Esri
 * com ruas/rótulos ou mapa OSM (controle Satélite/Mapa), alfinetes SVG por
 * tipo/status, agrupamento que se separa no zoom (leaflet.markercluster) com
 * pontos sobrepostos abertos em leque (spiderfy) e enquadramento automático.
 * Gêmeo em Prospecta/client/src/lib/mapa-leaflet.ts (mesmo conteúdo).
 * Só no navegador (carregado por import dinâmico).
 */
import type * as Leaflet from "leaflet";
import { CAMADAS_MAPA, estiloAgrupamento, htmlAlfinete, TAMANHO_ALFINETE, type CategoriaPonto } from "@/lib/mapa-alfinetes";

type L = typeof Leaflet;
export type PontoNoMapa = { lat: number; lng: number; categoria: CategoriaPonto; popup: HTMLElement | string; aoClicar?: () => void };

/** Leaflet + plugin de agrupamento. Sem o plugin (falha de carga), os alfinetes entram soltos. */
export async function carregarLeaflet(): Promise<{ L: L; agrupa: boolean }> {
  const L = (await import("leaflet")).default;
  try {
    // O plugin estende o `L` global (UMD): expor a mesma instância antes de carregá-lo.
    (window as unknown as { L?: L }).L = L;
    await import("leaflet.markercluster");
    return { L, agrupa: typeof (L as unknown as { markerClusterGroup?: unknown }).markerClusterGroup === "function" };
  } catch {
    return { L, agrupa: false };
  }
}

/** Camadas base com controle Satélite/Mapa. Satélite é o padrão. */
export function adicionarCamadas(L: L, mapa: Leaflet.Map, aoFalhar: () => void) {
  const opcoes = (c: { attribution: string; maxNativeZoom: number }) => ({ attribution: c.attribution, maxNativeZoom: c.maxNativeZoom, maxZoom: CAMADAS_MAPA.maxZoom });
  const imagem = L.tileLayer(CAMADAS_MAPA.satelite.url, opcoes(CAMADAS_MAPA.satelite));
  imagem.on("tileerror", aoFalhar);
  const satelite = L.layerGroup([
    imagem,
    L.tileLayer(CAMADAS_MAPA.ruas.url, opcoes(CAMADAS_MAPA.ruas)),
    L.tileLayer(CAMADAS_MAPA.rotulos.url, opcoes(CAMADAS_MAPA.rotulos)),
  ]);
  const ruas = L.tileLayer(CAMADAS_MAPA.mapa.url, opcoes(CAMADAS_MAPA.mapa));
  ruas.on("tileerror", aoFalhar);
  satelite.addTo(mapa);
  L.control.layers({ "Satélite": satelite, "Mapa": ruas }, undefined, { collapsed: false, position: "topright" }).addTo(mapa);
}

/** Grupo de pontos: agrupamento com spiderfy quando o plugin carregou; senão, camada simples. */
export function criarGrupoDePontos(L: L, agrupa: boolean): Leaflet.FeatureGroup {
  if (!agrupa) return L.featureGroup();
  return L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 48,
    iconCreateFunction: (cluster) => {
      const { texto, tamanho } = estiloAgrupamento(cluster.getChildCount());
      return L.divIcon({
        className: "",
        html: `<div style="width:${tamanho}px;height:${tamanho}px;border-radius:9999px;background:#1A2332;color:#fff;border:3px solid #C9A961;display:flex;align-items:center;justify-content:center;font:700 13px sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.4)" aria-label="${texto} pontos agrupados">${texto}</div>`,
        iconSize: [tamanho, tamanho],
      });
    },
  });
}

export function alfinete(L: L, p: PontoNoMapa): Leaflet.Marker {
  const { largura, altura } = TAMANHO_ALFINETE;
  const icone = L.divIcon({ className: "", html: htmlAlfinete(p.categoria), iconSize: [largura, altura], iconAnchor: [largura / 2, altura], popupAnchor: [0, -altura + 4] });
  const m = L.marker([p.lat, p.lng], { icon: icone, riseOnHover: true }).bindPopup(p.popup, { maxWidth: 240 });
  if (p.aoClicar) m.on("click", p.aoClicar);
  return m;
}

/** Enquadra todos os pontos (um só ponto: zoom de rua). */
export function enquadrar(L: L, mapa: Leaflet.Map, pontos: { lat: number; lng: number }[]) {
  if (!pontos.length) return;
  if (pontos.length === 1) { mapa.setView([pontos[0].lat, pontos[0].lng], 17); return; }
  mapa.fitBounds(L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 17 });
}
