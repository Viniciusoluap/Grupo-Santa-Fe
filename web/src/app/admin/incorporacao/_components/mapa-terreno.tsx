"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, Polygon, LineString } from "geojson";
import {
  bbox as turfBbox, buffer as turfBuffer, lineString, polygon as turfPolygon,
  intersect, difference, featureCollection, area as turfArea,
  length as turfLength, polygonToLine,
} from "@turf/turf";
import { salvarApp } from "@/lib/actions/incorporacao";

// Mapa do terreno com base de SATÉLITE colorida (Esri World Imagery, keyless) e
// camadas de estudo sobre o KML: cursos d'água/nascentes, APP (faixa de proteção
// calculada por buffer dos rios), rodovias e linhas de transmissão — obtidas do
// OpenStreetMap via Overpass API (sem chave). Tudo best-effort: se o Overpass
// não responder, o mapa continua mostrando o terreno normalmente.
//
// A área de APP dentro do terreno é sempre calculada automaticamente aqui e
// salva no estudo (salvarApp) assim que o cálculo termina — sem exigir nenhuma
// ação do usuário — para alimentar a aba Viabilidade (regra: "área de APP
// sempre tem que ser calculada automaticamente").

interface Props {
  geojson: string; // Feature<Polygon> serializado
  center?: [number, number]; // [lat, lng]
  height?: number;
  estudoId?: string; // quando informado, persiste a APP calculada automaticamente
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
}

type Ponto = [number, number]; // [lng, lat]

