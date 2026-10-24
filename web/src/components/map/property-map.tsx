"use client";

import { useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/utils";

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
        iconUrl: "/leaflet/marker-icon.png",
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        shadowUrl: "/leaflet/marker-shadow.png",
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

      // Título, tipo e link vêm do cadastro (ex.: nome da obra): escapados antes de virar HTML.
      const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
      pins.forEach((pin) => {
        const marker = L.marker([pin.lat, pin.lng], { icon: yellowIcon }).addTo(map);

        const priceText = pin.price
          ? `<strong style="color:#1A1A1A">${formatCurrency(pin.price)}</strong>`
          : "";

        const typeText = pin.type
          ? `<span style="background:#F5C400;color:#1A1A1A;font-size:9px;font-weight:700;padding:2px 6px;text-transform:uppercase;letter-spacing:0.05em">${esc(pin.type)}</span>`
          : "";

        const linkHtml = pin.href
          ? `<a href="${esc(pin.href)}" style="display:block;margin-top:8px;background:#1A1A1A;color:#F5C400;font-weight:700;font-size:10px;text-align:center;padding:4px 8px;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em">Ver imóvel →</a>`
          : "";

        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            ${typeText}
            <p style="font-weight:700;margin:6px 0 2px;color:#1A1A1A;font-size:13px">${esc(pin.title)}</p>
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
      <div ref={mapRef} style={{ height, width: "100%" }} className="z-0" />
    </>
  );
}
