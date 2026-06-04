export type ProcessStage =
  | "cadastro"
  | "analise"
  | "documentacao"
  | "aprovacao"
  | "contrato"
  | "financiamento"
  | "entrega";

export type DocumentStatus = "pendente" | "enviado" | "aprovado" | "rejeitado";
export type ServiceType = "compra" | "financiamento_mcmv" | "financiamento_conv" | "locacao" | "obra" | "regularizacao";

export interface ClientDocument {
  id: string;
  name: string;
  required: boolean;
  status: DocumentStatus;
  uploadedAt?: string;
  notes?: string;
}

export interface ProcessUpdate {
  id: string;
  date: string;
  stage: ProcessStage;
  message: string;
  by: string;
}

export interface ClientProcess {
  id: string;
  clientName: string;
  service: ServiceType;
  property: string;
  currentStage: ProcessStage;
  startDate: string;
  estimatedEnd?: string;
  corretor: string;
  corretorPhone: string;
  corretorEmail: string;
  documents: ClientDocument[];
  updates: ProcessUpdate[];
  propertyValue?: number;
  financingValue?: number;
  progress: number;
}

export const STAGE_CONFIG: Record<ProcessStage, { label: string; order: number; icon: string }> = {
  cadastro: { label: "Cadastro", order: 1, icon: "📋" },
  analise: { label: "Análise", order: 2, icon: "🔍" },
  documentacao: { label: "Documentação", order: 3, icon: "📄" },
  aprovacao: { label: "Aprovação", order: 4, icon: "✅" },
  contrato: { label: "Contrato", order: 5, icon: "📝" },
  financiamento: { label: "Financiamento", order: 6, icon: "🏦" },
  entrega: { label: "Entrega", order: 7, icon: "🏠" },
};

export const DOC_STATUS_CONFIG: Record<DocumentStatus, { label: string; bgColor: string; color: string }> = {
  pendente: { label: "Pendente", bgColor: "bg-gray-100", color: "text-gray-500" },
  enviado: { label: "Enviado", bgColor: "bg-blue-100", color: "text-blue-600" },
  aprovado: { label: "Aprovado", bgColor: "bg-green-100", color: "text-green-700" },
  rejeitado: { label: "Rejeitado", bgColor: "bg-red-100", color: "text-red-500" },
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  compra: "Compra de Imóvel",
  financiamento_mcmv: "Financiamento MCMV",
  financiamento_conv: "Financiamento Convencional",
  locacao: "Locação",
  obra: "Obra / Reforma",
  regularizacao: "Regularização Imobiliária",
};
