// Camadas de fundo dos mapas da Incorporação (Terreno e Estudo de Massa) —
// Lote 2, correção 10 (mesma decisão do mapa operacional, AD-09): satélite Esri
// World Imagery + referência de ruas e rótulos por cima, com alternância para o
// mapa de ruas (OpenStreetMap), escala métrica e atribuição. Sem chave de API.
import type * as Leaflet from "leaflet";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export function adicionarCamadasBase(L: typeof Leaflet, map: Leaflet.Map) {
  // Esri não tem foto acima do zoom 17 em boa parte do interior; acima disso o
  // Leaflet amplia o ladrilho 17 (sem o aviso "Map data not yet available").
  const satelite = L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
    attribution: "Imagens © Esri, Maxar, Earthstar Geographics", maxZoom: 20, maxNativeZoom: 17,
  });
  const ruas = L.tileLayer(`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, {
    attribution: "Ruas © Esri", maxZoom: 20, maxNativeZoom: 18, opacity: 0.9,
  });
  const rotulos = L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, {
    attribution: "Rótulos © Esri", maxZoom: 20, maxNativeZoom: 18,
  });
  const sateliteComRuas = L.layerGroup([satelite, ruas, rotulos]);
  const mapaRuas = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap", maxZoom: 20, maxNativeZoom: 19,
  });
  sateliteComRuas.addTo(map);
  L.control.layers({ "Satélite + ruas": sateliteComRuas, "Ruas (OpenStreetMap)": mapaRuas }, undefined, { position: "topright", collapsed: false }).addTo(map);
  L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);
}
