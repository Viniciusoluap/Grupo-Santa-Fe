import Link from "next/link";
import { MapPin, BedDouble, Bath, Car, Maximize2 } from "lucide-react";
import { Property } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const typeLabel: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  lote: "Lote",
  terreno: "Terreno",
  comercial: "Comercial",
  chacara: "Chácara",
};

const statusLabel: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  lancamento: "Lançamento",
};

const statusColor: Record<string, string> = {
  venda: "bg-[var(--brand-dark)] text-[var(--brand-yellow)]",
  locacao: "bg-blue-700 text-white",
  lancamento: "bg-[var(--brand-yellow)] text-[var(--brand-dark)]",
};

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Card className="overflow-hidden group hover:-translate-y-1 transition-transform duration-200">
      {/* Image */}
      <div className="relative h-52 bg-[var(--brand-dark)] flex items-center justify-center overflow-hidden">
        {property.images && property.images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.images[0]}
            alt={property.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="text-[var(--brand-yellow)]/10 text-8xl font-black uppercase select-none">
            {typeLabel[property.type]?.[0]}
          </div>
        )}

        {property.badge && (
          <div className="absolute top-3 left-3 bg-[var(--brand-yellow)] text-[var(--brand-dark)] text-xs font-black px-2 py-1 uppercase tracking-wide">
            {property.badge}
          </div>
        )}

        <div
          className={`absolute top-3 right-3 text-xs font-bold px-2 py-1 uppercase ${statusColor[property.status]}`}
        >
          {statusLabel[property.status]}
        </div>

        <div className="absolute bottom-3 left-3 bg-white/90 text-[var(--brand-dark)] text-xs font-bold px-2 py-1 uppercase">
          {typeLabel[property.type]}
        </div>
      </div>

      <CardContent className="pt-4">
        <p className="text-[var(--brand-yellow)] font-black text-xl leading-none">
          {formatCurrency(property.price)}
          {property.priceNegotiable && (
            <span className="text-gray-400 font-normal text-xs ml-1">
              • negociável
            </span>
          )}
        </p>

        <h3 className="font-bold text-[var(--brand-dark)] text-base mt-1.5 mb-2 leading-tight line-clamp-2">
          {property.title}
        </h3>

        <div className="flex items-center gap-1 text-gray-400 text-xs mb-4">
          <MapPin size={11} />
          <span className="truncate">
            {property.address.neighborhood}, {property.address.city}
          </span>
        </div>

        {/* Specs */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 border-t border-gray-100 pt-3 mb-4">
          <span className="flex items-center gap-1">
            <Maximize2 size={11} />
            {property.area} m²
          </span>
          {property.bedrooms && (
            <span className="flex items-center gap-1">
              <BedDouble size={11} />
              {property.bedrooms} qto{property.bedrooms > 1 ? "s" : ""}
            </span>
          )}
          {property.bathrooms && (
            <span className="flex items-center gap-1">
              <Bath size={11} />
              {property.bathrooms} banheiro{property.bathrooms > 1 ? "s" : ""}
            </span>
          )}
          {property.parking && (
            <span className="flex items-center gap-1">
              <Car size={11} />
              {property.parking} vaga{property.parking > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <Link
          href={`/imoveis/${property.id}`}
          className="block w-full text-center bg-[var(--brand-dark)] hover:bg-[var(--brand-yellow)] text-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-xs font-bold uppercase tracking-wider py-2.5 transition-colors duration-200"
        >
          Ver Detalhes
        </Link>
      </CardContent>
    </Card>
  );
}
