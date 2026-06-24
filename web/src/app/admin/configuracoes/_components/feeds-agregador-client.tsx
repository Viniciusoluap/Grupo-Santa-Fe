"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { salvarFeedsAgregador } from "@/lib/actions/agregador-xml";

interface Props {
  feedUrls: string[];
}

export function FeedsAgregadorClient({ feedUrls: initialUrls }: Props) {
  const [urls, setUrls] = useState<string[]>(initialUrls.length > 0 ? initialUrls : [""]);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function addUrl() {
    setUrls((prev) => [...prev, ""]);
  }

  function removeUrl(i: number) {
    setUrls((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateUrl(i: number, val: string) {
    setUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));
  }

  function handleSave() {
    const valid = urls.filter((u) => u.trim().startsWith("http"));
    startTransition(async () => {
      await salvarFeedsAgregador(valid);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="bg-white border border-gray-100 p-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Fontes de Agregação (Feeds XML)</p>
      <p className="text-xs text-gray-400 mb-4">
        URLs de feeds XML (ZAP/OLX ListingDataFeed) para importação automática. Uma por linha.
      </p>
      <div className="space-y-2 mb-4">
        {urls.map((url, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.zap.com.br/xml/feed.xml"
              value={url}
              onChange={(e) => updateUrl(i, e.target.value)}
              className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
            />
            <button
              type="button"
              onClick={() => removeUrl(i)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addUrl}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold text-xs uppercase tracking-wider px-3 py-2 transition-colors"
        >
          <Plus size={12} /> Adicionar URL
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2 transition-colors disabled:opacity-60"
        >
          {isPending ? "Salvando…" : "Salvar Fontes"}
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">Salvo!</span>}
      </div>
    </div>
  );
}
