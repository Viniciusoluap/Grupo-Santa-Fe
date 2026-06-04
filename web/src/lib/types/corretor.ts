export type CommissionStatus = "pendente" | "aprovada" | "paga" | "cancelada";
export type CommissionType = "venda" | "locacao" | "captacao" | "indicacao";

export interface Commission {
  id: string;
  type: CommissionType;
  property: string;
  client: string;
  saleValue: number;
  rate: number;
  amount: number;
  status: CommissionStatus;
  dueDate: string;
  paidAt?: string;
  notes?: string;
}

export interface MonthlyTarget {
  month: string;
  target: number;
  achieved: number;
}

export interface Corretor {
  id: string;
  name: string;
  creci: string;
  phone: string;
  email: string;
  photo?: string;
  active: boolean;
  hireDate: string;
  specialties: string[];
  commissions: Commission[];
  monthlyTargets: MonthlyTarget[];
  leadsCount: number;
  closedDeals: number;
  conversionRate: number;
}

export const COMMISSION_STATUS_CONFIG: Record<CommissionStatus, { label: string; bgColor: string; color: string }> = {
  pendente: { label: "Pendente", bgColor: "bg-yellow-100", color: "text-yellow-700" },
  aprovada: { label: "Aprovada", bgColor: "bg-blue-100", color: "text-blue-700" },
  paga: { label: "Paga", bgColor: "bg-green-100", color: "text-green-700" },
  cancelada: { label: "Cancelada", bgColor: "bg-red-100", color: "text-red-500" },
};

export const COMMISSION_TYPE_CONFIG: Record<CommissionType, { label: string; icon: string }> = {
  venda: { label: "Venda", icon: "🏠" },
  locacao: { label: "Locação", icon: "🔑" },
  captacao: { label: "Captação", icon: "📌" },
  indicacao: { label: "Indicação", icon: "🤝" },
};
