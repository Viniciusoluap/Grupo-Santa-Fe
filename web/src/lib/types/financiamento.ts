export type FinanciamentoStatus =
  | "pre_analise"
  | "documentacao"
  | "analise_banco"
  | "aprovado"
  | "contrato"
  | "registro"
  | "liberado"
  | "cancelado";

export type FinanciamentoTipo = "mcmv" | "sbpe" | "pro_cotista" | "construcao" | "reforma";
export type BancoConvenio = "caixa" | "bb" | "bradesco" | "itau" | "santander";

export interface ChecklistItem {
  id: string;
  name: string;
  category: "pessoal" | "renda" | "imovel" | "banco";
  required: boolean;
  status: "pendente" | "enviado" | "aprovado" | "rejeitado";
  notes?: string;
  uploadedAt?: string;
}

export interface Financiamento {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  tipo: FinanciamentoTipo;
  banco: BancoConvenio;
  status: FinanciamentoStatus;
  corretor: string;
  property: string;
  propertyValue: number;
  financingValue: number;
  entry: number;
  fgts: number;
  income: number;
  installment: number;
  term: number;
  rate: number;
  startDate: string;
  expectedEnd?: string;
  protocolNumber?: string;
  checklist: ChecklistItem[];
  notes?: string;
}

export const STATUS_CONFIG: Record<FinanciamentoStatus, { label: string; order: number; bgColor: string; color: string }> = {
  pre_analise: { label: "Pré-análise", order: 1, bgColor: "bg-gray-100", color: "text-gray-600" },
  documentacao: { label: "Documentação", order: 2, bgColor: "bg-yellow-100", color: "text-yellow-700" },
  analise_banco: { label: "Análise Banco", order: 3, bgColor: "bg-blue-100", color: "text-blue-600" },
  aprovado: { label: "Aprovado", order: 4, bgColor: "bg-teal-100", color: "text-teal-700" },
  contrato: { label: "Contrato", order: 5, bgColor: "bg-purple-100", color: "text-purple-700" },
  registro: { label: "Registro", order: 6, bgColor: "bg-orange-100", color: "text-orange-600" },
  liberado: { label: "Liberado", order: 7, bgColor: "bg-green-100", color: "text-green-700" },
  cancelado: { label: "Cancelado", order: 8, bgColor: "bg-red-100", color: "text-red-500" },
};

export const TIPO_CONFIG: Record<FinanciamentoTipo, { label: string }> = {
  mcmv: { label: "Minha Casa Minha Vida" },
  sbpe: { label: "SBPE" },
  pro_cotista: { label: "Pró-Cotista FGTS" },
  construcao: { label: "Construção" },
  reforma: { label: "Reforma" },
};

export const BANCO_CONFIG: Record<BancoConvenio, { label: string }> = {
  caixa: { label: "Caixa Econômica Federal" },
  bb: { label: "Banco do Brasil" },
  bradesco: { label: "Bradesco" },
  itau: { label: "Itaú" },
  santander: { label: "Santander" },
};

export const CHECKLIST_CATEGORIES = {
  pessoal: "Documentos Pessoais",
  renda: "Comprovação de Renda",
  imovel: "Documentos do Imóvel",
  banco: "Documentos Bancários",
};
