import { Property } from "@/lib/types";

export const properties: Property[] = [
  {
    id: "1",
    slug: "casa-3-quartos-setor-bueno",
    type: "casa",
    status: "venda",
    title: "Casa 3 Quartos — Setor Bueno",
    description:
      "Linda casa em condomínio fechado no Setor Bueno, com acabamento de alto padrão, piso porcelanato, armários planejados e área gourmet. Próximo a escolas, supermercados e fácil acesso às principais vias.",
    price: 450000,
    priceNegotiable: true,
    iptu: 220,
    area: 120,
    areaTotal: 180,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking: 2,
    address: {
      street: "Rua das Orquídeas",
      neighborhood: "Setor Bueno",
      city: "Goiânia",
      state: "GO",
    },
    features: [
      "Armários planejados",
      "Piso porcelanato",
      "Área gourmet",
      "Churrasqueira",
      "Condomínio fechado",
      "Portaria 24h",
    ],
    images: [],
    badge: "Destaque",
    featured: true,
    createdAt: "2024-01-10",
  },
  {
    id: "2",
    slug: "lote-jardim-europa",
    type: "lote",
    status: "venda",
    title: "Lote Residencial — Jardim Europa",
    description:
      "Excelente lote plano em localização privilegiada no Jardim Europa. Toda documentação regularizada, terreno em aclive suave, ideal para construção de casa ou sobrado.",
    price: 180000,
    priceNegotiable: false,
    area: 300,
    address: {
      street: "Avenida dos Ipês",
      neighborhood: "Jardim Europa",
      city: "Goiânia",
      state: "GO",
    },
    features: [
      "Documentação regularizada",
      "Terreno plano",
      "Infraestrutura completa",
      "Água e luz disponíveis",
    ],
    images: [],
    badge: "Oportunidade",
    featured: true,
    createdAt: "2024-01-15",
  },
  {
    id: "3",
    slug: "apartamento-2-quartos-setor-oeste",
    type: "apartamento",
    status: "venda",
    title: "Apartamento 2 Quartos — Setor Oeste",
    description:
      "Apartamento moderno no Setor Oeste com vista privilegiada, reformado recentemente com materiais de qualidade. Condomínio com piscina, academia e salão de festas.",
    price: 320000,
    condominium: 650,
    iptu: 95,
    area: 65,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    address: {
      street: "Rua Três",
      neighborhood: "Setor Oeste",
      city: "Goiânia",
      state: "GO",
    },
    features: [
      "Piscina",
      "Academia",
      "Salão de festas",
      "Portaria 24h",
      "Reformado",
    ],
    images: [],
    badge: "Novo",
    featured: true,
    createdAt: "2024-02-01",
  },
  {
    id: "4",
    slug: "casa-4-quartos-residencial-aldeia",
    type: "casa",
    status: "venda",
    title: "Casa 4 Quartos — Residencial Aldeia",
    description:
      "Ampla casa com 4 quartos sendo 2 suítes em condomínio de alto padrão. Área de lazer completa com piscina privativa, pergolado e jardim.",
    price: 780000,
    priceNegotiable: true,
    iptu: 380,
    area: 220,
    areaTotal: 350,
    bedrooms: 4,
    suites: 2,
    bathrooms: 3,
    parking: 3,
    address: {
      street: "Alameda dos Flamboyants",
      neighborhood: "Residencial Aldeia",
      city: "Goiânia",
      state: "GO",
    },
    features: [
      "2 suítes",
      "Piscina privativa",
      "Pergolado",
      "Armários planejados",
      "Cozinha americana",
      "Home office",
      "Condomínio fechado",
    ],
    images: [],
    featured: false,
    createdAt: "2024-02-10",
  },
  {
    id: "5",
    slug: "apartamento-studio-setor-marista",
    type: "apartamento",
    status: "venda",
    title: "Studio 1 Quarto — Setor Marista",
    description:
      "Studio compacto e moderno no Setor Marista, ideal para investimento ou moradia. Prédio novo com academia, lavanderia coletiva e localização excelente.",
    price: 195000,
    condominium: 480,
    area: 32,
    bedrooms: 1,
    bathrooms: 1,
    parking: 1,
    address: {
      street: "Av. 136",
      neighborhood: "Setor Marista",
      city: "Goiânia",
      state: "GO",
    },
    features: ["Academia", "Lavanderia coletiva", "Coworking", "Portaria 24h"],
    images: [],
    badge: "Investimento",
    featured: false,
    createdAt: "2024-02-20",
  },
  {
    id: "6",
    slug: "lote-condominio-alphaville",
    type: "lote",
    status: "venda",
    title: "Lote em Condomínio — Alphaville",
    description:
      "Lote premium em condomínio fechado de alto padrão. Infraestrutura completa, ruas pavimentadas, iluminação LED, área verde preservada e segurança 24h.",
    price: 420000,
    area: 500,
    address: {
      street: "Condomínio Alphaville",
      neighborhood: "Alphaville",
      city: "Goiânia",
      state: "GO",
    },
    features: [
      "Condomínio fechado",
      "Ruas pavimentadas",
      "Área verde",
      "Segurança 24h",
      "Infraestrutura completa",
    ],
    images: [],
    featured: false,
    createdAt: "2024-03-01",
  },
  {
    id: "7",
    slug: "casa-3-quartos-vila-rosa",
    type: "casa",
    status: "lancamento",
    title: "Casa 3 Quartos — Vila Rosa",
    description:
      "Lançamento exclusivo! Casas em condomínio fechado com projeto arquitetônico moderno. Entrega em 18 meses. Aceita FGTS e financiamento MCMV.",
    price: 310000,
    area: 95,
    areaTotal: 150,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking: 2,
    address: {
      street: "Rua das Magnólias",
      neighborhood: "Vila Rosa",
      city: "Goiânia",
      state: "GO",
    },
    features: [
      "Aceita FGTS",
      "Financiamento MCMV",
      "Condomínio fechado",
      "Projeto moderno",
      "1 suíte",
    ],
    images: [],
    badge: "Lançamento",
    featured: true,
    createdAt: "2024-03-05",
  },
  {
    id: "8",
    slug: "chacara-aparecida-goiania",
    type: "chacara",
    status: "venda",
    title: "Chácara 2.000m² — Aparecida de Goiânia",
    description:
      "Chácara com casa sede de 120m², pomar, poço artesiano e área para lazer. Ótima oportunidade para quem busca tranquilidade a poucos minutos da cidade.",
    price: 390000,
    area: 2000,
    bedrooms: 3,
    bathrooms: 2,
    parking: 4,
    address: {
      street: "Estrada do Lajeado",
      neighborhood: "Zona Rural",
      city: "Aparecida de Goiânia",
      state: "GO",
    },
    features: ["Poço artesiano", "Pomar", "Casa sede", "Área de lazer"],
    images: [],
    featured: false,
    createdAt: "2024-03-10",
  },
];

export function getPropertyById(id: string): Property | undefined {
  return properties.find((p) => p.id === id);
}

export function getFeaturedProperties(): Property[] {
  return properties.filter((p) => p.featured);
}

export function filterProperties(filters: {
  type?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  search?: string;
}): Property[] {
  return properties.filter((p) => {
    if (filters.type && p.type !== filters.type) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.minPrice && p.price < filters.minPrice) return false;
    if (filters.maxPrice && p.price > filters.maxPrice) return false;
    if (filters.bedrooms && (p.bedrooms ?? 0) < filters.bedrooms) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !p.title.toLowerCase().includes(q) &&
        !p.address.neighborhood.toLowerCase().includes(q) &&
        !p.address.city.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}
