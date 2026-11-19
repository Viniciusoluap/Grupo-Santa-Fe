"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapaMl, Marker, Popup } from "maplibre-gl";
import { formatCurrency } from "@/lib/utils";
import { CATEGORIAS_PONTO, chaveDoMarcador, coordenadaValida, estiloAgrupamento, htmlAlfinete, limitesDosPontos, type CategoriaPonto } from "@/lib/mapa-alfinetes";
import { aplicarBase, criarMapaBase, type BaseMapa } from "@/app/admin/incorporacao/_components/mapa-base-ml";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  price?: number;
  type?: string;
  href?: string;
  /** Cor do alfinete (tipo/status). Sem ela, "outro". */
  categoria?: CategoriaPonto;
  endereco?: string | null;
}

interface PropertyMapProps {
  pins: MapPin[];
  center?: [number, number];
  height?: string;
  onPinClick?: (pin: MapPin) => void;
  /** Mostra a legenda das cores dos alfinetes. */
  legenda?: boolean;
}

const FONTE = "pontos";

/** Popup de um ponto, montado com textContent (nada do cadastro vira HTML). */
export function cartaoDoPonto(pin: MapPin): HTMLElement {
  const categoria = pin.categoria ?? "outro";
  const caixa = document.createElement("div");
  caixa.style.cssText = "font:13px/1.35 sans-serif;color:#1A1A1A;min-width:170px";
  const tipo = document.createElement("small");
  tipo.style.cssText = `display:block;font-weight:700;color:${CATEGORIAS_PONTO[categoria].cor};text-transform:uppercase`;
  tipo.textContent = pin.type ?? CATEGORIAS_PONTO[categoria].rotulo;
  const titulo = document.createElement("strong");
  titulo.style.display = "block";
  titulo.textContent = pin.title;
  caixa.append(tipo, titulo);
  if (pin.price) { const valor = document.createElement("div"); valor.textContent = formatCurrency(pin.price); caixa.append(valor); }
  const endereco = document.createElement("div");
  endereco.style.color = "#4b5563";
  endereco.textContent = pin.endereco ?? "Endereço não informado";
  caixa.append(endereco);
  if (pin.href?.startsWith("/")) {
    const link = document.createElement("a");
    link.href = pin.href;
    link.textContent = "Abrir →";
    link.style.cssText = "display:block;margin-top:6px;background:#1A1A1A;color:#F5C400;font-weight:700;font-size:10px;text-align:center;padding:4px 8px;text-decoration:none;text-transform:uppercase";
    caixa.append(link);
  }
  return caixa;
}

/**
 * Paridade 17/11 (EPIC-023 S-B da Prospecta, commit 2cb1fd2): o Mapa operacional usa a mesma base nova da
 * Incorporação (MapLibre GL — satélite Mapbox quando há token, senão Esri no zoom nativo, tela retina). Mantém:
 * alfinetes por tipo/status, agrupamento que se separa ao aproximar, enquadramento automático, Satélite/Ruas e a
 * legenda. Pontos no mesmo endereço abrem numa lista (no lugar do "leque" do Leaflet). Só pontos com coordenadas
 * válidas do cadastro entram no mapa (nada é inventado).
 */
