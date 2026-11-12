"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeoJSONSource, Map as MapaMl } from "maplibre-gl";
import { area as turfArea, bbox as turfBbox, featureCollection } from "@turf/turf";
import {
  IDS_CAMADAS, LARGURA_CONFIRMADA_MAX_M, calcularApp, calcularServidao, calcularVegetacao, carConfere, fmtKm, fmtPct, limparLargurasConfirmadas,
  linhasOsmComplementares, resumirFuros, type AppModo, type Contorno, type DadosCamadas, type DadosHidro, type EstadoCamada, type IdCamada,
  type ItemServidao, type LargurasConfirmadas,
} from "@/lib/geo/camadas-terreno";
import { aplicarBase, criarMapaBase, type BaseMapa } from "./mapa-base-ml";
import { salvarApp, salvarLargurasFaixa } from "@/lib/actions/incorporacao";
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
  /** Larguras de faixa confirmadas pelo dono e salvas no estudo (JSON {chave: metros}). */
  largurasJson?: string | null;
  /** Nº do CAR informado no cadastro do estudo — conferido contra os imóveis encontrados. */
  carInformado?: string | null;
}

const CORES = {
  terreno: "#F5C400", agua: "#38bdf8", rio: "#0ea5e9", nascente: "#0284c7", app: "#22c55e", vegetacao: "#166534",
  servidao: "#ef4444", transmissao: "#dc2626", rodovia: "#f97316", via: "#fdba74", uc: "#a855f7", furo: "#6366f1",
  ferrovia: "#78350f", duto: "#db2777", car: "#fde047", manancial: "#06b6d4",
};

const ROTA_CAMADAS = "/api/incorporacao/camadas-terreno";

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

/** Fontes e camadas vetoriais (ordem de desenho de baixo para cima). */
const FONTES_VETOR = ["ucs", "car", "mananciais", "vegetacao", "servidao", "app", "agua", "rios", "vias", "rodovias", "ferrovias", "dutos", "transmissao", "terreno", "nascentes", "furos", "captacoes"] as const;

