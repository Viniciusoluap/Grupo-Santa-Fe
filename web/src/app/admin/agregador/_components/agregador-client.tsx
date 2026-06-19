"use client";

import { useState, useTransition } from "react";
import { Search, Plus, ExternalLink, CheckCircle2, Clock, Archive, Loader2, Link2, Download } from "lucide-react";
import { SOURCE_CONFIG, DOCUMENTO_CONFIG, STATUS_CONFIG } from "@/lib/types/agregador";
import type { AgregadorSource, DocumentoTipo } from "@/lib/types/agregador";
import { formatCurrency } from "@/lib/utils";
import type { ScrapedData } from "@/app/api/scraper/fetch/route";
import { atualizarStatusAgregador, criarAgregadorImovel, importarParaCatalogo } from "@/lib/actions/agregador";

const SOURCES: AgregadorSource[] = ["olx", "zapimoveis", "vivareal", "facebook", "instagram", "google", "direto", "outro"];
const DOCUMENTOS: DocumentoTipo[] = ["nenhum", "escritura", "contrato_gaveta", "inventario", "heranca", "financiado", "loteamento", "posse", "outros"];

// DB listing type (from Prisma)
interface DbListing {
  id: string;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  precoTexto: string | null;
  area: number | null;
  tipo: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  fonte: string;
  urlFonte: string | null;
  imagens: string;
  status: string;
  documentoTipo: string;
  documentoObs: string | null;
  contatoNome: string | null;
  contatoTel: string | null;
  notas: string | null;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "verificado" || status === "ativo") return <CheckCircle2 size={14} className="text-green-500" />;
  if (status === "descartado") return <Archive size={14} className="text-gray-400" />;
  if (status === "importado") return <Download size={14} className="text-blue-500" />;
  return <Clock size={14} className="text-yellow-500" />;
}

