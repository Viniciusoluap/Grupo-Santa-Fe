export type AgregadorSource = "olx" | "zapimoveis" | "vivareal" | "facebook" | "instagram" | "google" | "direto" | "outro";
export type DocumentoTipo = "nenhum" | "escritura" | "contrato_gaveta" | "inventario" | "heranca" | "financiado" | "loteamento" | "posse" | "outros";
export type AgregadorStatus = "pendente" | "verificado" | "arquivado";

export interface AgregadorListing {
  id: string;
  source: AgregadorSource;
  sourceUrl: string;
  title: string;
  description?: string;
  price?: number;
  priceText?: string;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  type?: string;
  neighborhood?: string;
  city: string;
  state: string;
  images: string[];
  documentoTipo: DocumentoTipo;
  documentoObs?: string;
  contactPhone?: string;
  contactName?: string;
  status: AgregadorStatus;
  featured: boolean;
  scrapedAt: string;
  updatedAt: string;
  notes?: string;
}

export const SOURCE_CONFIG: Record<AgregadorSource, { label: string; color: string; bg: string }> = {
  olx:       { label: "OLX",            color: "#6E3ADB", bg: "#f5f0ff" },
  zapimoveis:{ label: "ZAP Imóveis",    color: "#E8190C", bg: "#fff0ef" },
  vivareal:  { label: "Viva Real",      color: "#00A884", bg: "#effaf6" },
  facebook:  { label: "Facebook",       color: "#1877F2", bg: "#eff5ff" },
  instagram: { label: "Instagram",      color: "#E1306C", bg: "#fff0f5" },
  google:    { label: "Google",         color: "#4285F4", bg: "#f0f5ff" },
  direto:    { label: "Anúncio Direto", color: "#F5C400", bg: "#fffbe6" },
  outro:     { label: "Outro",          color: "#6B7280", bg: "#f9fafb" },
};

export const DOCUMENTO_CONFIG: Record<DocumentoTipo, { label: string; color: string }> = {
  nenhum:          { label: "Sem informação", color: "#6B7280" },
  escritura:       { label: "Escritura",      color: "#16A34A" },
  contrato_gaveta: { label: "Contrato de Gaveta", color: "#D97706" },
  inventario:      { label: "Em Inventário",  color: "#DC2626" },
  heranca:         { label: "Herança",         color: "#7C3AED" },
  financiado:      { label: "Financiado",      color: "#2563EB" },
  loteamento:      { label: "Loteamento",      color: "#059669" },
  posse:           { label: "Posse",           color: "#B45309" },
  outros:          { label: "Outros",          color: "#6B7280" },
};

export const STATUS_CONFIG: Record<AgregadorStatus, { label: string; color: string }> = {
  pendente:    { label: "Pendente",    color: "#D97706" },
  verificado:  { label: "Verificado", color: "#16A34A" },
  arquivado:   { label: "Arquivado",  color: "#6B7280" },
};
