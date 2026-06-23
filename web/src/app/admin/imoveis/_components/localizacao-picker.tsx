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

export function LocalizacaoPicker({ nameLat, nameLng, defaultLat, defaultLng }: LocalizacaoPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null
  );

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    async function init() {
      const L = (await import("leaflet")).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: false });
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const initCoords = defaultLat && defaultLng ? [defaultLat, defaultLng] as [number, number] : CENTER;
      map.setView(initCoords, defaultLat && defaultLng ? 16 : 14);

      const yellowIcon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;background:#F5C400;border:3px solid #1A1A1A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:2px 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

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
        <p className="text-xs text-gray-400 mb-2">Clique no mapa para marcar a localização exata</p>
      )}

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: "280px", width: "100%" }} className="z-0 border border-gray-200" />
    </div>
  );
}
