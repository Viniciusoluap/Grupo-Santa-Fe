// EPIC-020 Lote 6 (30): Status do Processo com 3 opções escolhíveis
// (em_analise, em_andamento, concluido). "aguardando_configuracao" é a fila do
// CRM e "cancelado" vem da exclusão; os status antigos foram convertidos e o
// original ficou em "statusLegado".
export type RegStatus = "aguardando_configuracao"
  | "em_analise"
  | "em_andamento"
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
  aguardando_configuracao: { label: "Pendente de configuração", bgColor: "bg-amber-100", color: "text-amber-800", order: 0 },
  em_analise: { label: "Em análise", bgColor: "bg-gray-100", color: "text-gray-600", order: 1 },
  em_andamento: { label: "Em andamento", bgColor: "bg-blue-100", color: "text-blue-700", order: 2 },
  concluido: { label: "Concluído", bgColor: "bg-green-100", color: "text-green-700", order: 3 },
  cancelado: { label: "Cancelado", bgColor: "bg-red-100", color: "text-red-500", order: 4 },
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
