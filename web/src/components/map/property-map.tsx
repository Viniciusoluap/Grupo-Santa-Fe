"use client";

import { useEffect, useRef } from "react";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  price?: number;
  type?: string;
  href?: string;
}

interface PropertyMapProps {
  pins: MapPin[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onPinClick?: (pin: MapPin) => void;
}

export function PropertyMap({
  pins,
  center = [-6.5000, -49.8790],
  zoom = 13,
  height = "500px",
  onPinClick,
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let L: typeof import("leaflet");
    let map: import("leaflet").Map;

    async function init() {
      L = (await import("leaflet")).default;

      // Fix default icon paths (Leaflet + bundler issue)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: false });
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      map.setView(center, zoom);

      // Custom yellow icon
      const yellowIcon = L.divIcon({
        className: "",
        html: `<div style="width:32px;height:32px;background:#F5C400;border:3px solid #1A1A1A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:2px 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      pins.forEach((pin) => {
        const marker = L.marker([pin.lat, pin.lng], { icon: yellowIcon }).addTo(map);

        const priceText = pin.price
          ? `<strong style="color:#1A1A1A">R$ ${pin.price.toLocaleString("pt-BR")}</strong>`
          : "";

        const typeText = pin.type
          ? `<span style="background:#F5C400;color:#1A1A1A;font-size:9px;font-weight:700;padding:2px 6px;text-transform:uppercase;letter-spacing:0.05em">${pin.type}</span>`
          : "";

        const linkHtml = pin.href
          ? `<a href="${pin.href}" style="display:block;margin-top:8px;background:#1A1A1A;color:#F5C400;font-weight:700;font-size:10px;text-align:center;padding:4px 8px;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em">Ver imóvel →</a>`
          : "";

        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            ${typeText}
            <p style="font-weight:700;margin:6px 0 2px;color:#1A1A1A;font-size:13px">${pin.title}</p>
            ${priceText}
            ${linkHtml}
          </div>
        `, { maxWidth: 200 });

        if (onPinClick) {
          marker.on("click", () => onPinClick(pin));
        }
      });
    }

    init();

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as import("leaflet").Map).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height, width: "100%" }} className="z-0" />
    </>
  );
}
