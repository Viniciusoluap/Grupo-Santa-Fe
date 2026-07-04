"use client";

import { useState } from "react";
import { MapPinned, Mountain, Calculator, FileText } from "lucide-react";
import { TerrenoTab } from "./terreno-tab";
import { TopografiaTab } from "./topografia-tab";
import { ViabilidadeTab } from "./viabilidade-tab";
import { RelatorioTab } from "./relatorio-tab";

export interface EstudoData {
  id: string;
  nome: string;
  municipio: string;
  estado: string;
  status: string;
  kmlUrl: string | null;
  geojson: string | null;
  areaM2: number;
  perimetroM: number;
  centroLat: number | null;
  centroLng: number | null;
  elevacaoJson: string | null;
  levantamentoUrl: string | null;
  viabilidadeJson: string | null;
  parecerIa: string | null;
  relatorios: string;
}

const TABS = [
  { id: "terreno", label: "Terreno", icon: MapPinned },
  { id: "topografia", label: "Topografia 3D", icon: Mountain },
  { id: "viabilidade", label: "Viabilidade (EVE)", icon: Calculator },
  { id: "relatorio", label: "Relatório", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function IncorporacaoDetail({ estudo }: { estudo: EstudoData }) {
  const [tab, setTab] = useState<TabId>("terreno");
  const temTerreno = !!estudo.geojson;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {TABS.map((t) => {
          const disabled = t.id !== "terreno" && !temTerreno;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setTab(t.id)}
              disabled={disabled}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
                  : disabled
                  ? "border-transparent text-gray-300 cursor-not-allowed"
                  : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="pt-5">
        {tab === "terreno" && <TerrenoTab estudo={estudo} />}
        {tab === "topografia" && <TopografiaTab estudo={estudo} />}
        {tab === "viabilidade" && <ViabilidadeTab estudo={estudo} />}
        {tab === "relatorio" && <RelatorioTab estudo={estudo} />}
      </div>

      {!temTerreno && (
        <p className="text-xs text-gray-400 mt-3">
          Envie o KML do terreno na aba <b>Terreno</b> para habilitar as demais análises.
        </p>
      )}
    </div>
  );
}