export function AgregadorClient({ initialListings = [] }: { initialListings: DbListing[] }) {
  const [listings, setListings] = useState<DbListing[]>(initialListings);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function feedback(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 3000);
  }

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      await atualizarStatusAgregador(id, status);
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
      feedback("Status atualizado.");
    });
  }

  function handleImportar(id: string, titulo: string) {
    if (!confirm(`Importar "${titulo}" para o catálogo de imóveis? Ele será adicionado como rascunho não publicado.`)) return;
    startTransition(async () => {
      await importarParaCatalogo(id);
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status: "importado" } : l));
      feedback("Imóvel importado para o catálogo! Acesse Imóveis para publicar.");
    });
  }

  // New listing form state
  const [formUrl, setFormUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState<ScrapedData | null>(null);
  const [formData, setFormData] = useState({
    title: "", description: "", price: "", area: "", bedrooms: "",
    bathrooms: "", type: "casa", neighborhood: "", contactPhone: "",
    contactName: "", documentoTipo: "nenhum" as DocumentoTipo,
    documentoObs: "", notes: "", source: "olx" as AgregadorSource,
  });

  const filtered = listings.filter((l) => {
    const matchSource = sourceFilter === "todos" || l.fonte === sourceFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || l.titulo.toLowerCase().includes(q) || l.bairro?.toLowerCase().includes(q);
    return matchSource && matchSearch;
  });

  async function handleScrape() {
    if (!formUrl.trim()) return;
    setScraping(true);
    setScraped(null);
    try {
      const res = await fetch("/api/scraper/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formUrl }),
      });
      const data: ScrapedData = await res.json();
      setScraped(data);
      if (data.title) setFormData((f) => ({ ...f, title: data.title ?? f.title }));
      if (data.description) setFormData((f) => ({ ...f, description: data.description ?? f.description }));
      if (data.price) setFormData((f) => ({ ...f, price: String(data.price ?? "") }));
    } catch {
      setScraped({ url: formUrl, images: [], error: "Erro ao buscar URL" });
    } finally {
      setScraping(false);
    }
  }

  const stats = {
    total: listings.length,
    verificados: listings.filter((l) => l.status === "verificado").length,
    pendentes: listings.filter((l) => l.status === "pendente").length,
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className="bg-[var(--brand-yellow)]/20 border border-[var(--brand-yellow)] px-3 py-2 text-xs font-bold text-[var(--brand-dark)]">
          {msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Agregador de Imóveis</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {stats.total} imóveis · {stats.verificados} verificados · {stats.pendentes} pendentes
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Adicionar Imóvel
        </button>
      </div>

      {/* Source tabs */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setSourceFilter("todos")}
          className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${sourceFilter === "todos" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
        >
          Todos ({listings.length})
        </button>
        {SOURCES.filter((s) => listings.some((l) => l.fonte === s)).map((s) => {
          const cfg = SOURCE_CONFIG[s];
          const count = listings.filter((l) => l.fonte === s).length;
          return (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${sourceFilter === s ? "text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              style={sourceFilter === s ? { backgroundColor: cfg.color } : {}}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou bairro..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
        />
      </div>

      {/* Listings table */}
      <div className="bg-white border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Imóvel", "Fonte", "Preço", "Documento", "Status", "Ações"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const src = SOURCE_CONFIG[l.fonte as AgregadorSource] ?? { label: l.fonte, color: "#666", bg: "#eee" };
              const doc = DOCUMENTO_CONFIG[l.documentoTipo as DocumentoTipo] ?? { label: l.documentoTipo, color: "#666" };
              const st = STATUS_CONFIG[l.status as keyof typeof STATUS_CONFIG] ?? { label: l.status, color: "#666" };
              return (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-[var(--brand-dark)] truncate">{l.titulo}</p>
                    <p className="text-xs text-gray-400">{l.bairro} · {l.cidade}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ backgroundColor: src.bg, color: src.color }}
                    >
                      {src.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-[var(--brand-dark)]">
                    {l.precoTexto ?? (l.preco ? formatCurrency(l.preco) : "—")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium" style={{ color: doc.color }}>{doc.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs" style={{ color: st.color }}>
                      <StatusIcon status={l.status} />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {l.urlFonte && (
                        <a href={l.urlFonte} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-[var(--brand-dark)] transition-colors px-2 py-1 border border-gray-200">
                          <ExternalLink size={10} /> Ver
                        </a>
                      )}
                      {l.status === "pendente" && (
                        <button onClick={() => handleStatusChange(l.id, "verificado")} disabled={isPending}
                          className="text-[10px] font-bold px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50">
                          ✓ Verificar
                        </button>
                      )}
                      {l.status === "verificado" && (
                        <button onClick={() => handleImportar(l.id, l.titulo)} disabled={isPending}
                          className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50">
                          ↗ Importar
                        </button>
                      )}
                      {l.status !== "descartado" && l.status !== "importado" && (
                        <button onClick={() => handleStatusChange(l.id, "descartado")} disabled={isPending}
                          className="text-[10px] font-bold px-2 py-1 bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50">
                          ✗
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nenhum imóvel encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add listing modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-black text-[var(--brand-dark)] uppercase tracking-wide">Adicionar Imóvel</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* URL scraper */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  URL do anúncio (OLX, ZAP, Facebook…)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://www.olx.com.br/item/..."
                      className="w-full pl-8 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                    />
                  </div>
                  <button
                    onClick={handleScrape}
                    disabled={scraping || !formUrl}
                    className="flex items-center gap-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] font-bold text-xs uppercase px-4 py-2.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {scraping ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    {scraping ? "Buscando…" : "Buscar"}
                  </button>
                </div>
                {scraped?.error && (
                  <p className="text-xs text-yellow-600 mt-1.5 bg-yellow-50 px-3 py-2">⚠ {scraped.error}</p>
                )}
                {scraped && !scraped.error && (
                  <p className="text-xs text-green-600 mt-1.5">✓ Dados extraídos automaticamente. Confira e complete abaixo.</p>
                )}
              </div>

              {/* Scraped image preview */}
              {scraped?.images && scraped.images.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Fotos encontradas ({scraped.images.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {scraped.images.map((img, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={img} alt="" className="h-20 w-28 object-cover flex-shrink-0 border border-gray-200" />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Título *</label>
                  <input
                    value={formData.title}
                    onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Casa 3 quartos — Centro"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fonte</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData((f) => ({ ...f, source: e.target.value as AgregadorSource }))}
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  >
                    {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Imóvel</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  >
                    {["casa", "apartamento", "lote", "terreno", "comercial", "kitnet", "chacara", "outro"].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData((f) => ({ ...f, price: e.target.value }))}
                    placeholder="Ex: 220000"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Área (m²)</label>
                  <input
                    type="number"
                    value={formData.area}
                    onChange={(e) => setFormData((f) => ({ ...f, area: e.target.value }))}
                    placeholder="Ex: 90"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Bairro</label>
                  <input
                    value={formData.neighborhood}
                    onChange={(e) => setFormData((f) => ({ ...f, neighborhood: e.target.value }))}
                    placeholder="Ex: Vale Dourado"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tipo de Documento</label>
                  <select
                    value={formData.documentoTipo}
                    onChange={(e) => setFormData((f) => ({ ...f, documentoTipo: e.target.value as DocumentoTipo }))}
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  >
                    {DOCUMENTOS.map((d) => <option key={d} value={d}>{DOCUMENTO_CONFIG[d].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Contato (telefone)</label>
                  <input
                    value={formData.contactPhone}
                    onChange={(e) => setFormData((f) => ({ ...f, contactPhone: e.target.value }))}
                    placeholder="Ex: 94 99188-8143"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações internas</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notas da equipe sobre esse imóvel..."
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  disabled={isPending || !formData.title}
                  onClick={() => {
                    startTransition(async () => {
                      await criarAgregadorImovel({
                        titulo: formData.title,
                        descricao: formData.description || undefined,
                        preco: formData.price ? parseFloat(formData.price) : undefined,
                        area: formData.area ? parseFloat(formData.area) : undefined,
                        tipo: formData.type,
                        bairro: formData.neighborhood || undefined,
                        fonte: formData.source,
                        urlFonte: formUrl || undefined,
                        imagens: scraped?.images ?? [],
                        documentoTipo: formData.documentoTipo,
                        documentoObs: formData.documentoObs || undefined,
                        contatoTel: formData.contactPhone || undefined,
                        contatoNome: formData.contactName || undefined,
                        notas: formData.notes || undefined,
                      });
                      setShowModal(false);
                      feedback("Imóvel adicionado ao agregador.");
                    });
                  }}
                  className="bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Salvar Imóvel"}
                </button>
                <button onClick={() => setShowModal(false)} className="border border-gray-200 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 hover:border-gray-300 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
