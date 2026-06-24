"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const CENTER: [number, number] = [-6.5000, -49.8790];

interface LocalizacaoPickerProps {
  nameLat: string;
  nameLng: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
}

function parseMapsInput(input: string): { lat: number; lng: number } | null {
  const s = input.trim();

  // Bare coordinates: "-6.4854, -49.8935"
  const bare = s.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (bare) {
    const lat = parseFloat(bare[1]);
    const lng = parseFloat(bare[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Google Maps URL: ...@lat,lng,zoom or ...@lat,lng,altm
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };

  // ?q=lat,lng or &q=lat,lng
  const q = s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };

  return null;
}

export function LocalizacaoPicker({ nameLat, nameLng, defaultLat, defaultLng }: LocalizacaoPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iconRef = useRef<any>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null
  );
  const [pasteValue, setPasteValue] = useState("");
  const [parseError, setParseError] = useState(false);

  function placeMarker(lat: number, lng: number) {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !iconRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: iconRef.current }).addTo(map);
    }
    map.setView([lat, lng], 17);
    setCoords({ lat, lng });
  }

  function handleApplyPaste() {
    const parsed = parseMapsInput(pasteValue);
    if (!parsed) { setParseError(true); return; }
    setParseError(false);
    setPasteValue("");
    placeMarker(parsed.lat, parsed.lng);
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    async function init() {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const yellowIcon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;background:#F5C400;border:3px solid #1A1A1A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:2px 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      iconRef.current = yellowIcon;

      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: false });
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const initCoords = defaultLat && defaultLng ? [defaultLat, defaultLng] as [number, number] : CENTER;
      map.setView(initCoords, defaultLat && defaultLng ? 16 : 14);

      if (defaultLat && defaultLng) {
        markerRef.current = L.marker([defaultLat, defaultLng], { icon: yellowIcon }).addTo(map);
      }

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: yellowIcon }).addTo(map);
        }
        setCoords({ lat, lng });
      });
    }

    init();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        leafletRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearCoords = () => {
    setCoords(null);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  };

  return (
    <div>
      <input type="hidden" name={nameLat} value={coords?.lat ?? ""} />
      <input type="hidden" name={nameLng} value={coords?.lng ?? ""} />

      {/* Campo colar link/coordenadas */}
      <div className="mb-3">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Colar link ou coordenadas do Google Maps
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={pasteValue}
            onChange={(e) => { setPasteValue(e.target.value); setParseError(false); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPaste())}
            placeholder="Ex: -6.4854, -49.8935  ou  https://maps.google.com/..."
            className={`flex-1 border px-3 py-2 text-sm focus:outline-none bg-gray-50 ${
              parseError ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-[var(--brand-yellow)]"
            }`}
          />
          <button
            type="button"
            onClick={handleApplyPaste}
            className="px-4 py-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Marcar
          </button>
        </div>
        {parseError && (
          <p className="text-xs text-red-500 mt-1">
            Não foi possível identificar as coordenadas. Cole as coordenadas no formato <strong>-6.4854, -49.8935</strong> ou a URL completa do Google Maps (não links curtos maps.app.goo.gl).
          </p>
        )}
      </div>

      {coords ? (
        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
          <MapPin size={12} className="text-[var(--brand-yellow)]" />
          <span>{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
          <button type="button" onClick={clearCoords}
            className="ml-1 text-red-400 hover:text-red-600 underline text-xs">
            Remover
          </button>
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-2">Clique no mapa para marcar ou cole o link acima</p>
      )}

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: "280px", width: "100%" }} className="z-0 border border-gray-200" />
    </div>
  );
}