export function PropertyMap({
  pins,
  center = [-6.5000, -49.8790],
  height = "500px",
  onPinClick,
  legenda = false,
}: PropertyMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const motor = useRef<{ map: MapaMl; limparMarcadores: () => void } | null>(null);
  // Geração dos dados da fonte: muda a cada setData (filtro/busca), para nenhum marcador antigo ser reaproveitado.
  const geracao = useRef(0);
  const porId = useRef(new Map<string, MapPin>());
  const aoClicar = useRef(onPinClick);
  const inicio = useRef(center);
  const [pronto, setPronto] = useState(false);
  const [base, setBase] = useState<BaseMapa>("satelite");
  const [info, setInfo] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => { aoClicar.current = onPinClick; }, [onPinClick]);

  useEffect(() => {
    let cancelado = false;
    let limpar = () => {};
    void (async () => {
      const el = container.current;
      if (!el) return;
      const [lat, lng] = inicio.current;
      const [criado, ml] = await Promise.all([
        criarMapaBase(el, [lng - 0.05, lat - 0.05, lng + 0.05, lat + 0.05], { cancelado: () => cancelado }),
        import("maplibre-gl").then((m) => (m.default ?? m) as typeof import("maplibre-gl")),
      ]);
      if (!criado || cancelado) { criado?.map.remove(); return; }
      const { map } = criado;
      setInfo(criado.info);
      const marcadores = new Map<string, Marker>();
      let popup: Popup | null = null;
      const abrir = (lngLat: [number, number], conteudo: HTMLElement) => {
        popup?.remove();
        popup = new ml.Popup({ offset: 18, maxWidth: "260px" }).setLngLat(lngLat).setDOMContent(conteudo).addTo(map);
      };
      const aoClicarNoGrupo = async (id: number, lngLat: [number, number], total: number) => {
        const fonte = map.getSource(FONTE) as GeoJSONSource;
        const zoom = await fonte.getClusterExpansionZoom(id);
        if (zoom <= map.getMaxZoom() && map.getZoom() < map.getMaxZoom() - 0.2) { map.easeTo({ center: lngLat, zoom: Math.min(zoom, map.getMaxZoom()) }); return; }
        // Mesmo endereço (não separa aproximando): lista todos os pontos do grupo.
        const folhas = await fonte.getClusterLeaves(id, Math.min(total, 60), 0);
        const lista = document.createElement("div");
        lista.style.cssText = "max-height:240px;overflow:auto;display:grid;gap:10px";
        for (const f of folhas) { const p = porId.current.get(String(f.properties?.chave)); if (p) lista.append(cartaoDoPonto(p)); }
        abrir(lngLat, lista);
      };
      const atualizar = () => {
        if (!map.getSource(FONTE) || !map.isSourceLoaded(FONTE)) return;
        const vistos = new Set<string>();
        for (const f of map.querySourceFeatures(FONTE)) {
          if (f.geometry.type !== "Point") continue;
          const lngLat = f.geometry.coordinates as [number, number];
          const agrupado = !!f.properties?.cluster;
          const chave = chaveDoMarcador(f.properties, geracao.current);
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          if (marcadores.has(chave)) continue;
          const botao = document.createElement("button");
          botao.type = "button";
          botao.style.cssText = "background:none;border:0;padding:0;cursor:pointer";
          let ancora: "center" | "bottom" = "bottom";
          if (agrupado) {
            const total = Number(f.properties.point_count);
            const { texto, tamanho } = estiloAgrupamento(total);
            botao.setAttribute("aria-label", `${texto} pontos agrupados`);
            botao.style.cssText += `;width:${tamanho}px;height:${tamanho}px;border-radius:9999px;background:#1A1A1A;color:#fff;border:3px solid #F5C400;font:700 13px sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.45)`;
            botao.textContent = texto;
            botao.onclick = () => void aoClicarNoGrupo(Number(f.properties.cluster_id), lngLat, total);
            ancora = "center";
          } else {
            const p = porId.current.get(String(f.properties?.chave));
            if (!p) continue;
            botao.innerHTML = htmlAlfinete(p.categoria ?? "outro");
            botao.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,.45))";
            botao.onclick = () => { abrir(lngLat, cartaoDoPonto(p)); aoClicar.current?.(p); };
          }
          marcadores.set(chave, new ml.Marker({ element: botao, anchor: ancora }).setLngLat(lngLat).addTo(map));
        }
        marcadores.forEach((m, chave) => { if (!vistos.has(chave)) { m.remove(); marcadores.delete(chave); } });
      };
      map.on("load", () => {
        map.addSource(FONTE, { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 48, clusterMaxZoom: 22 });
        // Camada invisível: mantém os ladrilhos da fonte carregados para a consulta dos pontos visíveis.
        map.addLayer({ id: "pontos-base", type: "circle", source: FONTE, paint: { "circle-radius": 1, "circle-opacity": 0 } });
        motor.current = { map, limparMarcadores: () => { marcadores.forEach((mk) => mk.remove()); marcadores.clear(); } };
        setPronto(true);
      });
      map.on("render", atualizar);
      map.on("error", () => setErro("Parte do mapa base está indisponível. A lista continua acessível abaixo."));
      limpar = () => { popup?.remove(); marcadores.forEach((m) => m.remove()); map.remove(); };
      if (cancelado) limpar();
    })().catch(() => setErro("Não foi possível carregar o mapa. Consulte a lista abaixo."));
    return () => { cancelado = true; motor.current = null; limpar(); };
  }, []);

  useEffect(() => { if (pronto && motor.current) aplicarBase(motor.current.map, base); }, [base, pronto]);

  useEffect(() => {
    const m = motor.current;
    if (!pronto || !m) return;
    porId.current = new Map();
    // Revisão do PR #263: dados novos → marcadores do conjunto anterior saem (o cluster_id se repete entre conjuntos).
    geracao.current += 1;
    m.limparMarcadores();
    const pontos = pins.flatMap((pin) => {
      const c = coordenadaValida(pin.lat, pin.lng);
      if (!c) return [];
      porId.current.set(pin.id, pin);
      return [{ chave: pin.id, lat: c[0], lng: c[1] }];
    });
    (m.map.getSource(FONTE) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: pontos.map((p) => ({ type: "Feature" as const, properties: { chave: p.chave }, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] } })),
    });
    const limites = limitesDosPontos(pontos);
    if (!limites) return;
    if (pontos.length === 1) m.map.easeTo({ center: [pontos[0].lng, pontos[0].lat], zoom: Math.min(17, m.map.getMaxZoom()) });
    else m.map.fitBounds([[limites[0], limites[1]], [limites[2], limites[3]]], { padding: 56, maxZoom: Math.min(17, m.map.getMaxZoom()) });
  }, [pins, pronto]);

  return (
    <section aria-label="Mapa dos imóveis e obras" className="space-y-2">
      <div className="relative z-0">
        <div ref={container} style={{ height, width: "100%" }} className="bg-gray-100" data-testid="mapa-operacional" />
        <div className="absolute left-2 top-2 flex overflow-hidden rounded border border-gray-300 bg-white text-xs font-bold shadow-sm">
          {(["satelite", "ruas"] as const).map((b) => (
            <button key={b} type="button" aria-pressed={base === b} onClick={() => setBase(b)}
              className={`px-3 py-1.5 ${base === b ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-600 hover:bg-gray-50"}`}>
              {b === "satelite" ? "Satélite" : "Ruas"}
            </button>
          ))}
        </div>
      </div>
      {legenda && (
        <ul className="flex flex-wrap gap-3 px-3 pb-1 text-xs text-gray-700" aria-label="Legenda do mapa">
          {(["disponivel", "reservado", "obra"] as const).map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-white" style={{ background: CATEGORIAS_PONTO[c].cor }} />
              {CATEGORIAS_PONTO[c].rotulo}
            </li>
          ))}
          <li className="text-gray-600">Números = pontos agrupados (toque para aproximar; no mesmo endereço, abre a lista)</li>
        </ul>
      )}
      {info && <p className="px-3 text-xs text-gray-600">{info}</p>}
      {erro && <p role="alert" className="px-3 pb-3 text-sm text-amber-800">{erro}</p>}
    </section>
  );
}
