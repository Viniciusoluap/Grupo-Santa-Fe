export type RegStatus =
  | "analise_inicial"
  | "documentacao"
  | "protocolo"
  | "em_analise_orgao"
  | "pendencias"
  | "aprovado"
  | "registrado"
  | "concluido"
  | "cancelado";

export type RegTipo =
  | "regularizacao_escritura"
  | "usucapiao"
  | "desmembramento"
  | "unificacao"
  | "retificacao"
  | "habite_se"
  | "averbacao"
  | "inventario_imovel";

export interface RegDocumento {
  id: string;
  name: string;
  orgao: string;
  required: boolean;
  status: "pendente" | "obtido" | "protocolado" | "aprovado";
  notes?: string;
  obtainedAt?: string;
}

export interface RegAndamento {
  id: string;
  date: string;
  status: RegStatus;
  description: string;
  orgao?: string;
  protocol?: string;
  by: string;
}

export interface Regularizacao {
  id: string;
  name: string;
  clientName: string;
  clientPhone: string;
  tipo: RegTipo;
  status: RegStatus;
  responsible: string;
  property: string;
  address: string;
  matricula?: string;
  startDate: string;
  estimatedEnd?: string;
  serviceValue: number;
  paidValue: number;
  documents: RegDocumento[];
  andamentos: RegAndamento[];
  notes?: string;
}

export const REG_STATUS_CONFIG: Record<RegStatus, { label: string; bgColor: string; color: string; order: number }> = {
  analise_inicial: { label: "Análise Inicial", bgColor: "bg-gray-100", color: "text-gray-600", order: 1 },
  documentacao: { label: "Documentação", bgColor: "bg-yellow-100", color: "text-yellow-700", order: 2 },
  protocolo: { label: "Protocolo", bgColor: "bg-blue-100", color: "text-blue-600", order: 3 },
  em_analise_orgao: { label: "Em Análise", bgColor: "bg-purple-100", color: "text-purple-700", order: 4 },
  pendencias: { label: "Pendências", bgColor: "bg-orange-100", color: "text-orange-600", order: 5 },
  aprovado: { label: "Aprovado", bgColor: "bg-teal-100", color: "text-teal-700", order: 6 },
  registrado: { label: "Registrado", bgColor: "bg-indigo-100", color: "text-indigo-700", order: 7 },
  concluido: { label: "Concluído", bgColor: "bg-green-100", color: "text-green-700", order: 8 },
  cancelado: { label: "Cancelado", bgColor: "bg-red-100", color: "text-red-500", order: 9 },
};

export const REG_TIPO_CONFIG: Record<RegTipo, { label: string; icon: string }> = {
  regularizacao_escritura: { label: "Regularização de Escritura", icon: "📜" },
  usucapiao: { label: "Usucapião", icon: "⚖️" },
  desmembramento: { label: "Desmembramento", icon: "✂️" },
  unificacao: { label: "Unificação de Matrículas", icon: "🔗" },
  retificacao: { label: "Retificação de Área", icon: "📐" },
  habite_se: { label: "Habite-se / Auto de Conclusão", icon: "🏠" },
  averbacao: { label: "Averbação", icon: "📋" },
  inventario_imovel: { label: "Inventário de Imóvel", icon: "📁" },
};
