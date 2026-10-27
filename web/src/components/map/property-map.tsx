"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { formatCurrency } from "@/lib/utils";
import { CAMADAS_MAPA, CATEGORIAS_PONTO, coordenadaValida, type CategoriaPonto } from "@/lib/mapa-alfinetes";
import { adicionarCamadas, alfinete, carregarLeaflet, criarGrupoDePontos, enquadrar } from "@/lib/mapa-leaflet";

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
  zoom?: number;
  height?: string;
  onPinClick?: (pin: MapPin) => void;
  /** Mostra a legenda das cores dos alfinetes. */
  legenda?: boolean;
}

type Motor = { L: typeof import("leaflet"); map: import("leaflet").Map; grupo: import("leaflet").FeatureGroup };

/**
 * Lote 02, correção 05: satélite (Esri) com ruas e rótulos ou mapa (OSM),
 * alfinetes por tipo/status, agrupamento que se separa no zoom, pontos
 * sobrepostos em leque (spiderfy) e enquadramento automático nos pontos.
 * Os alfinetes acompanham a lista filtrada. Só coordenadas válidas entram.
 */
export function PropertyMap({
  pins,
  center = [-6.5000, -49.8790],
  zoom = 13,
  height = "500px",
  onPinClick,
  legenda = false,
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const aoClicar = useRef(onPinClick);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => { aoClicar.current = onPinClick; }, [onPinClick]);

  useEffect(() => {
    let descartado = false;
    carregarLeaflet()
      .then(({ L, agrupa }) => {
        if (descartado || !mapRef.current) return;
        const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false, maxZoom: CAMADAS_MAPA.maxZoom });
        map.setView(center, zoom);
        adicionarCamadas(L, map, () => setErro("Parte do mapa base está indisponível. A lista continua acessível abaixo."));
        const grupo = criarGrupoDePontos(L, agrupa).addTo(map);
        motor.current = { L, map, grupo };
        setPronto(true);
      })
      .catch(() => setErro("Não foi possível carregar o mapa. Consulte a lista abaixo."));
    return () => {
      descartado = true;
      motor.current?.map.remove();
      motor.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = motor.current;
    if (!pronto || !m) return;
    m.grupo.clearLayers();
    // Título, tipo e link vêm do cadastro (ex.: nome da obra): escapados antes de virar HTML.
    const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    const validos = pins.flatMap((pin) => {
      const c = coordenadaValida(pin.lat, pin.lng);
      return c ? [{ pin, lat: c[0], lng: c[1] }] : [];
    });
    validos.forEach(({ pin, lat, lng }) => {
      const categoria = pin.categoria ?? "outro";
      const priceText = pin.price ? `<strong style="color:#1A1A1A">${formatCurrency(pin.price)}</strong>` : "";
      const typeText = `<span style="background:${CATEGORIAS_PONTO[categoria].cor};color:#fff;font-size:9px;font-weight:700;padding:2px 6px;text-transform:uppercase;letter-spacing:0.05em">${esc(pin.type ?? CATEGORIAS_PONTO[categoria].rotulo)}</span>`;
      const enderecoText = pin.endereco ? `<p style="margin:4px 0 0;color:#4b5563;font-size:11px">${esc(pin.endereco)}</p>` : "";
      const linkHtml = pin.href
        ? `<a href="${esc(pin.href)}" style="display:block;margin-top:8px;background:#1A1A1A;color:#F5C400;font-weight:700;font-size:10px;text-align:center;padding:4px 8px;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em">Abrir →</a>`
        : "";
      const popup = `
        <div style="font-family:sans-serif;min-width:160px">
          ${typeText}
          <p style="font-weight:700;margin:6px 0 2px;color:#1A1A1A;font-size:13px">${esc(pin.title)}</p>
          ${priceText}
          ${enderecoText}
          ${linkHtml}
        </div>`;
      m.grupo.addLayer(alfinete(m.L, { lat, lng, categoria, popup, aoClicar: () => aoClicar.current?.(pin) }));
    });
    enquadrar(m.L, m.map, validos);
  }, [pins, pronto]);

  return (
    <div className="space-y-2">
      <div ref={mapRef} style={{ height, width: "100%" }} className="z-0" />
      {legenda && (
        <ul className="flex flex-wrap gap-3 px-3 pb-3 text-xs text-gray-700" aria-label="Legenda do mapa">
          {(["disponivel", "reservado", "obra"] as const).map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-white" style={{ background: CATEGORIAS_PONTO[c].cor }} />
              {CATEGORIAS_PONTO[c].rotulo}
            </li>
          ))}
          <li className="text-gray-600">Números = pontos agrupados (aproxime para separar)</li>
        </ul>
      )}
      {erro && <p role="alert" className="px-3 pb-3 text-sm text-amber-800">{erro}</p>}
    </div>
  );
}
