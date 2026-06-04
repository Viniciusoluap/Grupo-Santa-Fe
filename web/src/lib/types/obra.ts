export type ObraStatus = "orcamento" | "contratada" | "em_andamento" | "pausada" | "concluida" | "cancelada";
export type ObraTipo = "obra_nova" | "reforma" | "ampliacao" | "acabamento" | "estrutural";

export interface ObraEtapa {
  id: string;
  name: string;
  order: number;
  status: "pendente" | "em_andamento" | "concluida";
  startDate?: string;
  endDate?: string;
  progress: number;
  responsible?: string;
}

export interface DiarioEntry {
  id: string;
  date: string;
  author: string;
  weather: "sol" | "parcialmente_nublado" | "nublado" | "chuva";
  workers: number;
  activities: string;
  materials?: string;
  observations?: string;
  photos?: number;
}

export interface ObraOrcamento {
  category: string;
  planned: number;
  executed: number;
}

export interface Obra {
  id: string;
  name: string;
  clientName: string;
  clientPhone: string;
  address: string;
  tipo: ObraTipo;
  status: ObraStatus;
  responsibleEngineer: string;
  startDate: string;
  expectedEnd: string;
  actualEnd?: string;
  totalValue: number;
  paidValue: number;
  progress: number;
  area: number;
  etapas: ObraEtapa[];
  diario: DiarioEntry[];
  orcamento: ObraOrcamento[];
  notes?: string;
}

export const OBRA_STATUS_CONFIG: Record<ObraStatus, { label: string; bgColor: string; color: string; order: number }> = {
  orcamento: { label: "Orçamento", bgColor: "bg-gray-100", color: "text-gray-600", order: 1 },
  contratada: { label: "Contratada", bgColor: "bg-blue-100", color: "text-blue-600", order: 2 },
  em_andamento: { label: "Em Andamento", bgColor: "bg-yellow-100", color: "text-yellow-700", order: 3 },
  pausada: { label: "Pausada", bgColor: "bg-orange-100", color: "text-orange-600", order: 4 },
  concluida: { label: "Concluída", bgColor: "bg-green-100", color: "text-green-700", order: 5 },
  cancelada: { label: "Cancelada", bgColor: "bg-red-100", color: "text-red-500", order: 6 },
};

export const OBRA_TIPO_CONFIG: Record<ObraTipo, { label: string; icon: string }> = {
  obra_nova: { label: "Obra Nova", icon: "🏗️" },
  reforma: { label: "Reforma", icon: "🔨" },
  ampliacao: { label: "Ampliação", icon: "📐" },
  acabamento: { label: "Acabamento", icon: "🎨" },
  estrutural: { label: "Reforço Estrutural", icon: "⚙️" },
};

export const WEATHER_CONFIG = {
  sol: { label: "Ensolarado", icon: "☀️" },
  parcialmente_nublado: { label: "Parcialmente nublado", icon: "⛅" },
  nublado: { label: "Nublado", icon: "☁️" },
  chuva: { label: "Chuva", icon: "🌧️" },
};
