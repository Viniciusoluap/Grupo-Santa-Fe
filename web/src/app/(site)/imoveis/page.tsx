import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { imovelToProperty } from "@/lib/data/properties";
import { PropertyCard } from "@/components/imoveis/property-card";
import { PropertyFilters } from "@/components/imoveis/property-filters";
import { Building2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";

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

export default async function ImoveisPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [minPrice, maxPrice] = params.price
    ? params.price.split("-").map(Number)
    : [undefined, undefined];

  const where: Record<string, unknown> = { publicadoSite: true };
  if (params.type) where.tipo = params.type;
  if (params.status) where.status = params.status;

  const imoveis = await prisma.imovel.findMany({ where });
  let filtered = imoveis.map(imovelToProperty);

  if (minPrice) filtered = filtered.filter((p) => p.price >= minPrice);
  if (maxPrice) filtered = filtered.filter((p) => p.price <= maxPrice);
  if (params.bedrooms) {
    const beds = Number(params.bedrooms);
    filtered = filtered.filter((p) => (p.bedrooms ?? 0) >= beds);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.address.neighborhood.toLowerCase().includes(q) ||
        p.address.city.toLowerCase().includes(q)
    );
  }

  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-12">
        <div className="max-w-7xl mx-auto px-4 mb-6">
          <BackButton className="text-gray-500 hover:text-[var(--brand-yellow)]" />
        </div>
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
