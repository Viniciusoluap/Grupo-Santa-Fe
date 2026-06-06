"use client";

import { useState } from "react";
import { Search, MapPin, ExternalLink, CheckCircle2, Home } from "lucide-react";
import { getVerifiedListings } from "@/lib/data/agregador";
import { SOURCE_CONFIG, DOCUMENTO_CONFIG } from "@/lib/types/agregador";
import type { AgregadorSource } from "@/lib/types/agregador";
import { formatCurrency } from "@/lib/utils";

const listings = getVerifiedListings();

const SOURCES_AVAILABLE = Array.from(new Set(listings.map((l) => l.source))) as AgregadorSource[];

export default function MercadoPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [docFilter, setDocFilter] = useState<string>("todos");

  const types = Array.from(new Set(listings.map((l) => l.type).filter(Boolean)));

  const filtered = listings.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      l.title.toLowerCase().includes(q) ||
      l.neighborhood?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q);
    const matchSource = sourceFilter === "todos" || l.source === sourceFilter;
    const matchType = typeFilter === "todos" || l.type === typeFilter;
    const matchDoc = docFilter === "todos" || l.documentoTipo === docFilter;
    return matchSearch && matchSource && matchType && matchDoc;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[var(--brand-dark)] py-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-widest mb-2">
            Canaã dos Carajás — PA
          </p>
          <h1 className="text-white font-black text-3xl md:text-4xl uppercase tracking-wide mb-3">
            Mercado de Imóveis
          </h1>
          <p className="text-gray-400 text-sm max-w-lg mx-auto mb-6">
            Todos os imóveis disponíveis na cidade — reunidos de OLX, ZAP, Facebook, Instagram e anúncios diretos. Verificados pela equipe Grupo Santa Fé.
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por bairro, tipo ou descrição..."
              className="w-full pl-11 pr-4 py-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-yellow)]"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Source filter */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSourceFilter("todos")}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${sourceFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400"}`}
            >
              Todas as fontes
            </button>
            {SOURCES_AVAILABLE.map((s) => {
              const cfg = SOURCE_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className="px-3 py-1.5 text-xs font-bold uppercase transition-all border"
                  style={
                    sourceFilter === s
                      ? { backgroundColor: cfg.color, color: "#fff", borderColor: cfg.color }
                      : { backgroundColor: cfg.bg, color: cfg.color, borderColor: "transparent" }
                  }
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase focus:outline-none focus:border-[var(--brand-yellow)]"
          >
            <option value="todos">Todos os tipos</option>
            {types.map((t) => <option key={t} value={t}>{t?.charAt(0).toUpperCase()}{t?.slice(1)}</option>)}
          </select>

          {/* Document filter */}
          <select
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value)}
            className="border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase focus:outline-none focus:border-[var(--brand-yellow)]"
          >
            <option value="todos">Qualquer documento</option>
            <option value="escritura">Escritura</option>
            <option value="loteamento">Loteamento</option>
            <option value="financiado">Financiado</option>
            <option value="contrato_gaveta">Contrato de Gaveta</option>
            <option value="posse">Posse</option>
          </select>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          <span className="font-bold text-[var(--brand-dark)]">{filtered.length}</span> imóveis encontrados
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((l) => {
            const src = SOURCE_CONFIG[l.source];
            const doc = DOCUMENTO_CONFIG[l.documentoTipo];
            return (
              <div key={l.id} className="bg-white border border-gray-100 hover:border-[var(--brand-yellow)] transition-colors group">
                {/* Image placeholder */}
                <div className="h-40 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
                  ) : (
                    <Home size={32} className="text-gray-300" />
                  )}
                  {/* Source badge */}
                  <span
                    className="absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5"
                    style={{ backgroundColor: src.bg, color: src.color }}
                  >
                    {src.label}
                  </span>
                  {/* Verified badge */}
                  {l.status === "verificado" && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2 py-0.5">
                      <CheckCircle2 size={10} /> Verificado
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-[var(--brand-dark)] text-sm leading-snug group-hover:text-[var(--brand-dark)] mb-1 line-clamp-2">
                    {l.title}
                  </h3>

                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                    <MapPin size={11} />
                    {l.neighborhood && `${l.neighborhood} · `}{l.city}
                  </div>

                  {l.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{l.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <p className="font-black text-[var(--brand-dark)] text-lg leading-none">
                      {l.priceText ?? (l.price ? formatCurrency(l.price) : "Consultar")}
                    </p>
                    {l.area && (
                      <span className="text-xs text-gray-400">{l.area}m²</span>
                    )}
                  </div>

                  {/* Document tag */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-50" style={{ color: doc.color }}>
                      {doc.label}
                    </span>
                    {l.sourceUrl && (
                      <a
                        href={l.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--brand-dark)] transition-colors"
                      >
                        <ExternalLink size={11} /> Ver anúncio
                      </a>
                    )}
                  </div>

                  {l.contactPhone && (
                    <a
                      href={`https://wa.me/55${l.contactPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 w-full bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase py-2 hover:opacity-90 transition-opacity"
                    >
                      Falar no WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Search size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum imóvel encontrado para os filtros selecionados.</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-[var(--brand-dark)] p-8 text-center">
          <p className="text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-widest mb-2">Não encontrou o que procura?</p>
          <h2 className="text-white font-black text-xl uppercase mb-3">Fale com a equipe Grupo Santa Fé</h2>
          <p className="text-gray-400 text-sm mb-5">Av. JK N° 103 — Vale Dourado/Centro · Em frente ao SINE · Canaã dos Carajás-PA</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="https://wa.me/5594993044689"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase px-6 py-2.5 hover:opacity-90 transition-opacity"
            >
              WhatsApp — (94) 99304-4689
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
