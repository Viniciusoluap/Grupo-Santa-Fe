"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Crosshair } from "lucide-react";
import { parseGoogleMapsLatLng } from "@/lib/geo/gmaps";

// Seletor de localização no mapa: o usuário clica no ponto e o sistema puxa
// automaticamente a latitude/longitude e o endereço (geocodificação reversa
// via Nominatim/OpenStreetMap — keyless). Também aceita colar um link do Google
// Maps ou um par "lat, lng" que reposiciona o marcador.
//
// Escreve valores em inputs hidden (latitude, longitude, endereco) lidos pela
// server action. Base de satélite Esri World Imagery (sem token).

interface Props {
  nomeLat?: string;
  nomeLng?: string;
  nomeEndereco?: string;
  latInicial?: number | null;
  lngInicial?: number | null;
  enderecoInicial?: string;
  height?: number;
}

const CENTRO_PADRAO: [number, number] = [-6.4979, -49.879]; // Canaã dos Carajás/PA

export function SeletorLocalizacao({
  nomeLat = "latitude",
  nomeLng = "longitude",
  nomeEndereco = "endereco",
  latInicial = null,
  lngInicial = null,
  enderecoInicial = "",
  height = 320,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);

  const [lat, setLat] = useState<number | null>(latInicial);
  const [lng, setLng] = useState<number | null>(lngInicial);
  const [endereco, setEndereco] = useState(enderecoInicial);
  const [buscando, setBuscando] = useState(false);
  const [colar, setColar] = useState("");

  async function reverseGeocode(la: number, lo: number) {
    setBuscando(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&accept-language=pt-BR`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const json = (await res.json()) as { display_name?: string };
        if (json.display_name) setEndereco(json.display_name);
      }
    } catch {
      /* geocodificação é best-effort; coordenadas já bastam */
    } finally {
      setBuscando(false);
    }
  }

  function posicionar(la: number, lo: number, geocode = true) {
    setLat(la);
    setLng(lo);
    const L = LRef.current;
    const map = mapRef.current as import("leaflet").Map | null;
    if (L && map) {
      if (markerRef.current) {
        (markerRef.current as import("leaflet").Marker).setLatLng([la, lo]);
      } else {
        markerRef.current = L.marker([la, lo]).addTo(map);
      }
      map.setView([la, lo], Math.max(map.getZoom(), 15));
    }
    if (geocode) reverseGeocode(la, lo);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      LRef.current = L;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (mapRef.current) {
        (mapRef.current as import("leaflet").Map).remove();
        mapRef.current = null;
        markerRef.current = null;
      }

      const inicial: [number, number] =
        latInicial != null && lngInicial != null ? [latInicial, lngInicial] : CENTRO_PADRAO;
      const map = L.map(ref.current).setView(inicial, latInicial != null ? 16 : 13);
      mapRef.current = map;

      // Satélite Esri (keyless) + rótulos/vias por cima.
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
      ).addTo(map);
      L.tileLayer(
        "https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png",
        { attribution: "© Stamen · OSM", maxZoom: 19, opacity: 0.9 }
      ).addTo(map);

      if (latInicial != null && lngInicial != null) {
        markerRef.current = L.marker([latInicial, lngInicial]).addTo(map);
      }

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        posicionar(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as import("leaflet").Map).remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicarColado() {
    const coords = parseGoogleMapsLatLng(colar);
    if (coords) {
      posicionar(coords.latitude, coords.longitude);
      setColar("");
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={nomeLat} value={lat ?? ""} />
      <input type="hidden" name={nomeLng} value={lng ?? ""} />
      <input type="hidden" name={nomeEndereco} value={endereco} />

      <div className="flex items-center gap-2">
        <input
          value={colar}
          onChange={(e) => setColar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarColado(); } }}
          placeholder="Opcional: cole um link do Google Maps ou -6.4979, -49.8790"
          className="flex-1 text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]"
        />
        <button
          type="button"
          onClick={aplicarColado}
          className="flex items-center gap-1 text-xs font-bold px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <Crosshair size={13} /> Ir
        </button>
      </div>

      <div ref={ref} style={{ height, width: "100%" }} className="border border-gray-200" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <MapPin size={12} className="text-[var(--brand-yellow)]" />
          {lat != null && lng != null
            ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            : "Clique no mapa para marcar o terreno"}
        </span>
        {buscando && (
          <span className="flex items-center gap-1 text-gray-400">
            <Loader2 size={12} className="animate-spin" /> buscando endereço…
          </span>
        )}
        {endereco && !buscando && <span className="truncate max-w-full text-gray-400">{endereco}</span>}
      </div>
    </div>
  );
}
