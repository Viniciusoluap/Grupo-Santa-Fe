import { Property, PropertyType, PropertyStatus } from "@/lib/types";
import type { Imovel } from "@/generated/prisma/client";

export const properties: Property[] = [
  {
    id: "1",
    slug: "casa-3-quartos-ouro-preto",
    type: "casa",
    status: "venda",
    title: "Casa 3 Quartos — Ouro Preto",
    description:
      "Linda casa no bairro Ouro Preto com acabamento de alto padrão, piso porcelanato, armários planejados e área gourmet. Próximo a escolas, supermercados e fácil acesso às principais vias.",
    price: 380000,
    priceNegotiable: true,
    iptu: 180,
    area: 120,
    areaTotal: 180,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking: 2,
    address: {
      street: "Rua B",
      neighborhood: "Ouro Preto",
      city: "Canaã dos Carajás",
      state: "PA",
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
    slug: "lote-novo-horizonte",
    type: "lote",
    status: "venda",
    title: "Lote Residencial — Novo Horizonte",
    description:
      "Excelente lote plano em localização privilegiada no Novo Horizonte. Toda documentação regularizada, terreno em aclive suave, ideal para construção de casa ou sobrado.",
    price: 120000,
    priceNegotiable: false,
    area: 300,
    address: {
      street: "Rua das Flores",
      neighborhood: "Novo Horizonte",
      city: "Canaã dos Carajás",
      state: "PA",
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
    slug: "apartamento-2-quartos-centro",
    type: "apartamento",
    status: "venda",
    title: "Apartamento 2 Quartos — Centro",
    description:
      "Apartamento moderno no Centro com vista privilegiada, reformado recentemente com materiais de qualidade. Condomínio com área de lazer e localização central.",
    price: 280000,
    condominium: 550,
    iptu: 80,
    area: 65,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    address: {
      street: "Av. Carajás",
      neighborhood: "Centro",
      city: "Canaã dos Carajás",
      state: "PA",
    },
    features: [
      "Área de lazer",
      "Portaria 24h",
      "Reformado",
      "Localização central",
    ],
    images: [],
    badge: "Novo",
    featured: true,
    createdAt: "2024-02-01",
  },
  {
    id: "4",
    slug: "casa-4-quartos-residencial-norte",
    type: "casa",
    status: "venda",
    title: "Casa 4 Quartos — Residencial Norte",
    description:
      "Ampla casa com 4 quartos sendo 2 suítes no Residencial Norte. Área de lazer completa com piscina, pergolado e jardim. Documentação em ordem.",
    price: 650000,
    priceNegotiable: true,
    iptu: 320,
    area: 220,
    areaTotal: 350,
    bedrooms: 4,
    suites: 2,
    bathrooms: 3,
    parking: 3,
    address: {
      street: "Rua das Acácias",
      neighborhood: "Residencial Norte",
      city: "Canaã dos Carajás",
      state: "PA",
    },
    features: [
      "2 suítes",
      "Piscina",
      "Pergolado",
      "Armários planejados",
      "Cozinha americana",
      "Home office",
    ],
    images: [],
    featured: false,
    createdAt: "2024-02-10",
  },
  {
    id: "5",
    slug: "kitnet-vila-funcionarios",
    type: "apartamento",
    status: "locacao",
    title: "Kitnet Mobiliada — Vila dos Funcionários",
    description:
      "Kitnet compacta e mobiliada na Vila dos Funcionários, ideal para trabalhadores da mineração. Água e energia incluídas no valor do aluguel.",
    price: 1500,
    area: 28,
    bedrooms: 1,
    bathrooms: 1,
    address: {
      street: "Rua C",
      neighborhood: "Vila dos Funcionários",
      city: "Canaã dos Carajás",
      state: "PA",
    },
    features: ["Mobiliada", "Água inclusa", "Energia inclusa", "Internet"],
    images: [],
    badge: "Locação",
    featured: false,
    createdAt: "2024-02-20",
  },
  {
    id: "6",
    slug: "lote-vale-dourado",
    type: "lote",
    status: "venda",
    title: "Lote 500m² — Vale Dourado",
    description:
      "Lote em área nobre do Vale Dourado, topografia plana, escritura definitiva. Infraestrutura completa com pavimentação, água e luz.",
    price: 200000,
    area: 500,
    address: {
      street: "Rua A",
      neighborhood: "Vale Dourado",
      city: "Canaã dos Carajás",
      state: "PA",
    },
    features: [
      "Escritura definitiva",
      "Terreno plano",
      "Área nobre",
      "Infraestrutura completa",
    ],
    images: [],
    featured: false,
    createdAt: "2024-03-01",
  },
  {
    id: "7",
    slug: "casa-3-quartos-parque-industrial",
    type: "casa",
    status: "lancamento",
    title: "Casa 3 Quartos — Parque Industrial",
    description:
      "Lançamento exclusivo! Casas em condomínio fechado com projeto moderno. Entrega em 18 meses. Aceita FGTS e financiamento MCMV.",
    price: 290000,
    area: 95,
    areaTotal: 150,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking: 2,
    address: {
      street: "Rua das Palmeiras",
      neighborhood: "Parque Industrial",
      city: "Canaã dos Carajás",
      state: "PA",
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
    slug: "chacara-zona-rural-canaa",
    type: "chacara",
    status: "venda",
    title: "Chácara 2.000m² — Zona Rural",
    description:
      "Chácara com casa sede de 120m², pomar, poço artesiano e área para lazer. Ótima oportunidade para quem busca tranquilidade a poucos minutos de Canaã dos Carajás.",
    price: 350000,
    area: 2000,
    bedrooms: 3,
    bathrooms: 2,
    parking: 4,
    address: {
      street: "Estrada Municipal",
      neighborhood: "Zona Rural",
      city: "Canaã dos Carajás",
      state: "PA",
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

export function imovelToProperty(i: Imovel): Property {
  return {
    id: i.id,
    slug: i.slug,
    type: i.tipo as PropertyType,
    status: i.status as PropertyStatus,
    title: i.titulo,
    description: i.descricao,
    price: i.preco,
    priceNegotiable: i.precoNegociavel,
    condominium: i.condominio ?? undefined,
    iptu: i.iptu ?? undefined,
    area: i.area,
    areaTotal: i.areaTotal ?? undefined,
    bedrooms: i.quartos ?? undefined,
    suites: i.suites ?? undefined,
    bathrooms: i.banheiros ?? undefined,
    parking: i.vagas ?? undefined,
    address: {
      street: i.rua,
      neighborhood: i.bairro,
      city: i.cidade,
      state: i.estado,
    },
    features: JSON.parse(i.features || "[]"),
    images: JSON.parse(i.imagens || "[]"),
    badge: i.badge ?? undefined,
    featured: i.destaque,
    createdAt: i.criadoEm.toISOString(),
  };
}