function adicionarCamadasVetor(map: MapaMl) {
  for (const id of FONTES_VETOR) map.addSource(id, { type: "geojson", data: vazioFc() });
  map.addLayer({ id: "ucs-fill", type: "fill", source: "ucs", paint: { "fill-color": CORES.uc, "fill-opacity": 0.15 } });
  map.addLayer({ id: "ucs-line", type: "line", source: "ucs", paint: { "line-color": CORES.uc, "line-width": 1.5, "line-dasharray": [3, 2] } });
  map.addLayer({ id: "car-line", type: "line", source: "car", paint: { "line-color": CORES.car, "line-width": 1.5, "line-dasharray": [1, 1.5] } });
  map.addLayer({ id: "mananciais-fill", type: "fill", source: "mananciais", paint: { "fill-color": CORES.manancial, "fill-opacity": 0.18 } });
  map.addLayer({ id: "mananciais-line", type: "line", source: "mananciais", paint: { "line-color": CORES.manancial, "line-width": 1.5 } });
  map.addLayer({ id: "vegetacao", type: "fill", source: "vegetacao", paint: { "fill-color": CORES.vegetacao, "fill-opacity": 0.45 } });
  map.addLayer({ id: "servidao", type: "fill", source: "servidao", paint: { "fill-color": CORES.servidao, "fill-opacity": 0.22 } });
  map.addLayer({ id: "app-fill", type: "fill", source: "app", paint: { "fill-color": CORES.app, "fill-opacity": 0.32 } });
  map.addLayer({ id: "app-line", type: "line", source: "app", paint: { "line-color": CORES.app, "line-width": 1 } });
  map.addLayer({ id: "agua", type: "fill", source: "agua", paint: { "fill-color": CORES.agua, "fill-opacity": 0.35 } });
  map.addLayer({ id: "rios", type: "line", source: "rios", paint: { "line-color": CORES.rio, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 18, 3.5] } });
  map.addLayer({ id: "vias", type: "line", source: "vias", paint: { "line-color": CORES.via, "line-width": 1.5, "line-opacity": 0.8 } });
  map.addLayer({ id: "rodovias", type: "line", source: "rodovias", paint: { "line-color": CORES.rodovia, "line-width": 3 } });
  map.addLayer({ id: "ferrovias", type: "line", source: "ferrovias", paint: { "line-color": CORES.ferrovia, "line-width": 3, "line-dasharray": [3, 1] } });
  map.addLayer({ id: "dutos", type: "line", source: "dutos", paint: { "line-color": CORES.duto, "line-width": 2.5, "line-dasharray": [1, 1] } });
  map.addLayer({ id: "transmissao", type: "line", source: "transmissao", paint: { "line-color": CORES.transmissao, "line-width": 2.5, "line-dasharray": [2, 1.5] } });
  map.addLayer({ id: "terreno-fill", type: "fill", source: "terreno", paint: { "fill-color": CORES.terreno, "fill-opacity": 0.1 } });
  map.addLayer({ id: "terreno-line", type: "line", source: "terreno", paint: { "line-color": CORES.terreno, "line-width": 3 } });
  map.addLayer({ id: "nascentes", type: "circle", source: "nascentes", paint: { "circle-radius": 5, "circle-color": CORES.nascente, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
  map.addLayer({ id: "furos", type: "circle", source: "furos", paint: { "circle-radius": 5, "circle-color": CORES.furo, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
  map.addLayer({ id: "captacoes", type: "circle", source: "captacoes", paint: { "circle-radius": 6, "circle-color": CORES.manancial, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
}

export function MapaTerreno({ geojson, center, height = 420, estudoId, largurasJson, carInformado }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapaMl | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [base, setBase] = useState<BaseMapa>("satelite");
  // larguras de faixa confirmadas: começam com o que está salvo no estudo e mudam ao salvar na tela
  const [larguras, setLarguras] = useState<LargurasConfirmadas>(() => { try { return limparLargurasConfirmadas(JSON.parse(largurasJson ?? "{}")); } catch { return {}; } });
  const [erroLargura, setErroLargura] = useState<string | null>(null);
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
      const criado = await criarMapaBase(ref.current!, turfBbox(contorno) as [number, number, number, number], {
        centro: centroLat != null && centroLng != null ? [centroLat, centroLng] : undefined,
        atribuicao: "Camadas: ANA, IBAMA/CNUC/CAR, EPE, DNIT, SGB/CPRM, MapBiomas, © OpenStreetMap",
        cancelado: () => cancelado || !ref.current,
      });
      if (!criado) return;
      map = criado.map;
      if (cancelado) { map.remove(); return; }
      setInfoBase(criado.info);
      map.on("load", () => {
        if (cancelado || !map) return;
        adicionarCamadasVetor(map);
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
    aplicarBase(map, base);
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
  const ferrovias = dados(estados.ferrovias)?.ferrovias;
  const dutos = dados(estados.dutos)?.dutos;
  const servidao = useMemo(() => (contorno ? calcularServidao(contorno, linhasTodas, rodovias ?? [], { ferrovias, dutos, larguras }) : null), [contorno, linhasTodas, rodovias, ferrovias, dutos, larguras]);
  const car = dados(estados.car);
  const mananciais = dados(estados.mananciais);
  const carOk = car ? carConfere(carInformado, car.imoveis) : null;
  /** Confirma (ou limpa, com null) a largura total de um item e salva no estudo. */
  const confirmarLargura = (chave: string, valor: number | null) => {
    const novo = { ...larguras };
    if (valor == null) delete novo[chave]; else novo[chave] = valor;
    const limpo = limparLargurasConfirmadas(novo);
    setLarguras(limpo);
    setErroLargura(null);
    if (estudoId) salvarLargurasFaixa(estudoId, limpo).catch(() => setErroLargura("Não foi possível salvar a largura no estudo. Tente de novo."));
  };
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
    set("ferrovias", fc(ferrovias ?? []));
    set("dutos", fc(dutos ?? []));
    set("car", fc(car?.geometrias ?? []));
    set("mananciais", fc(mananciais?.geometrias ?? []));
    set("captacoes", fc((mananciais?.captacoes ?? []).map(c => ({ type: "Feature", properties: { nome: c.nome }, geometry: { type: "Point", coordinates: c.coordenadas } }) as Feature<Geometry>)));
    set("vias", fc(osm?.vias ?? []));
    set("ucs", fc(dados(estados.ucs)?.geometrias ?? []));
    set("furos", fc((dados(estados.furos)?.pocos ?? []).map(p => ({ type: "Feature", properties: { nome: p.nome }, geometry: { type: "Point", coordinates: p.coordenadas } }) as Feature<Geometry>)));
  }, [mapaPronto, hidro, osm, app, servidao, linhasTodas, rodovias, ferrovias, dutos, car, mananciais, estados.vegetacao, estados.ucs, estados.furos]);

  if (!contorno) return <p className="text-xs text-red-500">Não foi possível ler o polígono do terreno.</p>;

  const camadasFaixa = [estados.transmissao, estados.rodovias, estados.ferrovias, estados.dutos];
  const servidaoPendente = camadasFaixa.some(e => e.estado === "carregando");
  const servidaoRespondeu = camadasFaixa.some(respondeu);

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
        <Linha cor={CORES.servidao} titulo="Faixas de servidão e domínio" estado={servidaoPendente ? "carregando" : servidaoRespondeu ? "ok" : "indisponivel"}
          texto={servidao && servidao.itens.length
            ? `${formatArea(servidao.areaM2)} dentro do terreno (${fmtPct(servidao.percentual)})`
            : servidaoRespondeu ? "nenhuma linha de transmissão, rodovia federal, ferrovia ou duto no entorno" : "fontes indisponíveis"}
          extra={servidao && servidao.itens.length > 0 && (
            <ul className="mt-1 space-y-1.5" data-testid="itens-servidao">
              {servidao.itens.map(i => <ItemFaixa key={i.chave} item={i} onConfirmar={v => confirmarLargura(i.chave, v)} />)}
              {erroLargura && <li className="text-[11px] font-bold text-red-600">{erroLargura}</li>}
            </ul>
          )} />
        <LinhaCamada cor={CORES.transmissao} titulo="Linhas de transmissão" e={estados.transmissao} onRetry={() => carregar(["transmissao"], true)}
          ok={d => `${d.linhas.length} trecho(s) · ${Array.from(new Set(d.linhas.map(l => (l.properties.tensaoKv ? `${l.properties.tensaoKv} kV` : "tensão n/d")))).join(", ")}`}
          vazio="nenhuma a 250 m" />
        <LinhaCamada cor={CORES.rodovia} titulo="Rodovias federais (DNIT)" e={estados.rodovias} onRetry={() => carregar(["rodovias"], true)}
          ok={d => Array.from(new Set(d.rodovias.map(r => r.properties.nome))).join(", ")} vazio="nenhuma a 250 m" />
        <LinhaCamada cor={CORES.ferrovia} titulo="Ferrovias (DNIT)" e={estados.ferrovias} onRetry={() => carregar(["ferrovias"], true)}
          ok={d => Array.from(new Set(d.ferrovias.map(f => `${f.properties.nome ?? "Ferrovia"}${f.properties.concessionaria ? ` (${f.properties.concessionaria})` : ""}`))).join(", ")} vazio="nenhuma a 250 m" />
        <LinhaCamada cor={CORES.duto} titulo="Dutos (EPE/IBAMA)" e={estados.dutos} onRetry={() => carregar(["dutos"], true)}
          ok={d => Array.from(new Set(d.dutos.map(x => `${x.properties.nome ?? "Duto"} — ${x.properties.tipo}`))).slice(0, 4).join(" · ")} vazio="nenhum gasoduto ou duto licenciado a 250 m" />
        <LinhaCamada cor={CORES.car} titulo="CAR — imóveis rurais cadastrados" e={estados.car} onRetry={() => carregar(["car"], true)}
          ok={d => `${d.imoveis.length} imóvel(is) sobre o terreno · ${fmtPct(d.percentualCoberto)} da área coberta · ${d.imoveis.slice(0, 2).map(i => `${i.codigo}${i.status ? ` (${i.status})` : ""} ${fmtPct(i.percentualDoTerreno)}`).join(" · ")}${carOk === true ? " · confere com o CAR informado no estudo" : carOk === false ? " · ATENÇÃO: o CAR informado no estudo não está entre eles" : ""}`}
          vazio={`nenhum imóvel do CAR sobre o terreno (área urbana ou sem cadastro)${carInformado ? " · ATENÇÃO: há um CAR informado no estudo" : ""}`} />
        <LinhaCamada cor={CORES.manancial} titulo="Mananciais de abastecimento (ANA)" e={estados.mananciais} onRetry={() => carregar(["mananciais"], true)}
          ok={d => [
            ...d.captacoes.slice(0, 2).map(c => `captação ${c.tipo === "superficial" ? "superficial" : "subterrânea"} ${c.manancial ?? c.nome ?? ""}${c.municipio ? ` — ${c.municipio}` : ""} a ${fmtKm(c.distanciaM)}`),
            ...d.massas.slice(0, 2).map(m => `${m.nome ?? "massa de água"} abastece ${m.sistemas ?? "sistema público"} (${m.distanciaM === 0 ? "encosta no terreno" : `a ${fmtKm(m.distanciaM)}`})`),
          ].join(" · ")}
          vazio="nenhuma captação ou manancial de abastecimento a 5 km" />
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
        APP pelo Código Florestal (Lei 12.651/2012, art. 4º): rios com menos de 10 m → 30 m; 10–50 m → 50 m; 50–200 m → 100 m; 200–600 m → 200 m; acima de 600 m → 500 m (largura medida no polígono oficial do rio ou estimada pela ordem do trecho na BHO/ANA); nascentes → raio de 50 m. Legislação municipal pode ser mais restritiva (ex.: Imperatriz/MA aplica 500 m na margem do Tocantins) — nesse caso selecione a faixa manualmente. Faixas: rodovias e ferrovias têm 15 m NÃO EDIFICÁVEIS de cada lado além da faixa de domínio (Lei 6.766/79, art. 4º, III e III-A; lei municipal pode reduzir a de rodovia até 5 m). A largura da faixa de domínio (DNIT/concessão), a servidão de linha de transmissão (escritura/declaração de utilidade pública) e a de dutos (licenciamento, art. 4º, § 3º) não têm valor único em lei: o mapa usa a referência indicada em cada item até você informar a largura confirmada. Mananciais: captações e massas de água de abastecimento do Atlas Águas (ANA); zona de proteção de manancial é definida por lei estadual/municipal, confirme na prefeitura. CAR: perímetro dos imóveis na base pública do SICAR. Vegetação nativa por amostragem do MapBiomas 2023 (pixel de 30 m). Confirme sempre com o órgão ambiental competente.
      </p>
    </div>
  );
}

const ROTULO_BASE: Record<ItemServidao["base"], { texto: string; classe: string }> = {
  confirmada: { texto: "confirmada", classe: "bg-green-100 text-green-800" },
  "legal+referencia": { texto: "lei + referência", classe: "bg-amber-100 text-amber-800" },
  referencia: { texto: "referência", classe: "bg-gray-100 text-gray-600" },
};

/** Um item de faixa: de onde vem a largura e campo para informar a largura confirmada (concessionária/DNIT/escritura). */
function ItemFaixa({ item, onConfirmar }: { item: ItemServidao; onConfirmar: (largura: number | null) => void }) {
  const [valor, setValor] = useState("");
  const n = Number(valor.replace(",", "."));
  const valido = valor.trim() !== "" && Number.isFinite(n) && n > 0 && n <= LARGURA_CONFIRMADA_MAX_M;
  const r = ROTULO_BASE[item.base];
  return (
    <li className="border-l-2 border-gray-200 pl-2 text-[11px] text-gray-600">
      <span className="font-bold text-gray-700">{item.nome}</span>{" "}
      <span className={`px-1 py-0.5 text-[10px] font-bold ${r.classe}`}>{r.texto}</span>{" "}
      {item.larguraTotalM} m no total · {formatArea(item.areaM2)} no terreno
      <span className="block text-[10px] text-gray-400">{item.composicao}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1">
        <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder="largura confirmada (m)" aria-label={`Largura total confirmada de ${item.nome}, em metros`}
          className="w-36 border border-gray-200 px-1.5 py-0.5 text-[11px] focus:border-[var(--brand-yellow)] focus:outline-none" />
        <button type="button" disabled={!valido} onClick={() => { onConfirmar(n); setValor(""); }}
          className="border border-gray-300 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 hover:border-[var(--brand-yellow)] disabled:opacity-40">Usar esta largura</button>
        {item.base === "confirmada" && (
          <button type="button" onClick={() => onConfirmar(null)} className="px-1 text-[11px] font-bold text-gray-500 underline">voltar à referência</button>
        )}
      </span>
    </li>
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
