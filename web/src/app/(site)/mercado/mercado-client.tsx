"use client";

import { useState } from "react";
import { Search, MapPin, ExternalLink, CheckCircle2, Home } from "lucide-react";
import { SOURCE_CONFIG, DOCUMENTO_CONFIG } from "@/lib/types/agregador";
import type { AgregadorSource } from "@/lib/types/agregador";
import { formatCurrency } from "@/lib/utils";

interface Listing {
  id: string;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  precoTexto: string | null;
  area: number | null;
  tipo: string | null;
  bairro: string | null;
  cidade: string;
  fonte: string;
  urlFonte: string | null;
  imagens: string;
  status: string;
  documentoTipo: string;
  contatoTel: string | null;
}

interface Props {
  listings: Listing[];
}

export function MercadoClient({ listings }: Props) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [docFilter, setDocFilter] = useState<string>("todos");

  const availableSources = Array.from(new Set(listings.map((l) => l.fonte))) as AgregadorSource[];
  const availableTypes = Array.from(new Set(listings.map((l) => l.tipo).filter(Boolean)));

  const filtered = listings.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.titulo.toLowerCase().includes(q) ||
      l.bairro?.toLowerCase().includes(q) || l.descricao?.toLowerCase().includes(q);
    const matchSource = sourceFilter === "todos" || l.fonte === sourceFilter;
    const matchType = typeFilter === "todos" || l.tipo === typeFilter;
    const matchDoc = docFilter === "todos" || l.documentoTipo === docFilter;
    return matchSearch && matchSource && matchType && matchDoc;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setSourceFilter("todos")}
            className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${sourceFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400"}`}>
            Todas as fontes
          </button>
          {availableSources.map((s) => {
            const cfg = SOURCE_CONFIG[s] ?? { label: s, color: "#666", bg: "#eee" };
            return (
              <button key={s} onClick={() => setSourceFilter(s)}
                className="px-3 py-1.5 text-xs font-bold uppercase transition-all border"
                style={sourceFilter === s
                  ? { backgroundColor: cfg.color, color: "#fff", borderColor: cfg.color }
                  : { backgroundColor: cfg.bg, color: cfg.color, borderColor: "transparent" }}>
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase focus:outline-none focus:border-[var(--brand-yellow)]">
          <option value="todos">Todos os tipos</option>
          {availableTypes.map((t) => <option key={t} value={t!}>{t!.charAt(0).toUpperCase()}{t!.slice(1)}</option>)}
        </select>
        <select value={docFilter} onChange={(e) => setDocFilter(e.target.value)}
          className="border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase focus:outline-none focus:border-[var(--brand-yellow)]">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((l) => {
          const src = SOURCE_CONFIG[l.fonte as AgregadorSource] ?? { label: l.fonte, color: "#666", bg: "#eee" };
          const doc = DOCUMENTO_CONFIG[l.documentoTipo as keyof typeof DOCUMENTO_CONFIG] ?? { label: l.documentoTipo, color: "#666" };
          const images: string[] = JSON.parse(l.imagens || "[]");
          return (
            <div key={l.id} className="bg-white border border-gray-100 hover:border-[var(--brand-yellow)] transition-colors group">
              <div className="h-40 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                {images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0]} alt={l.titulo} className="w-full h-full object-cover" />
                ) : (
                  <Home size={32} className="text-gray-300" />
                )}
                <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5"
                  style={{ backgroundColor: src.bg, color: src.color }}>
                  {src.label}
                </span>
                <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2 py-0.5">
                  <CheckCircle2 size={10} /> Verificado
                </span>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-[var(--brand-dark)] text-sm leading-snug mb-1 line-clamp-2">{l.titulo}</h3>
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                  <MapPin size={11} />
                  {l.bairro && `${l.bairro} · `}{l.cidade}
                </div>
                {l.descricao && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{l.descricao}</p>}
                <div className="flex items-center justify-between mb-3">
                  <p className="font-black text-[var(--brand-dark)] text-lg leading-none">
                    {l.precoTexto ?? (l.preco ? formatCurrency(l.preco) : "Consultar")}
                  </p>
                  {l.area && <span className="text-xs text-gray-400">{l.area}m²</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-50" style={{ color: doc.color }}>
                    {doc.label}
                  </span>
                  {l.urlFonte && (
                    <a href={l.urlFonte} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--brand-dark)] transition-colors">
                      <ExternalLink size={11} /> Ver anúncio
                    </a>
                  )}
                </div>
                {l.contatoTel && (
                  <a href={`https://wa.me/55${l.contatoTel.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 w-full bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase py-2 hover:opacity-90 transition-opacity">
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

      <div className="mt-12 bg-[var(--brand-dark)] p-8 text-center">
        <p className="text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-widest mb-2">Não encontrou o que procura?</p>
        <h2 className="text-white font-black text-xl uppercase mb-3">Fale com a equipe Grupo Santa Fé</h2>
        <p className="text-gray-400 text-sm mb-5">Rua B N° 40 — Ouro Preto · CEP 68350-307 · Canaã dos Carajás-PA</p>
        <a href="https://wa.me/5594993044689" target="_blank" rel="noopener noreferrer"
          className="inline-block bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase px-6 py-2.5 hover:opacity-90 transition-opacity">
          WhatsApp — (94) 99304-4689
        </a>
      </div>
    </div>
  );
}
