"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeoJSONSource, Map as MapaMl, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { area as turfArea, bbox as turfBbox, featureCollection } from "@turf/turf";
import {
  ESRI_IMAGERY, IDS_CAMADAS, calcularApp, calcularServidao, calcularVegetacao, fmtKm, fmtPct, linhasOsmComplementares,
  resumirFuros, zoomNativoEsri, type AppModo, type Contorno, type DadosCamadas, type DadosHidro, type EstadoCamada, type IdCamada,
} from "@/lib/geo/camadas-terreno";
import { ATRIBUICAO_MAPBOX, urlSateliteMapbox } from "@/lib/geo/mapbox-token";
import { salvarApp } from "@/lib/actions/incorporacao";
import { formatArea } from "@/lib/utils";

// Mapa do terreno — pedido do dono de 11/11 ("sem nitidez, não busca APP, supressão
// vegetal, faixa de servidão…"). Motor MapLibre GL (o mesmo do Mapbox GL usado pelo
// concorrente, código aberto e sem chave) com satélite Esri no zoom nativo REAL da
// região (consultado no tilemap) e ladrilhos em dobro em tela retina; com token
// público do Mapbox salvo em Admin › Integrações, usa o satélite do Mapbox.
// As camadas vêm do servidor (/api/incorporacao/camadas-terreno), uma por vez: cada
// item da legenda tem estado próprio (carregada / sem ocorrência / indisponível com
// "tentar de novo") — nunca mais "carregando camadas…" eterno.
//
// A APP dentro do terreno continua calculada automaticamente e salva no estudo
// (salvarApp) para a Viabilidade e o Relatório Executivo — mesma regra de antes.
// Gêmeo de Prospecta/client/src/components/incorporacao/estudo/mapa-terreno.tsx.

interface Props {
  geojson: string;
  center?: [number, number]; // [lat, lng]
  height?: number;
  estudoId?: string; // quando informado, persiste a APP calculada automaticamente
}

const CORES = {
  terreno: "#F5C400", agua: "#38bdf8", rio: "#0ea5e9", nascente: "#0284c7", app: "#22c55e", vegetacao: "#166534",
  servidao: "#ef4444", transmissao: "#dc2626", rodovia: "#f97316", via: "#fdba74", uc: "#a855f7", furo: "#6366f1",
};

const ROTA_CAMADAS = "/api/incorporacao/camadas-terreno";
const ROTA_MAPA_BASE = "/api/incorporacao/mapa-base";

type Estado<K extends IdCamada> = EstadoCamada<DadosCamadas[K]> | { estado: "carregando" };
type Estados = { [K in IdCamada]: Estado<K> };

const vazioFc = (): FeatureCollection => featureCollection([]) as FeatureCollection;
const fc = (feats: (Feature<Geometry> | null | undefined)[]): FeatureCollection => featureCollection(feats.filter(Boolean) as Feature<Geometry>[]) as FeatureCollection;
const dados = <K extends IdCamada>(e: Estado<K>): DadosCamadas[K] | undefined => ("dados" in e ? e.dados : undefined);
const respondeu = (e: { estado: string }) => e.estado === "ok" || e.estado === "vazio";
const ESTADOS_INICIAIS = Object.fromEntries(IDS_CAMADAS.map(id => [id, { estado: "carregando" }])) as Estados;

async function buscarCamada(id: IdCamada, contorno: Contorno, novamente: boolean): Promise<EstadoCamada<unknown>> {
  try {
    const r = await fetch(ROTA_CAMADAS, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geojson: contorno, ids: [id], novamente }), signal: AbortSignal.timeout(60_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { estado: "indisponivel", fonte: "servidor do sistema", consultadoEm: new Date().toISOString(), erro: j?.error ?? `HTTP ${r.status}` };
    return j.camadas?.[id] ?? { estado: "indisponivel", fonte: "servidor do sistema", consultadoEm: new Date().toISOString(), erro: "resposta sem a camada" };
  } catch {
    return { estado: "indisponivel", fonte: "servidor do sistema", consultadoEm: new Date().toISOString(), erro: "sem resposta do servidor" };
  }
}

