export type LeadStatus =
  | "novo"
  | "contato"
  | "visita_agendada"
  | "proposta"
  | "negociacao"
  | "ganho"
  | "perdido";

export type InteractionType = "ligacao" | "whatsapp" | "email" | "visita" | "nota";
export type LeadSource = "site" | "whatsapp" | "indicacao" | "instagram" | "facebook" | "outro";

export interface Interaction {
  id: string;
  type: InteractionType;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface Visit {
  id: string;
  propertyId: string;
  propertyTitle: string;
  scheduledAt: string;
  status: "agendada" | "realizada" | "cancelada";
  notes?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  status: LeadStatus;
  source: LeadSource;
  assignedTo: string;
  propertyInterestId?: string;
  budget?: number;
  notes: string;
  interactions: Interaction[];
  visits: Visit[];
  createdAt: string;
  updatedAt: string;
}

export const LEAD_STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bgColor: string; order: number }
> = {
  novo: { label: "Novo", color: "text-[var(--brand-dark)]", bgColor: "bg-[var(--brand-yellow)]", order: 0 },
  contato: { label: "Em Contato", color: "text-blue-700", bgColor: "bg-blue-100", order: 1 },
  visita_agendada: { label: "Visita Agendada", color: "text-purple-700", bgColor: "bg-purple-100", order: 2 },
  proposta: { label: "Proposta Enviada", color: "text-orange-700", bgColor: "bg-orange-100", order: 3 },
  negociacao: { label: "Negociação", color: "text-amber-700", bgColor: "bg-amber-100", order: 4 },
  ganho: { label: "Ganho", color: "text-green-700", bgColor: "bg-green-100", order: 5 },
  perdido: { label: "Perdido", color: "text-red-600", bgColor: "bg-red-100", order: 6 },
};

export const INTERACTION_CONFIG: Record<
  InteractionType,
  { label: string; icon: string }
> = {
  ligacao: { label: "Ligação", icon: "📞" },
  whatsapp: { label: "WhatsApp", icon: "💬" },
  email: { label: "E-mail", icon: "✉️" },
  visita: { label: "Visita", icon: "🏠" },
  nota: { label: "Nota Interna", icon: "📝" },
};
