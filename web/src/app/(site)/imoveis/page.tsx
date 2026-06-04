import { Suspense } from "react";
import { filterProperties } from "@/lib/data/properties";
import { PropertyCard } from "@/components/imoveis/property-card";
import { PropertyFilters } from "@/components/imoveis/property-filters";
import { Building2, Search } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    status?: string;
    price?: string;
    bedrooms?: string;
    search?: string;
  }>;
}

export const metadata = {
  title: "Imóveis",
  description: "Encontre o imóvel ideal entre casas, apartamentos, lotes e terrenos.",
};

function PropertyGrid({ params }: { params: PageProps["searchParams"] extends Promise<infer T> ? T : never }) {
  const [minPrice, maxPrice] = params.price
    ? params.price.split("-").map(Number)
    : [undefined, undefined];

  const filtered = filterProperties({
    type: params.type,
    status: params.status,
    minPrice,
    maxPrice,
    bedrooms: params.bedrooms ? Number(params.bedrooms) : undefined,
    search: params.search,
  });

  if (filtered.length === 0) {
    return (
      <div className="col-span-full text-center py-20">
        <Search size={40} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-400 font-medium text-lg">
          Nenhum imóvel encontrado com esses filtros
        </p>
        <p className="text-gray-300 text-sm mt-1">
          Tente ajustar ou limpar os filtros de busca
        </p>
      </div>
    );
  }

  return (
    <>
      {filtered.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </>
  );
}

export default async function ImoveisPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [minPrice, maxPrice] = params.price
    ? params.price.split("-").map(Number)
    : [undefined, undefined];

  const filtered = filterProperties({
    type: params.type,
    status: params.status,
    minPrice,
    maxPrice,
    bedrooms: params.bedrooms ? Number(params.bedrooms) : undefined,
    search: params.search,
  });

  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-12">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-2">
            Catálogo
          </p>
          <h1 className="text-white font-black text-4xl md:text-5xl uppercase leading-tight">
            Nossos Imóveis
          </h1>
          <p className="text-gray-400 mt-3 text-sm">
            {filtered.length} imóvel{filtered.length !== 1 ? "is" : ""}{" "}
            encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <section className="bg-[var(--brand-gray-light)] py-8">
        <div className="max-w-7xl mx-auto px-4">
          <Suspense>
            <PropertyFilters />
          </Suspense>
        </div>
      </section>

      {/* Grid */}
      <section className="py-10 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-20">
                <Building2 size={40} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400 font-medium text-lg">
                  Nenhum imóvel encontrado com esses filtros
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  Tente ajustar ou limpar os filtros de busca
                </p>
              </div>
            ) : (
              filtered.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
