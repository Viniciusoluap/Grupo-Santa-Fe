export type PropertyType = "casa" | "apartamento" | "lote" | "terreno" | "comercial" | "chacara";
export type PropertyStatus = "venda" | "locacao" | "lancamento";

export interface Property {
  id: string;
  slug: string;
  type: PropertyType;
  status: PropertyStatus;
  title: string;
  description: string;
  price: number;
  priceNegotiable?: boolean;
  condominium?: number;
  iptu?: number;
  area: number;
  areaTotal?: number;
  bedrooms?: number;
  suites?: number;
  bathrooms?: number;
  parking?: number;
  address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  features: string[];
  images: string[];
  badge?: string;
  featured?: boolean;
  createdAt: string;
}

export interface PropertyFilters {
  type?: PropertyType | "";
  status?: PropertyStatus | "";
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  bedrooms?: number;
  neighborhood?: string;
  search?: string;
}
