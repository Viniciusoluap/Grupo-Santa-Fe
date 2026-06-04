"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Filter } from "lucide-react";
import { properties } from "@/lib/data/properties";
import { formatCurrency } from "@/lib/utils";
import type { MapPin as MapPinType } from "@/components/map/property-map";

const PropertyMap = dynamic(
  () => import("@/components/map/property-map").then((m) => m.PropertyMap),
  { ssr: false, loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: "480px" }} /> }
);

// Coordinates for Canaã dos Carajás-PA neighbourhoods
const COORDS: Record<string, [number, number]> = {
  "1": [-6.4960, -49.8750], // Ouro Preto
  "2": [-6.5015, -49.8820], // Novo Horizonte
  "3": [-6.4942, -49.8790], // Centro
  "4": [-6.4880, -49.8810], // Residencial Norte
  "5": [-6.5030, -49.8760], // Vila dos Funcionários
  "6": [-6.4970, -49.8835], // Vale Dourado
  "7": [-6.5060, -49.8700], // Parque Industrial
  "8": [-6.5200, -49.8950], // Zona Rural
};

export default function AdminMapaPage() {
  const [selectedPin, setSelectedPin] = useState<MapPinType | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  const filtered = properties.filter(
    (p) => typeFilter === "todos" || p.type === typeFilter
  );

  const pins: MapPinType[] = filtered.map((p) => ({
    id: p.id,
    lat: COORDS[p.id]?.[0] ?? -16.6869 + Math.random() * 0.05,
    lng: COORDS[p.id]?.[1] ?? -49.2648 + Math.random() * 0.05,
    title: p.title,
    price: p.price,
    type: p.type,
    href: `/admin/imoveis`,
  }));

  const selectedProperty = selectedPin
    ? properties.find((p) => p.id === selectedPin.id)
    : null;

  const types = Array.from(new Set(properties.map((p) => p.type)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Mapa de Imóveis</h1>
          <p className="text-gray-400 text-sm mt-0.5">{filtered.length} imóveis no mapa</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <div className="flex border border-gray-200">
            <button onClick={() => setTypeFilter("todos")} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${typeFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-400 hover:bg-gray-50"}`}>
              Todos
            </button>
            {types.map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${typeFilter === t ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-400 hover:bg-gray-50"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Map */}
        <div className="lg:col-span-2 bg-white border border-gray-100 overflow-hidden">
          <PropertyMap
            pins={pins}
            height="480px"
            onPinClick={setSelectedPin}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {selectedProperty ? (
            <div className="bg-white border border-[var(--brand-yellow)] p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[10px] font-bold bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-2 py-0.5 uppercase">{selectedProperty.type}</span>
                  <h3 className="font-bold text-[var(--brand-dark)] mt-2">{selectedProperty.title}</h3>
                </div>
              </div>
              <p className="font-black text-[var(--brand-dark)] text-xl">{formatCurrency(selectedProperty.price)}</p>
              <p className="text-gray-400 text-xs mt-1">{selectedProperty.address.city}, {selectedProperty.address.state}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {selectedProperty.bedrooms && (
                  <div className="bg-gray-50 p-2">
                    <p className="font-black text-[var(--brand-dark)]">{selectedProperty.bedrooms}</p>
                    <p className="text-[10px] text-gray-400">Quartos</p>
                  </div>
                )}
                {selectedProperty.bathrooms && (
                  <div className="bg-gray-50 p-2">
                    <p className="font-black text-[var(--brand-dark)]">{selectedProperty.bathrooms}</p>
                    <p className="text-[10px] text-gray-400">Banheiros</p>
                  </div>
                )}
                {selectedProperty.area && (
                  <div className="bg-gray-50 p-2">
                    <p className="font-black text-[var(--brand-dark)]">{selectedProperty.area}</p>
                    <p className="text-[10px] text-gray-400">m²</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
              <MapPin size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Clique em um marcador para ver detalhes do imóvel</p>
            </div>
          )}

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Legenda</p>
            <div className="space-y-2">
              {types.map((t) => {
                const count = properties.filter((p) => p.type === t).length;
                return (
                  <div key={t} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[var(--brand-yellow)] border-2 border-[var(--brand-dark)] rounded-full" />
                      <span className="text-sm text-gray-600 capitalize">{t}</span>
                    </div>
                    <span className="text-xs font-bold text-[var(--brand-dark)]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Lista ({filtered.length})</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPin(pins.find((pin) => pin.id === p.id) ?? null)}
                  className={`w-full text-left p-2.5 border transition-colors text-sm ${selectedPin?.id === p.id ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5" : "border-gray-100 hover:border-gray-300"}`}
                >
                  <p className="font-medium text-[var(--brand-dark)] truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(p.price)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