function estiloBase(sat: { tiles: string[]; tileSize: number; maxzoom: number; attribution: string }, retina: boolean): StyleSpecification {
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

/** Fontes e camadas vetoriais (ordem de desenho de baixo para cima). */
const FONTES_VETOR = ["ucs", "vegetacao", "servidao", "app", "agua", "rios", "vias", "rodovias", "transmissao", "terreno", "nascentes", "furos"] as const;

function adicionarCamadasVetor(map: MapaMl) {
  for (const id of FONTES_VETOR) map.addSource(id, { type: "geojson", data: vazioFc() });
  map.addLayer({ id: "ucs-fill", type: "fill", source: "ucs", paint: { "fill-color": CORES.uc, "fill-opacity": 0.15 } });
  map.addLayer({ id: "ucs-line", type: "line", source: "ucs", paint: { "line-color": CORES.uc, "line-width": 1.5, "line-dasharray": [3, 2] } });
  map.addLayer({ id: "vegetacao", type: "fill", source: "vegetacao", paint: { "fill-color": CORES.vegetacao, "fill-opacity": 0.45 } });
  map.addLayer({ id: "servidao", type: "fill", source: "servidao", paint: { "fill-color": CORES.servidao, "fill-opacity": 0.22 } });
  map.addLayer({ id: "app-fill", type: "fill", source: "app", paint: { "fill-color": CORES.app, "fill-opacity": 0.32 } });
  map.addLayer({ id: "app-line", type: "line", source: "app", paint: { "line-color": CORES.app, "line-width": 1 } });
  map.addLayer({ id: "agua", type: "fill", source: "agua", paint: { "fill-color": CORES.agua, "fill-opacity": 0.35 } });
  map.addLayer({ id: "rios", type: "line", source: "rios", paint: { "line-color": CORES.rio, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 18, 3.5] } });
  map.addLayer({ id: "vias", type: "line", source: "vias", paint: { "line-color": CORES.via, "line-width": 1.5, "line-opacity": 0.8 } });
  map.addLayer({ id: "rodovias", type: "line", source: "rodovias", paint: { "line-color": CORES.rodovia, "line-width": 3 } });
  map.addLayer({ id: "transmissao", type: "line", source: "transmissao", paint: { "line-color": CORES.transmissao, "line-width": 2.5, "line-dasharray": [2, 1.5] } });
  map.addLayer({ id: "terreno-fill", type: "fill", source: "terreno", paint: { "fill-color": CORES.terreno, "fill-opacity": 0.1 } });
  map.addLayer({ id: "terreno-line", type: "line", source: "terreno", paint: { "line-color": CORES.terreno, "line-width": 3 } });
  map.addLayer({ id: "nascentes", type: "circle", source: "nascentes", paint: { "circle-radius": 5, "circle-color": CORES.nascente, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
  map.addLayer({ id: "furos", type: "circle", source: "furos", paint: { "circle-radius": 5, "circle-color": CORES.furo, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
}

export function MapaTerreno({ geojson, center, height = 420, estudoId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapaMl | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [base, setBase] = useState<"satelite" | "ruas">("satelite");
  const [infoBase, setInfoBase] = useState<string | null>(null);
  const [appModo, setAppModo] = useState<AppModo>("auto");
  // estados guardados junto do terreno a que pertencem: trocar o KML volta tudo a "consultando…"
  const [porTerreno, setPorTerreno] = useState<{ geojson: string; estados: Estados } | null>(null);
  const ultimoSalvo = useRef<string | null>(null);
  const centroLat = center?.[0], centroLng = center?.[1];

  const contorno = useMemo<Contorno | null>(() => {
    try {
      const f = JSON.parse(geojson) as Contorno; // Feature<Polygon> do KML (Feature<Polygon|MultiPolygon> também serve)
      return f?.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") ? f : null;
    } catch { return null; }
  }, [geojson]);

  // ─── Mapa base (MapLibre) ────────────────────────────────────────────────
  useEffect(() => {
    if (!contorno || !ref.current) return;
    let cancelado = false;
    let map: MapaMl | null = null;
    (async () => {
      const [b0, b1, b2, b3] = turfBbox(contorno);
      const lat = centroLat ?? (b1 + b3) / 2, lng = centroLng ?? (b0 + b2) / 2;
      const retina = typeof window !== "undefined" && window.devicePixelRatio >= 1.5;
      const [ml, token, zNativo] = await Promise.all([
        import("maplibre-gl").then(m => m.default ?? m),
        fetch(ROTA_MAPA_BASE, { credentials: "include", signal: AbortSignal.timeout(5000) }).then(r => (r.ok ? r.json() : null)).then(j => (j?.mapboxToken as string | null) ?? null).catch(() => null),
        zoomNativoEsri(lat, lng),
      ]);
      if (cancelado || !ref.current) return;
      const sat = token
        ? { tiles: [urlSateliteMapbox(token)], tileSize: 512, maxzoom: 22, attribution: ATRIBUICAO_MAPBOX }
        // retina: ladrilho de 128 px → a tela pede o nível seguinte (foto 2× mais densa) até o zoom nativo
        : { tiles: [`${ESRI_IMAGERY}/tile/{z}/{y}/{x}`], tileSize: retina ? 128 : 256, maxzoom: zNativo, attribution: "Imagens © Esri, Maxar, Earthstar Geographics" };
      setInfoBase(token ? "Satélite Mapbox (Maxar)" : `Satélite Esri · foto até o nível ${zNativo}`);
      map = new ml.Map({
        container: ref.current, style: estiloBase(sat, retina), bounds: [[b0, b1], [b2, b3]],
        fitBoundsOptions: { padding: 32 }, maxZoom: token ? 21 : zNativo + 2, attributionControl: false,
      });
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
      map.addControl(new ml.AttributionControl({ compact: true, customAttribution: "Camadas: ANA, IBAMA/CNUC, EPE, DNIT, SGB/CPRM, MapBiomas, © OpenStreetMap" }), "bottom-right");
      map.on("load", () => {
        if (cancelado || !map) return;
        adicionarCamadasVetor(map);
        // atribuição começa recolhida (no celular ela cobria metade do mapa); o "i" abre
        ref.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        (map.getSource("terreno") as GeoJSONSource).setData(contorno);
        mapRef.current = map;
        setMapaPronto(true);
      });
    })();
    return () => {
      cancelado = true;
      setMapaPronto(false);
      mapRef.current = null;
      map?.remove();
    };
  }, [contorno, centroLat, centroLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapaPronto) return;
    const sat = base === "satelite" ? "visible" : "none";
    for (const id of ["satelite", "ruasRef", "rotulos"]) map.setLayoutProperty(id, "visibility", sat);
    map.setLayoutProperty("osm", "visibility", base === "ruas" ? "visible" : "none");
  }, [base, mapaPronto]);

  // ─── Camadas (servidor, uma por vez) ─────────────────────────────────────
  const estados: Estados = porTerreno?.geojson === geojson ? porTerreno.estados : ESTADOS_INICIAIS;
  const gravar = useCallback((id: IdCamada, e: Estado<IdCamada>) => {
    setPorTerreno(p => ({ geojson, estados: { ...(p?.geojson === geojson ? p.estados : ESTADOS_INICIAIS), [id]: e } as Estados }));
  }, [geojson]);
  const buscar = useCallback((ids: readonly IdCamada[], novamente = false) => {
    if (!contorno) return () => undefined;
    let cancelado = false;
    for (const id of ids) void buscarCamada(id, contorno, novamente).then(r => { if (!cancelado) gravar(id, r as Estado<IdCamada>); });
    return () => { cancelado = true; };
  }, [contorno, gravar]);
  /** Botão "tentar de novo": volta a camada a "consultando…" e ignora o cache do servidor. */
  const carregar = (ids: readonly IdCamada[], novamente = false) => {
    for (const id of ids) gravar(id, { estado: "carregando" });
    buscar(ids, novamente);
  };

  useEffect(() => buscar(IDS_CAMADAS), [buscar]);

  // ─── Cálculos (APP depende do seletor) ───────────────────────────────────
  const hidro = dados(estados.hidrografia), osm = dados(estados.osm);
  const fontesHidro = [hidro, osm].filter(Boolean) as DadosHidro[];
  const hidroRespondeu = respondeu(estados.hidrografia) || respondeu(estados.osm);
  const hidroPendente = estados.hidrografia.estado === "carregando" || estados.osm.estado === "carregando";
  const app = useMemo(() => (contorno && hidroRespondeu ? calcularApp(contorno, fontesHidro, appModo) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contorno, hidro, osm, appModo, hidroRespondeu]);
  const veg = useMemo(() => { const d = dados(estados.vegetacao); return contorno && d ? calcularVegetacao(contorno, d) : null; }, [contorno, estados.vegetacao]);
  const linhasOficiais = dados(estados.transmissao)?.linhas;
  const rodovias = dados(estados.rodovias)?.rodovias;
  const linhasTodas = useMemo(() => [...(linhasOficiais ?? []), ...linhasOsmComplementares(linhasOficiais ?? [], osm?.linhas ?? [])], [linhasOficiais, osm]);
  const servidao = useMemo(() => (contorno ? calcularServidao(contorno, linhasTodas, rodovias ?? []) : null), [contorno, linhasTodas, rodovias]);
  const furos = useMemo(() => { const d = dados(estados.furos); return d ? resumirFuros(d) : null; }, [estados.furos]);
  const areaTerreno = contorno ? turfArea(contorno) : 0;

  // APP salva automaticamente no estudo (Viabilidade/Relatório) — só quando alguma
  // fonte de hidrografia respondeu (não grava zero por falha de rede) e mudou.
  useEffect(() => {
    if (!estudoId || !app || hidroPendente) return;
    const chave = `${estudoId}|${Math.round(app.areaM2)}|${app.larguraM}|${appModo}`;
    if (ultimoSalvo.current === chave) return;
    ultimoSalvo.current = chave;
    salvarApp(estudoId, { areaM2: app.areaM2, larguraM: app.larguraM, origem: appModo }).catch(() => { /* melhor esforço */ });
  }, [estudoId, app, appModo, hidroPendente]);

  // ─── Desenho ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapaPronto) return;
    const set = (id: (typeof FONTES_VETOR)[number], data: FeatureCollection) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
    set("agua", fc([...(hidro?.aguas ?? []), ...(osm?.aguas ?? [])]));
    set("rios", fc([...(hidro?.rios ?? []), ...(osm?.rios ?? [])]));
    set("nascentes", fc([...(hidro?.nascentes ?? []), ...(osm?.nascentes ?? [])]));
    set("app", fc([app?.faixa]));
    set("vegetacao", fc((dados(estados.vegetacao)?.celulas ?? []).filter(c => c.properties.nativa)));
    set("servidao", fc([servidao?.faixa]));
    set("transmissao", fc(linhasTodas));
    set("rodovias", fc(rodovias ?? []));
    set("vias", fc(osm?.vias ?? []));
    set("ucs", fc(dados(estados.ucs)?.geometrias ?? []));
    set("furos", fc((dados(estados.furos)?.pocos ?? []).map(p => ({ type: "Feature", properties: { nome: p.nome }, geometry: { type: "Point", coordinates: p.coordenadas } }) as Feature<Geometry>)));
  }, [mapaPronto, hidro, osm, app, servidao, linhasTodas, rodovias, estados.vegetacao, estados.ucs, estados.furos]);

  if (!contorno) return <p className="text-xs text-red-500">Não foi possível ler o polígono do terreno.</p>;

  const ucs = dados(estados.ucs);
  const geo = dados(estados.geologia);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div ref={ref} style={{ height, width: "100%" }} className="border border-gray-200 bg-gray-100" data-testid="mapa-terreno" />
        <div className="absolute left-2 top-2 flex overflow-hidden border border-gray-300 bg-white text-[11px] font-bold shadow-sm">
          {(["satelite", "ruas"] as const).map(b => (
            <button key={b} type="button" onClick={() => setBase(b)}
              className={`px-2.5 py-1 ${base === b ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-600 hover:bg-gray-50"}`}>
              {b === "satelite" ? "Satélite" : "Ruas"}
            </button>
          ))}
        </div>
      </div>
      {infoBase && <p className="text-[10px] text-gray-400">{infoBase}</p>}

      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 border border-gray-100 bg-white p-3 text-[12px] md:grid-cols-2" data-testid="legenda-terreno">
        <Linha cor={CORES.terreno} titulo="Terreno" texto={`${(areaTerreno / 10_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`} />
        <Linha cor={CORES.app} titulo="APP" estado={hidroPendente && !app ? "carregando" : hidroRespondeu ? "ok" : "indisponivel"}
          texto={app ? `${fmtPct(app.percentual)} do terreno · ${formatArea(app.areaM2)}${app.larguraM != null ? ` · faixa até ${app.larguraM} m` : ""}` : "sem hidrografia para calcular"}
          extra={
            <select value={appModo} onChange={e => setAppModo(e.target.value as AppModo)} aria-label="Faixa de APP"
              className="ml-1 border border-gray-200 bg-white px-1 py-0.5 text-[11px] focus:border-[var(--brand-yellow)] focus:outline-none">
              <option value="auto">Automática (Código Florestal)</option>
              <option value="30">30 m</option><option value="50">50 m</option><option value="100">100 m</option>
              <option value="200">200 m</option><option value="500">500 m (ex.: lei municipal de Imperatriz)</option>
            </select>
          } />
        <LinhaCamada cor={CORES.rio} titulo="Rios e cursos d'água (ANA/DNIT)" e={estados.hidrografia} onRetry={() => carregar(["hidrografia"], true)}
          ok={d => `${d.rios.length} trecho(s) · ${d.aguas.length} lâmina(s) d'água${d.aguas[0]?.properties.nome ? ` (${d.aguas[0].properties.nome})` : ""} · ${d.nascentes.length} nascente(s)`}
          vazio="nenhum curso d'água oficial a 600 m" />
        <LinhaCamada cor={CORES.via} titulo="OpenStreetMap (complemento)" e={estados.osm} onRetry={() => carregar(["osm"], true)}
          ok={d => `${d.rios.length + d.aguas.length} feição(ões) de água · ${d.nascentes.length} nascente(s) · ${d.vias.length} via(s) · ${d.linhas.length} linha(s)`}
          vazio="nada mapeado no entorno" />
        <LinhaCamada cor={CORES.vegetacao} titulo="Vegetação nativa (supressão)" e={estados.vegetacao} onRetry={() => carregar(["vegetacao"], true)}
          ok={() => veg ? `${fmtPct(veg.percentualNativa)} do terreno (${formatArea(veg.areaNativaM2)}) · florestal ${fmtPct(veg.percentualFlorestal)} · ${veg.amostras} amostras` : ""}
          vazio="sem amostra no terreno" />
        <Linha cor={CORES.servidao} titulo="Faixa de servidão" estado={estados.transmissao.estado === "carregando" || estados.rodovias.estado === "carregando" ? "carregando" : respondeu(estados.transmissao) || respondeu(estados.rodovias) ? "ok" : "indisponivel"}
          texto={servidao && servidao.itens.length
            ? `${formatArea(servidao.areaM2)} (${fmtPct(servidao.percentual)}) · ${servidao.itens.map(i => `${i.nome} (${i.larguraTotalM} m)`).join(" · ")}`
            : estados.transmissao.estado === "indisponivel" && estados.rodovias.estado === "indisponivel" ? "fontes indisponíveis" : "nenhuma linha de transmissão ou rodovia federal no entorno"} />
        <LinhaCamada cor={CORES.transmissao} titulo="Linhas de transmissão" e={estados.transmissao} onRetry={() => carregar(["transmissao"], true)}
          ok={d => `${d.linhas.length} trecho(s) · ${Array.from(new Set(d.linhas.map(l => (l.properties.tensaoKv ? `${l.properties.tensaoKv} kV` : "tensão n/d")))).join(", ")}`}
          vazio="nenhuma a 250 m" />
        <LinhaCamada cor={CORES.rodovia} titulo="Rodovias federais (DNIT)" e={estados.rodovias} onRetry={() => carregar(["rodovias"], true)}
          ok={d => Array.from(new Set(d.rodovias.map(r => r.properties.nome))).join(", ")} vazio="nenhuma a 250 m" />
        <LinhaCamada cor={CORES.uc} titulo="Unidades de conservação" e={estados.ucs} onRetry={() => carregar(["ucs"], true)}
          ok={() => (ucs?.ucs ?? []).slice(0, 3).map(u => `${u.nome} (${u.sobrepoe ? "sobrepõe o terreno" : fmtKm(u.distanciaM)})`).join(" · ")}
          vazio="nenhuma a 3 km" />
        <LinhaCamada cor="#a16207" titulo="Geologia (SGB/CPRM)" e={estados.geologia} onRetry={() => carregar(["geologia"], true)}
          ok={() => geo ? `${geo.avaliacao.rotulo} — ${geo.avaliacao.motivo}` : ""} vazio="sem unidade mapeada" />
        <LinhaCamada cor={CORES.furo} titulo="Furos por perto (SIAGAS)" e={estados.furos} onRetry={() => carregar(["furos"], true)}
          ok={() => furos ? `${furos.total} furo(s) · ${furos.distanciaMinKm!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}–${furos.distanciaMaxKm!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km${furos.nivelEstaticoMedianoM != null ? ` · água a ~${Math.round(furos.nivelEstaticoMedianoM)} m (mediana)` : ""}` : ""}
          vazio="nenhum poço cadastrado a 5 km" />
      </div>

      {app && !hidroPendente && estudoId && (
        <p className="border border-green-100 bg-green-50 px-2.5 py-1.5 text-[11px] font-bold text-green-700">
          APP calculada automaticamente dentro do terreno: {formatArea(app.areaM2)}
          {app.larguraM != null && ` (faixa de ${app.larguraM} m)`} — já enviada para a aba Viabilidade.
        </p>
      )}
      <p className="text-[10px] text-gray-400">
        APP pelo Código Florestal (Lei 12.651/2012, art. 4º): rios com menos de 10 m → 30 m; 10–50 m → 50 m; 50–200 m → 100 m; 200–600 m → 200 m; acima de 600 m → 500 m (largura medida no polígono oficial do rio ou estimada pela ordem do trecho na BHO/ANA); nascentes → raio de 50 m. Legislação municipal pode ser mais restritiva (ex.: Imperatriz/MA aplica 500 m na margem do Tocantins) — nesse caso selecione a faixa manualmente. Faixa de servidão de LT por tensão (referência: 138 kV → 30 m, 230 kV → 40 m, 500 kV → 70 m; vale a escritura/decreto da concessionária); rodovia federal: 35 m de domínio + 15 m não edificáveis de cada lado (confirmar no DNIT). Vegetação nativa por amostragem do MapBiomas 2023 (pixel de 30 m). Confirme sempre com o órgão ambiental competente.
      </p>
    </div>
  );
}

function Rotulo({ estado }: { estado: "carregando" | "ok" | "vazio" | "indisponivel" }) {
  if (estado === "carregando") return <span className="text-gray-400">consultando…</span>;
  if (estado === "indisponivel") return <span className="font-bold text-amber-700">indisponível</span>;
  return null;
}

function Linha({ cor, titulo, texto, estado = "ok", extra }: { cor: string; titulo: string; texto?: string; estado?: "carregando" | "ok" | "vazio" | "indisponivel"; extra?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-1 inline-block h-2.5 w-3 shrink-0" style={{ background: cor }} />
      <div className="min-w-0">
        <span className="font-bold text-gray-700">{titulo}</span>{" "}
        {estado === "ok" || estado === "vazio" ? <span className="text-gray-500">{texto}</span> : <Rotulo estado={estado} />}
        {extra}
      </div>
    </div>
  );
}

function LinhaCamada<K extends IdCamada>({ cor, titulo, e, ok, vazio, onRetry }: {
  cor: string; titulo: string; e: Estado<K>; ok: (d: DadosCamadas[K]) => string; vazio: string; onRetry: () => void;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-1 inline-block h-2.5 w-3 shrink-0" style={{ background: cor }} />
      <div className="min-w-0">
        <span className="font-bold text-gray-700">{titulo}</span>{" "}
        {e.estado === "carregando" && <Rotulo estado="carregando" />}
        {e.estado === "ok" && "dados" in e && e.dados && <span className="text-gray-500">{ok(e.dados)}</span>}
        {e.estado === "vazio" && <span className="text-gray-500">{vazio}</span>}
        {e.estado === "indisponivel" && (
          <>
            <Rotulo estado="indisponivel" />
            <button type="button" onClick={onRetry} className="ml-1.5 border border-gray-200 px-1.5 py-0 text-[11px] font-bold text-gray-600 hover:border-[var(--brand-yellow)]">tentar de novo</button>
          </>
        )}
        {"fonte" in e && (
          <span className="block text-[10px] text-gray-400" title={e.erro}>Fonte: {e.fonte}{e.estado === "indisponivel" && e.erro ? ` — ${e.erro}` : ""}</span>
        )}
      </div>
    </div>
  );
}
