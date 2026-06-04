export type ProjetoStatus = "solicitado" | "em_elaboracao" | "revisao" | "aprovado" | "entregue" | "cancelado";
export type ProjetoTipo =
  | "projeto_arquitetonico"
  | "projeto_estrutural"
  | "projeto_eletrico"
  | "projeto_hidrossanitario"
  | "projeto_completo"
  | "orcamento_obra"
  | "laudo_tecnico"
  | "art_rrt";

export interface OrcamentoItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface ProjetoRevision {
  id: string;
  version: string;
  date: string;
  author: string;
  changes: string;
}

export interface Projeto {
  id: string;
  name: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  tipo: ProjetoTipo;
  status: ProjetoStatus;
  engineer: string;
  address: string;
  area?: number;
  startDate: string;
  deliveryDate?: string;
  actualDelivery?: string;
  projectValue: number;
  paidValue: number;
  artNumber?: string;
  description: string;
  orcamento: OrcamentoItem[];
  revisions: ProjetoRevision[];
  deliverables: string[];
}

export const PROJETO_STATUS_CONFIG: Record<ProjetoStatus, { label: string; bgColor: string; color: string; order: number }> = {
  solicitado: { label: "Solicitado", bgColor: "bg-gray-100", color: "text-gray-600", order: 1 },
  em_elaboracao: { label: "Em Elaboração", bgColor: "bg-yellow-100", color: "text-yellow-700", order: 2 },
  revisao: { label: "Em Revisão", bgColor: "bg-blue-100", color: "text-blue-600", order: 3 },
  aprovado: { label: "Aprovado", bgColor: "bg-teal-100", color: "text-teal-700", order: 4 },
  entregue: { label: "Entregue", bgColor: "bg-green-100", color: "text-green-700", order: 5 },
  cancelado: { label: "Cancelado", bgColor: "bg-red-100", color: "text-red-500", order: 6 },
};

export const PROJETO_TIPO_CONFIG: Record<ProjetoTipo, { label: string; icon: string }> = {
  projeto_arquitetonico: { label: "Projeto Arquitetônico", icon: "🏛️" },
  projeto_estrutural: { label: "Projeto Estrutural", icon: "⚙️" },
  projeto_eletrico: { label: "Projeto Elétrico", icon: "⚡" },
  projeto_hidrossanitario: { label: "Projeto Hidrossanitário", icon: "🔧" },
  projeto_completo: { label: "Projeto Completo", icon: "📐" },
  orcamento_obra: { label: "Orçamento de Obra", icon: "📊" },
  laudo_tecnico: { label: "Laudo Técnico", icon: "📋" },
  art_rrt: { label: "ART / RRT", icon: "📜" },
};
