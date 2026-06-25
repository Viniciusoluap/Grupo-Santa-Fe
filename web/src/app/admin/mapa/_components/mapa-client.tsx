"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { MapPin as MapPinType } from "@/components/map/property-map";

const PropertyMap = dynamic(
  () => import("@/components/map/property-map").then((m) => m.PropertyMap),
  { ssr: false, loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: "480px" }} /> }
);

// Approximate coordinates for Canaã dos Carajás-PA neighbourhoods
const COORDS_BY_BAIRRO: Record<string, [number, number]> = {
  "Centro": [-6.4942, -49.8790],
  "Ouro Preto": [-6.4960, -49.8750],
  "Novo Horizonte": [-6.5015, -49.8820],
  "Residencial Norte": [-6.4880, -49.8810],
  "Vila dos Funcionários": [-6.5030, -49.8760],
  "Vale Dourado": [-6.4970, -49.8835],
  "Parque Industrial": [-6.5060, -49.8700],
  "Zona Rural": [-6.5200, -49.8950],
};

const BASE_LAT = -6.5000;
const BASE_LNG = -49.8790;

type DbImovel = {
  id: string;
  titulo: string;
  tipo: string;
  bairro: string;
  preco: number;
  slug: string;
  quartos: number | null;
  banheiros: number | null;
  area: number;
  latitude: number | null;
  longitude: number | null;
};

interface MapaClientProps {
  imoveis: DbImovel[];
}

export function MapaClient({ imoveis }: MapaClientProps) {
  const [selectedPin, setSelectedPin] = useState<MapPinType | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  const types = Array.from(new Set(imoveis.map((p) => p.tipo)));

  const filtered = imoveis.filter(
    (p) => typeFilter === "todos" || p.tipo === typeFilter
  );

  const pins: MapPinType[] = filtered.map((p, i) => {
    if (p.latitude && p.longitude) {
      return {
        id: p.id,
        lat: p.latitude,
        lng: p.longitude,
        title: p.titulo,
        price: p.preco,
        type: p.tipo,
        href: `/admin/imoveis/${p.slug}`,
      };
    }
    const base = COORDS_BY_BAIRRO[p.bairro];
    const offset = i * 0.0003;
    return {
      id: p.id,
      lat: base ? base[0] + offset : BASE_LAT + Math.sin(i) * 0.01,
      lng: base ? base[1] + offset : BASE_LNG + Math.cos(i) * 0.01,
      title: p.titulo,
      price: p.preco,
      type: p.tipo,
      href: `/admin/imoveis/${p.slug}`,
    };
  });

  const selectedImovel = selectedPin
    ? imoveis.find((p) => p.id === selectedPin.id)
    : null;

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
            <button
              onClick={() => setTypeFilter("todos")}
              className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${typeFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-400 hover:bg-gray-50"}`}
            >
              Todos
            </button>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${typeFilter === t ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-400 hover:bg-gray-50"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-gray-100 overflow-hidden">
          <PropertyMap
            pins={selectedPin ? pins.filter((p) => p.id === selectedPin.id) : pins}
            height="480px"
            onPinClick={(pin) => setSelectedPin(selectedPin?.id === pin.id ? null : pin)}
          />
        </div>

        <div className="space-y-3">
          {selectedImovel ? (
            <div className="bg-white border border-[var(--brand-yellow)] p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[10px] font-bold bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-2 py-0.5 uppercase">{selectedImovel.tipo}</span>
                  <h3 className="font-bold text-[var(--brand-dark)] mt-2">{selectedImovel.titulo}</h3>
                </div>
              </div>
              <p className="font-black text-[var(--brand-dark)] text-xl">{formatCurrency(selectedImovel.preco)}</p>
              <p className="text-gray-400 text-xs mt-1">{selectedImovel.bairro}, Canaã dos Carajás-PA</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {selectedImovel.quartos != null && (
                  <div className="bg-gray-50 p-2">
                    <p className="font-black text-[var(--brand-dark)]">{selectedImovel.quartos}</p>
                    <p className="text-[10px] text-gray-400">Quartos</p>
                  </div>
                )}
                {selectedImovel.banheiros != null && (
                  <div className="bg-gray-50 p-2">
                    <p className="font-black text-[var(--brand-dark)]">{selectedImovel.banheiros}</p>
                    <p className="text-[10px] text-gray-400">Banheiros</p>
                  </div>
                )}
                <div className="bg-gray-50 p-2">
                  <p className="font-black text-[var(--brand-dark)]">{selectedImovel.area}</p>
                  <p className="text-[10px] text-gray-400">m²</p>
                </div>
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
                const count = imoveis.filter((p) => p.tipo === t).length;
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
                  onClick={() => setSelectedPin(selectedPin?.id === p.id ? null : (pins.find((pin) => pin.id === p.id) ?? null))}
                  className={`w-full text-left p-2.5 border transition-colors text-sm ${selectedPin?.id === p.id ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5" : "border-gray-100 hover:border-gray-300"}`}
                >
                  <p className="font-medium text-[var(--brand-dark)] truncate">{p.titulo}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(p.preco)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
