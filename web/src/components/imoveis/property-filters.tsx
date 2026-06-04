"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback } from "react";

const types = [
  { value: "", label: "Todos os tipos" },
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Apartamento" },
  { value: "lote", label: "Lote / Terreno" },
  { value: "chacara", label: "Chácara" },
  { value: "comercial", label: "Comercial" },
];

const statuses = [
  { value: "", label: "Compra ou Locação" },
  { value: "venda", label: "Compra" },
  { value: "locacao", label: "Locação" },
  { value: "lancamento", label: "Lançamento" },
];

const priceRanges = [
  { value: "", label: "Qualquer preço" },
  { value: "0-200000", label: "Até R$ 200 mil" },
  { value: "200000-400000", label: "R$ 200k – R$ 400k" },
  { value: "400000-700000", label: "R$ 400k – R$ 700k" },
  { value: "700000-99999999", label: "Acima de R$ 700k" },
];

const bedroomsOptions = [
  { value: "", label: "Qualquer" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

export function PropertyFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = searchParams.toString() !== "";

  return (
    <div className="bg-white border border-gray-100 shadow-sm p-4">
      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Buscar por bairro, cidade ou tipo..."
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Type */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Tipo
          </label>
          <select
            value={searchParams.get("type") ?? ""}
            onChange={(e) => updateFilter("type", e.target.value)}
            className="w-full py-2 px-3 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[var(--brand-yellow)] appearance-none cursor-pointer"
          >
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Finalidade
          </label>
          <select
            value={searchParams.get("status") ?? ""}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="w-full py-2 px-3 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[var(--brand-yellow)] appearance-none cursor-pointer"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Faixa de Preço
          </label>
          <select
            value={searchParams.get("price") ?? ""}
            onChange={(e) => updateFilter("price", e.target.value)}
            className="w-full py-2 px-3 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[var(--brand-yellow)] appearance-none cursor-pointer"
          >
            {priceRanges.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bedrooms */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Quartos
          </label>
          <select
            value={searchParams.get("bedrooms") ?? ""}
            onChange={(e) => updateFilter("bedrooms", e.target.value)}
            className="w-full py-2 px-3 text-sm border border-gray-200 bg-white focus:outline-none focus:border-[var(--brand-yellow)] appearance-none cursor-pointer"
          >
            {bedroomsOptions.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters && (
        <div className="mt-3 flex justify-between items-center pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <SlidersHorizontal size={12} />
            Filtros aplicados
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
          >
            <X size={12} />
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
