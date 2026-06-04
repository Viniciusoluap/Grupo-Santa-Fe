import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  BedDouble,
  Bath,
  Car,
  Maximize2,
  CheckCircle2,
  Phone,
  MessageSquare,
  ArrowLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import { getPropertyById, properties } from "@/lib/data/properties";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return properties.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const property = getPropertyById(id);
  if (!property) return {};
  return {
    title: property.title,
    description: property.description.slice(0, 160),
  };
}

const typeLabel: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  lote: "Lote",
  terreno: "Terreno",
  comercial: "Comercial",
  chacara: "Chácara",
};

const statusLabel: Record<string, string> = {
  venda: "À Venda",
  locacao: "Para Locação",
  lancamento: "Lançamento",
};

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const property = getPropertyById(id);

  if (!property) notFound();

  const whatsappMsg = encodeURIComponent(
    `Olá! Tenho interesse no imóvel: ${property.title} (R$ ${property.price.toLocaleString("pt-BR")}). Poderia me dar mais informações?`
  );

  return (
    <div className="bg-[var(--brand-gray-light)] min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-gray-400">
            <Link href="/" className="hover:text-[var(--brand-yellow)] flex items-center gap-1">
              <Home size={11} /> Início
            </Link>
            <ChevronRight size={10} />
            <Link href="/imoveis" className="hover:text-[var(--brand-yellow)]">
              Imóveis
            </Link>
            <ChevronRight size={10} />
            <span className="text-gray-600 truncate max-w-xs">{property.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image gallery placeholder */}
            <div className="relative bg-[var(--brand-dark)] aspect-video flex items-center justify-center">
              <div className="text-[var(--brand-yellow)]/10 text-9xl font-black uppercase select-none">
                {typeLabel[property.type]?.[0]}
              </div>
              {property.badge && (
                <div className="absolute top-4 left-4 bg-[var(--brand-yellow)] text-[var(--brand-dark)] text-sm font-black px-3 py-1 uppercase tracking-wide">
                  {property.badge}
                </div>
              )}
              <div className="absolute bottom-4 right-4 text-xs text-gray-400">
                Fotos em breve
              </div>
            </div>

            {/* Title block */}
            <div className="bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[var(--brand-dark)] text-[var(--brand-yellow)] text-xs font-bold px-2 py-0.5 uppercase">
                      {typeLabel[property.type]}
                    </span>
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 uppercase">
                      {statusLabel[property.status]}
                    </span>
                  </div>
                  <h1 className="text-[var(--brand-dark)] font-black text-2xl md:text-3xl leading-tight">
                    {property.title}
                  </h1>
                  <div className="flex items-center gap-1 text-gray-400 text-sm mt-2">
                    <MapPin size={13} />
                    {property.address.street}, {property.address.neighborhood},{" "}
                    {property.address.city} — {property.address.state}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[var(--brand-yellow)] font-black text-3xl">
                    {formatCurrency(property.price)}
                  </p>
                  {property.priceNegotiable && (
                    <p className="text-green-600 text-xs font-medium mt-0.5">
                      Preço negociável
                    </p>
                  )}
                  {property.condominium && (
                    <p className="text-gray-400 text-xs mt-0.5">
                      Cond.: {formatCurrency(property.condominium)}/mês
                    </p>
                  )}
                  {property.iptu && (
                    <p className="text-gray-400 text-xs">
                      IPTU: {formatCurrency(property.iptu)}/mês
                    </p>
                  )}
                </div>
              </div>

              {/* Specs grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                <div className="flex flex-col items-center gap-1 p-3 bg-[var(--brand-gray-light)]">
                  <Maximize2 size={18} className="text-[var(--brand-yellow)]" />
                  <span className="font-bold text-[var(--brand-dark)] text-sm">
                    {property.area} m²
                  </span>
                  <span className="text-gray-400 text-xs">Área útil</span>
                </div>
                {property.bedrooms && (
                  <div className="flex flex-col items-center gap-1 p-3 bg-[var(--brand-gray-light)]">
                    <BedDouble size={18} className="text-[var(--brand-yellow)]" />
                    <span className="font-bold text-[var(--brand-dark)] text-sm">
                      {property.bedrooms}
                    </span>
                    <span className="text-gray-400 text-xs">
                      Quarto{property.bedrooms > 1 ? "s" : ""}
                      {property.suites ? ` (${property.suites} suíte${property.suites > 1 ? "s" : ""})` : ""}
                    </span>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="flex flex-col items-center gap-1 p-3 bg-[var(--brand-gray-light)]">
                    <Bath size={18} className="text-[var(--brand-yellow)]" />
                    <span className="font-bold text-[var(--brand-dark)] text-sm">
                      {property.bathrooms}
                    </span>
                    <span className="text-gray-400 text-xs">
                      Banheiro{property.bathrooms > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {property.parking && (
                  <div className="flex flex-col items-center gap-1 p-3 bg-[var(--brand-gray-light)]">
                    <Car size={18} className="text-[var(--brand-yellow)]" />
                    <span className="font-bold text-[var(--brand-dark)] text-sm">
                      {property.parking}
                    </span>
                    <span className="text-gray-400 text-xs">
                      Vaga{property.parking > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white p-6">
              <h2 className="font-bold text-[var(--brand-dark)] text-lg uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
                Descrição
              </h2>
              <p className="text-gray-600 leading-relaxed">{property.description}</p>
            </div>

            {/* Features */}
            {property.features.length > 0 && (
              <div className="bg-white p-6">
                <h2 className="font-bold text-[var(--brand-dark)] text-lg uppercase tracking-wide mb-4 pb-2 border-b border-gray-100">
                  Características
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {property.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <CheckCircle2
                        size={15}
                        className="text-[var(--brand-yellow)] shrink-0"
                      />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/imoveis"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--brand-dark)] transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar ao catálogo
            </Link>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Contact card */}
            <div className="bg-[var(--brand-dark)] p-6 sticky top-24">
              <p className="text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-widest mb-1">
                Interessado neste imóvel?
              </p>
              <p className="text-white font-bold text-lg mb-5">
                Fale com um corretor agora
              </p>

              <a
                href={`https://wa.me/5562999999999?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-sm uppercase tracking-wider py-3 transition-colors mb-3"
              >
                <MessageSquare size={16} />
                Chamar no WhatsApp
              </a>

              <a
                href="tel:+5562999999999"
                className="flex items-center justify-center gap-2 w-full border border-gray-600 hover:border-[var(--brand-yellow)] text-gray-300 hover:text-[var(--brand-yellow)] font-bold text-sm uppercase tracking-wider py-3 transition-colors mb-6"
              >
                <Phone size={16} />
                (62) 9 9999-9999
              </a>

              {/* Mini contact form */}
              <form className="space-y-3">
                <p className="text-gray-400 text-xs uppercase tracking-wide font-bold">
                  Agendar visita
                </p>
                <input
                  type="text"
                  placeholder="Seu nome"
                  className="w-full bg-white/10 border border-gray-700 text-white placeholder-gray-500 text-sm px-3 py-2.5 focus:outline-none focus:border-[var(--brand-yellow)]"
                />
                <input
                  type="tel"
                  placeholder="Seu telefone"
                  className="w-full bg-white/10 border border-gray-700 text-white placeholder-gray-500 text-sm px-3 py-2.5 focus:outline-none focus:border-[var(--brand-yellow)]"
                />
                <input
                  type="date"
                  className="w-full bg-white/10 border border-gray-700 text-gray-300 text-sm px-3 py-2.5 focus:outline-none focus:border-[var(--brand-yellow)]"
                />
                <button
                  type="submit"
                  className="w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-sm uppercase tracking-wider py-2.5 transition-colors"
                >
                  Agendar Visita
                </button>
              </form>
            </div>

            {/* Ref */}
            <div className="bg-white p-4 text-center">
              <p className="text-gray-400 text-xs">
                Ref: <span className="font-mono font-bold text-[var(--brand-dark)]">GSF-{property.id.padStart(4, "0")}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
