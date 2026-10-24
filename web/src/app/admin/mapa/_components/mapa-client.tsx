"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { MapPin as MapPinType } from "@/components/map/property-map";
import type { PontoMapa } from "@/lib/mapa-operacional";
import { rotulo } from "@/lib/rotulos";

const PropertyMap = dynamic(
  () => import("@/components/map/property-map").then((m) => m.PropertyMap),
  { ssr: false, loading: () => <div className="bg-gray-100 animate-pulse" style={{ height: "480px" }} /> }
);

type Filtro = "todos" | "imovel" | "obra";
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "imovel", label: "Imóveis" },
  { id: "obra", label: "Obras (PCI)" },
];

const valorTexto = (v: number | null) => (v === null ? "—" : formatCurrency(v));
const statusTexto = (p: PontoMapa) => (p.kind === "obra" ? "Obra (PCI)" : rotulo(p.status));

/**
 * Pedido de 23/10: imóveis disponíveis e obras com localização (do imóvel vinculado
 * ou da PCI da CAIXA). Coordenadas ausentes não são inventadas: o item fica só na lista.
 */
export function MapaClient({ pontos }: { pontos: PontoMapa[] }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

  const filtrados = pontos.filter(
    (p) => (filtro === "todos" || p.kind === filtro) &&
      `${p.titulo} ${p.endereco ?? ""} ${p.tipo}`.toLowerCase().includes(busca.trim().toLowerCase())
  );
  const comPonto = filtrados.filter((p) => p.latitude !== null && p.longitude !== null);
  const pins: MapPinType[] = comPonto.map((p) => ({
    id: p.key, lat: p.latitude!, lng: p.longitude!, title: p.titulo, price: p.valor ?? undefined,
    type: p.kind === "obra" ? "obra" : p.tipo, href: p.href ?? undefined,
  }));
  const atual = selecionado ? filtrados.find((p) => p.key === selecionado) ?? null : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Mapa Operacional</h1>
          <p className="text-gray-600 text-sm mt-0.5">
            {comPonto.length} pontos no mapa · {filtrados.length - comPonto.length} sem coordenadas válidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-600" />
          <div className="flex border border-gray-200">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`px-3 py-2 text-xs font-bold uppercase transition-colors ${filtro === f.id ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-700 hover:bg-gray-50"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
        Buscar endereço, título ou tipo
        <input value={busca} onChange={(e) => setBusca(e.target.value)} className="mt-1 w-full border border-gray-200 px-3 py-2.5 text-sm font-normal normal-case text-gray-900 bg-white" />
      </label>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-gray-100 overflow-hidden">
          <PropertyMap
            pins={selecionado ? pins.filter((p) => p.id === selecionado) : pins}
            height="480px"
            onPinClick={(pin) => setSelecionado(selecionado === pin.id ? null : pin.id)}
          />
        </div>
        <div className="space-y-3">
          {atual ? (
            <div className="bg-white border border-[var(--brand-yellow)] p-5 space-y-1">
              <span className="text-[10px] font-bold bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-2 py-0.5 uppercase">{atual.kind === "obra" ? "Obra" : rotulo(atual.tipo)}</span>
              <h3 className="font-bold text-[var(--brand-dark)] pt-1">{atual.titulo}</h3>
              <p className="font-black text-[var(--brand-dark)] text-xl">{valorTexto(atual.valor)}</p>
              <p className="text-gray-700 text-xs">{atual.endereco ?? "Endereço não informado"}</p>
              {atual.href && <Link href={atual.href} className="inline-block text-xs font-bold underline text-[var(--brand-dark)]">Abrir</Link>}
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
              <MapPin size={24} className="text-gray-500 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Clique em um marcador para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-gray-100">
        <table className="w-full text-sm text-gray-800">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-600">
            <tr>
              {["Imóvel", "Endereço", "Valor", "Status", "Coordenadas"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-600">Nenhum item.</td></tr>}
            {filtrados.map((p) => (
              <tr key={p.key}>
                <td className="px-4 py-3">
                  {p.href ? <Link href={p.href} className="font-medium underline text-[var(--brand-dark)]">{p.titulo}</Link> : p.titulo}
                  <br /><span className="text-xs text-gray-600">{p.kind === "obra" ? "Obra" : rotulo(p.tipo)}</span>
                </td>
                <td className="px-4 py-3">{p.endereco ?? "Endereço não informado"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{valorTexto(p.valor)}</td>
                <td className="px-4 py-3">{statusTexto(p)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{p.latitude !== null && p.longitude !== null ? `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}` : "Sem coordenadas"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
