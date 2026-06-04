import Link from "next/link";
import {
  Home,
  Building2,
  Wrench,
  FileCheck,
  Calculator,
  MapPin,
  Star,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Users,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const services = [
  {
    icon: Home,
    title: "Corretagem",
    description:
      "Compra, venda e locação de imóveis com assessoria completa do início ao fim do processo.",
    href: "/servicos/corretagem",
  },
  {
    icon: Calculator,
    title: "Financiamento Habitacional",
    description:
      "Simulação e acompanhamento de financiamento pelo MCMV, FGTS e principais bancos.",
    href: "/servicos/financiamento",
  },
  {
    icon: Wrench,
    title: "Obras e Reformas",
    description:
      "Construção, ampliação e reforma com gestão completa, cronograma e controle de qualidade.",
    href: "/servicos/obras",
  },
  {
    icon: Building2,
    title: "Projetos de Engenharia",
    description:
      "Projetos arquitetônicos, estruturais, elétricos e hidráulicos com orçamento detalhado.",
    href: "/servicos/projetos",
  },
  {
    icon: FileCheck,
    title: "Regularização Imobiliária",
    description:
      "Regularização de imóveis junto aos órgãos competentes com acompanhamento completo.",
    href: "/servicos/regularizacao",
  },
  {
    icon: MapPin,
    title: "Lotes e Terrenos",
    description:
      "Lotes em localidades selecionadas com toda documentação regularizada e infraestrutura.",
    href: "/imoveis/lotes",
  },
];

const stats = [
  { value: "500+", label: "Imóveis Negociados", icon: Home },
  { value: "300+", label: "Clientes Satisfeitos", icon: Users },
  { value: "50+", label: "Obras Entregues", icon: Building2 },
  { value: "10+", label: "Anos de Experiência", icon: Award },
];

const featuredProperties = [
  {
    id: 1,
    type: "Casa",
    title: "Casa 3 Quartos — Setor Bueno",
    price: 450000,
    area: 120,
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    location: "Setor Bueno, Goiânia",
    badge: "Destaque",
  },
  {
    id: 2,
    type: "Lote",
    title: "Lote Residencial — Jardim Europa",
    price: 180000,
    area: 300,
    bedrooms: null,
    bathrooms: null,
    parking: null,
    location: "Jardim Europa, Goiânia",
    badge: "Oportunidade",
  },
  {
    id: 3,
    type: "Apartamento",
    title: "Apartamento 2 Quartos — Setor Oeste",
    price: 320000,
    area: 65,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    location: "Setor Oeste, Goiânia",
    badge: "Novo",
  },
];

const reasons = [
  "Mais de 10 anos de experiência no mercado imobiliário",
  "Equipe de corretores e engenheiros especializados",
  "Acompanhamento completo do processo de compra",
  "Parceria com os principais bancos para financiamento",
  "Regularização e documentação garantida",
  "Atendimento personalizado e transparente",
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center bg-[var(--brand-dark)] overflow-hidden">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #F5C400 0, #F5C400 1px, transparent 0, transparent 50%)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute right-0 top-0 w-1/2 h-full bg-[var(--brand-yellow)] opacity-5 skew-x-12 translate-x-20" />

        <div className="relative max-w-7xl mx-auto px-4 w-full py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)]/30 text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-widest px-4 py-2 mb-8">
              <Star size={12} fill="currentColor" />
              Grupo Santa Fé — Construindo Negócios
            </div>

            <h1 className="text-white font-black text-5xl md:text-7xl leading-none uppercase mb-6">
              Seu imóvel{" "}
              <span className="text-[var(--brand-yellow)]">dos sonhos</span>{" "}
              começa aqui
            </h1>

            <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-10 max-w-xl">
              Corretagem, financiamento habitacional, obras, projetos de
              engenharia e regularização imobiliária — tudo em um só lugar.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="primary" size="lg" asChild>
                <Link href="/imoveis">
                  Ver Imóveis
                  <ArrowRight size={18} />
                </Link>
              </Button>
              <Button variant="outline-yellow" size="lg" asChild>
                <Link href="/contato">Falar com Especialista</Link>
              </Button>
            </div>

            {/* Quick search hint */}
            <div className="mt-12 flex flex-wrap gap-3">
              {["Casas", "Lotes", "Apartamentos", "Financiamento MCMV"].map(
                (tag) => (
                  <Link
                    key={tag}
                    href={`/imoveis?tipo=${tag.toLowerCase()}`}
                    className="text-xs bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 px-3 py-1.5 transition-colors font-medium"
                  >
                    {tag}
                  </Link>
                )
              )}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-[var(--brand-yellow)]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--brand-yellow-dark)]">
              {stats.map(({ value, label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 py-4 px-6"
                >
                  <Icon size={24} className="text-[var(--brand-dark)] opacity-60" />
                  <div>
                    <p className="font-black text-2xl text-[var(--brand-dark)] leading-none">
                      {value}
                    </p>
                    <p className="text-xs text-[var(--brand-dark-secondary)] font-medium mt-0.5">
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
              O que fazemos
            </p>
            <h2 className="text-[var(--brand-dark)] font-black text-4xl md:text-5xl uppercase leading-tight">
              Nossos Serviços
            </h2>
            <div className="w-16 h-1 bg-[var(--brand-yellow)] mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(({ icon: Icon, title, description, href }) => (
              <Card
                key={title}
                className="group hover:-translate-y-1 transition-transform duration-200"
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-[var(--brand-yellow)] flex items-center justify-center mb-5 group-hover:bg-[var(--brand-dark)] transition-colors">
                    <Icon size={22} className="text-[var(--brand-dark)] group-hover:text-[var(--brand-yellow)]" />
                  </div>
                  <h3 className="font-bold text-lg text-[var(--brand-dark)] mb-2 uppercase tracking-wide">
                    {title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-5">
                    {description}
                  </p>
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-dark)] hover:text-[var(--brand-yellow)] transition-colors uppercase tracking-wide"
                  >
                    Saiba mais <ArrowRight size={14} />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-14 gap-4">
            <div>
              <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
                Selecionados para você
              </p>
              <h2 className="text-[var(--brand-dark)] font-black text-4xl md:text-5xl uppercase leading-tight">
                Imóveis em Destaque
              </h2>
              <div className="w-16 h-1 bg-[var(--brand-yellow)] mt-4" />
            </div>
            <Button variant="outline" asChild>
              <Link href="/imoveis">
                Ver todos <ArrowRight size={16} />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProperties.map((property) => (
              <Card
                key={property.id}
                className="overflow-hidden group hover:-translate-y-1 transition-transform duration-200"
              >
                {/* Image placeholder */}
                <div className="relative h-52 bg-[var(--brand-dark)] flex items-center justify-center overflow-hidden">
                  <Building2
                    size={64}
                    className="text-[var(--brand-yellow)]/20"
                  />
                  <div className="absolute top-3 left-3 bg-[var(--brand-yellow)] text-[var(--brand-dark)] text-xs font-black px-2 py-1 uppercase tracking-wide">
                    {property.badge}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/90 text-[var(--brand-dark)] text-xs font-bold px-2 py-1 uppercase">
                    {property.type}
                  </div>
                </div>

                <CardContent className="pt-5">
                  <p className="text-[var(--brand-yellow)] font-black text-2xl">
                    {formatCurrency(property.price)}
                  </p>
                  <h3 className="font-bold text-[var(--brand-dark)] text-base mt-1 mb-2 leading-tight">
                    {property.title}
                  </h3>
                  <div className="flex items-center gap-1 text-gray-400 text-sm mb-4">
                    <MapPin size={12} />
                    {property.location}
                  </div>

                  {/* Property specs */}
                  <div className="flex gap-4 text-sm text-gray-500 border-t border-gray-100 pt-4 mb-5">
                    <span>{property.area} m²</span>
                    {property.bedrooms && <span>{property.bedrooms} qtos</span>}
                    {property.bathrooms && (
                      <span>{property.bathrooms} banheiros</span>
                    )}
                    {property.parking && (
                      <span>{property.parking} vaga{property.parking > 1 ? "s" : ""}</span>
                    )}
                  </div>

                  <Button variant="primary" className="w-full" size="sm" asChild>
                    <Link href={`/imoveis/${property.id}`}>Ver Detalhes</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-[var(--brand-dark)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
                Por que nos escolher
              </p>
              <h2 className="text-white font-black text-4xl md:text-5xl uppercase leading-tight mb-6">
                Seu negócio em{" "}
                <span className="text-[var(--brand-yellow)]">boas mãos</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-10">
                O Grupo Santa Fé é referência em soluções imobiliárias e de
                engenharia em Goiânia e região. Nossa equipe multidisciplinar
                garante atendimento completo em todas as etapas.
              </p>
              <Button variant="primary" size="lg" asChild>
                <Link href="/sobre">
                  Conheça Nossa História <ArrowRight size={18} />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="flex items-start gap-3 bg-white/5 hover:bg-[var(--brand-yellow)]/10 border border-white/10 hover:border-[var(--brand-yellow)]/30 p-4 transition-all duration-200"
                >
                  <CheckCircle2
                    size={20}
                    className="text-[var(--brand-yellow)] shrink-0 mt-0.5"
                  />
                  <span className="text-gray-300 text-sm">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 bg-[var(--brand-yellow)]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <TrendingUp
            size={40}
            className="text-[var(--brand-dark)] mx-auto mb-4 opacity-60"
          />
          <h2 className="text-[var(--brand-dark)] font-black text-4xl md:text-5xl uppercase leading-tight mb-4">
            Vamos construir juntos?
          </h2>
          <p className="text-[var(--brand-dark-secondary)] text-lg mb-8 max-w-xl mx-auto">
            Entre em contato e descubra como podemos ajudar você a realizar seu
            objetivo imobiliário.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button variant="dark" size="lg" asChild>
              <Link href="/contato">Solicitar Atendimento</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[var(--brand-dark)] text-[var(--brand-dark)] hover:bg-[var(--brand-dark)] hover:text-[var(--brand-yellow)]"
              asChild
            >
              <Link href="/imoveis">Explorar Imóveis</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