function mesmoPonto(a: Ponto, b: Ponto): boolean {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

/** Costura trechos de way (relações multipolígono do OSM) em anéis fechados. */
function montarAneis(trechos: Ponto[][]): Ponto[][] {
  const pendentes = trechos.filter((t) => t.length > 1).map((t) => [...t]);
  const aneis: Ponto[][] = [];
  while (pendentes.length > 0) {
    const anel = pendentes.shift()!;
    let fechado = mesmoPonto(anel[0], anel[anel.length - 1]);
    let progrediu = true;
    while (!fechado && progrediu) {
      progrediu = false;
      const fim = anel[anel.length - 1];
      for (let i = 0; i < pendentes.length; i++) {
        const w = pendentes[i];
        if (mesmoPonto(w[0], fim)) {
          anel.push(...w.slice(1));
        } else if (mesmoPonto(w[w.length - 1], fim)) {
          anel.push(...[...w].reverse().slice(1));
        } else {
          continue;
        }
        pendentes.splice(i, 1);
        progrediu = true;
        break;
      }
      fechado = mesmoPonto(anel[0], anel[anel.length - 1]);
    }
    if (fechado && anel.length >= 4) aneis.push(anel);
  }
  return aneis;
}

const CORES = {
  terreno: "#F5C400",
  agua: "#38bdf8",
  app: "#22c55e",
  rodovia: "#f97316",
  transmissao: "#ef4444",
  nascente: "#0ea5e9",
};

// Largura da APP hídrica conforme o Código Florestal (Lei 12.651/2012, Art. 4º, I),
// em função da largura do curso d'água. Legislação municipal pode ser mais
// restritiva (ex.: Imperatriz/MA aplica 500 m na margem do Tocantins) — por isso
// o usuário pode forçar uma largura no seletor.
function larguraAppCodigoFlorestal(larguraRioM: number): number {
  if (larguraRioM < 10) return 30;
  if (larguraRioM < 50) return 50;
  if (larguraRioM < 200) return 100;
  if (larguraRioM < 600) return 200;
  return 500;
}

type AppModo = "auto" | "30" | "50" | "100" | "200" | "500";

export function MapaTerreno({ geojson, center, height = 420, estudoId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [carregandoCamadas, setCarregandoCamadas] = useState(false);
  const [resumo, setResumo] = useState<{ agua: number; nascentes: number; rodovias: number; transmissao: number } | null>(null);
  const [appModo, setAppModo] = useState<AppModo>("auto");
  const [appCalculada, setAppCalculada] = useState<{ areaM2: number; larguraM: number | null } | null>(null);

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
      // Além das LINHAS de curso d'água, busca também os POLÍGONOS de água
      // (rios largos como o Tocantins são mapeados como natural=water/riverbank,
      // não como linha) — sem eles a faixa de APP na margem do rio não aparecia.
      const query =
        `[out:json][timeout:25];(` +
        `way["waterway"](${minY},${minX},${maxY},${maxX});` +
        `way["natural"="water"](${minY},${minX},${maxY},${maxX});` +
        `way["waterway"="riverbank"](${minY},${minX},${maxY},${maxX});` +
        `relation["natural"="water"](${minY},${minX},${maxY},${maxX});` +
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
          const linhasAgua: { geom: LineString; tipo: string; larguraTag: number | null }[] = [];
          const aneisAgua: Ponto[][] = [];
          // Acumula a área de APP DENTRO do terreno — calculada automaticamente,
          // sem qualquer ação do usuário, para alimentar a aba Viabilidade.
          let appAreaTotalM2 = 0;
          let appLarguraMax: number | null = null;

          for (const el of data.elements) {
            const tags = el.tags ?? {};
            if (el.type === "node" && tags.natural === "spring" && el.lat != null && el.lon != null) {
              L.circleMarker([el.lat, el.lon], { radius: 5, color: CORES.nascente, fillColor: CORES.nascente, fillOpacity: 0.9, weight: 1 })
                .bindTooltip("Nascente").addTo(map);
              contagem.nascentes++;
              continue;
            }
            // Relações multipolígono de água (rios grandes): costura os trechos
            // externos em anéis fechados.
            if (el.type === "relation" && tags.natural === "water" && el.members) {
              const trechos = el.members
                .filter((m) => m.type === "way" && (m.role === "outer" || !m.role) && m.geometry && m.geometry.length > 1)
                .map((m) => m.geometry!.map((g) => [g.lon, g.lat] as Ponto));
              aneisAgua.push(...montarAneis(trechos));
              continue;
            }
            if (el.type === "way" && el.geometry && el.geometry.length > 1) {
              const latlngs = el.geometry.map((g) => [g.lat, g.lon] as [number, number]);
              const eAguaPoligono = tags.natural === "water" || tags.waterway === "riverbank";
              if (eAguaPoligono) {
                const anel = el.geometry.map((g) => [g.lon, g.lat] as Ponto);
                if (!mesmoPonto(anel[0], anel[anel.length - 1])) anel.push(anel[0]);
                if (anel.length >= 4) aneisAgua.push(anel);
              } else if (tags.waterway) {
                L.polyline(latlngs, { color: CORES.agua, weight: 2.5 }).bindTooltip("Curso d'água").addTo(map);
                contagem.agua++;
                linhasAgua.push({
                  geom: lineString(el.geometry.map((g) => [g.lon, g.lat])).geometry,
                  tipo: tags.waterway,
                  larguraTag: tags.width ? parseFloat(tags.width) || null : null,
                });
              } else if (tags.highway) {
                L.polyline(latlngs, { color: CORES.rodovia, weight: 2, opacity: 0.8 }).bindTooltip("Via/Rodovia").addTo(map);
                contagem.rodovias++;
              } else if (tags.power) {
                L.polyline(latlngs, { color: CORES.transmissao, weight: 2, dashArray: "6 4" }).bindTooltip("Linha de transmissão").addTo(map);
                contagem.transmissao++;
              }
            }
          }

          // Corpos d'água (polígonos): desenha a lâmina d'água e a faixa de APP
          // medida a partir da MARGEM. Largura da APP: automática pelo Código
          // Florestal (estimando a largura do rio por área/perímetro) ou forçada
          // pelo usuário no seletor (ex.: 500 m — lei municipal de Imperatriz).
          for (const anel of aneisAgua) {
            try {
              const agua = turfPolygon([anel]);
              L.geoJSON(agua, { style: { color: CORES.agua, weight: 1.5, fillColor: CORES.agua, fillOpacity: 0.3 } })
                .bindTooltip("Corpo d'água").addTo(map);
              contagem.agua++;

              // Largura média ≈ 2 × área / perímetro (boa aproximação p/ formas alongadas).
              const areaM2 = turfArea(agua);
              const perimetroKm = turfLength(polygonToLine(agua) as Feature, { units: "kilometers" });
              const larguraRioM = perimetroKm > 0 ? (2 * areaM2) / (perimetroKm * 1000) : 0;
              const w = appModo === "auto" ? larguraAppCodigoFlorestal(larguraRioM) : Number(appModo);

              const faixaTotal = turfBuffer(agua, w, { units: "meters" });
              if (!faixaTotal) continue;
              const banda = difference(featureCollection([faixaTotal as Feature<Polygon>, agua])) ?? faixaTotal;
              const origem = appModo === "auto"
                ? `Código Florestal — rio com ~${Math.round(larguraRioM)} m de largura`
                : "largura definida manualmente";
              L.geoJSON(banda, { style: { color: CORES.app, weight: 1, fillColor: CORES.app, fillOpacity: 0.3 } })
                .bindTooltip(`APP ${w} m da margem (${origem})`).addTo(map);

              // Só conta a parte da faixa que cai DENTRO do terreno.
              const bandaDentro = intersect(featureCollection([banda as Feature<Polygon>, feature]));
              if (bandaDentro) appAreaTotalM2 += turfArea(bandaDentro);
              appLarguraMax = appLarguraMax == null ? w : Math.max(appLarguraMax, w);
            } catch {
              /* anel degenerado — ignora */
            }
          }

          // APP dos cursos d'água em LINHA: usa a tag width do OSM quando existir;
          // sem tag, assume rio (10–50 m → APP 50 m) ou córrego (<10 m → APP 30 m).
          for (const { geom, tipo, larguraTag } of linhasAgua) {
            try {
              const w =
                appModo !== "auto" ? Number(appModo)
                : larguraTag != null ? larguraAppCodigoFlorestal(larguraTag)
                : tipo === "river" ? 50
                : 30;
              const faixa = turfBuffer(geom, w, { units: "meters" });
              if (!faixa) continue;
              const dentro = intersect(featureCollection([faixa as Feature<Polygon>, feature]));
              const alvo = dentro ?? faixa;
              L.geoJSON(alvo, { style: { color: CORES.app, weight: 1, fillColor: CORES.app, fillOpacity: 0.25 } })
                .bindTooltip(`APP ${w} m (${appModo === "auto" ? "Código Florestal" : "manual"})`).addTo(map);

              if (dentro) appAreaTotalM2 += turfArea(dentro);
              appLarguraMax = appLarguraMax == null ? w : Math.max(appLarguraMax, w);
            } catch {
              /* buffer/interseção pode falhar em geometrias degeneradas */
            }
          }

          if (!cancelled) {
            setResumo(contagem);
            setAppCalculada({ areaM2: appAreaTotalM2, larguraM: appLarguraMax });
            if (estudoId) {
              salvarApp(estudoId, {
                areaM2: appAreaTotalM2,
                larguraM: appLarguraMax,
                origem: appModo,
              }).catch(() => { /* melhor esforço — não bloqueia a visualização do mapa */ });
            }
          }
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
  }, [geojson, center, appModo, estudoId]);

  return (
    <div className="space-y-2">
      <div ref={ref} style={{ height, width: "100%" }} className="border border-gray-200" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {[
          { c: CORES.terreno, l: "Terreno" },
          { c: CORES.agua, l: "Curso d'água" },
          { c: CORES.app, l: "APP hídrica" },
          { c: CORES.nascente, l: "Nascente" },
          { c: CORES.rodovia, l: "Rodovia" },
          { c: CORES.transmissao, l: "L. transmissão" },
        ].map(({ c, l }) => (
          <span key={l} className="flex items-center gap-1">
            <span className="inline-block w-3 h-2" style={{ background: c }} /> {l}
          </span>
        ))}
        <label className="flex items-center gap-1.5">
          <span className="text-gray-400">Faixa de APP:</span>
          <select
            value={appModo}
            onChange={(e) => setAppModo(e.target.value as AppModo)}
            className="border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-[var(--brand-yellow)]"
          >
            <option value="auto">Automática (Código Florestal)</option>
            <option value="30">30 m</option>
            <option value="50">50 m</option>
            <option value="100">100 m</option>
            <option value="200">200 m</option>
            <option value="500">500 m (ex.: lei municipal de Imperatriz)</option>
          </select>
        </label>
        {carregandoCamadas && <span className="text-gray-400">carregando camadas…</span>}
        {resumo && !carregandoCamadas && (
          <span className="text-gray-400">
            {resumo.agua} cursos d&apos;água · {resumo.nascentes} nascentes · {resumo.rodovias} vias · {resumo.transmissao} linhas AT
          </span>
        )}
      </div>
      {appCalculada && !carregandoCamadas && (
        <p className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1.5">
          APP calculada automaticamente dentro do terreno: {Math.round(appCalculada.areaM2).toLocaleString("pt-BR")} m²
          {appCalculada.larguraM != null && ` (faixa de ${appCalculada.larguraM} m)`} — já enviada para a aba Viabilidade.
        </p>
      )}
      <p className="text-[10px] text-gray-400">
        Largura automática conforme o Código Florestal (Lei 12.651/2012, Art. 4º): rios com menos de 10 m → 30 m; 10–50 m → 50 m; 50–200 m → 100 m; 200–600 m → 200 m; acima de 600 m → 500 m — estimada pela geometria do rio. Legislação municipal pode ser mais restritiva (ex.: Imperatriz/MA aplica 500 m na margem do Tocantins) — nesse caso selecione a faixa manualmente. Confirme sempre com o órgão ambiental competente. A área de APP dentro do terreno é sempre recalculada e salva automaticamente.
      </p>
    </div>
  );
}
