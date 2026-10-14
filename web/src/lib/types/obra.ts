export type ObraStatus =
  | "planejamento" | "aprovacao" | "contrato_grupo_santa_fe" | "laudo_cef" | "conformidade_cef"
  | "aguardando_configuracao" | "orcamento" | "contratada" | "em_andamento" | "pausada" | "concluida" | "cancelada";
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
  planejamento: { label: "Planejamento", bgColor: "bg-sky-100", color: "text-sky-700", order: 1 },
  aprovacao: { label: "Aprovação", bgColor: "bg-indigo-100", color: "text-indigo-700", order: 2 },
  contrato_grupo_santa_fe: { label: "Contrato Grupo Santa Fé", bgColor: "bg-yellow-100", color: "text-yellow-800", order: 3 },
  laudo_cef: { label: "Laudo CEF", bgColor: "bg-emerald-100", color: "text-emerald-700", order: 4 },
  conformidade_cef: { label: "Conformidade CEF", bgColor: "bg-teal-100", color: "text-teal-700", order: 5 },
  // Estado de sistema da fila do CRM: exibido e filtrável, mas não escolhido à mão.
  aguardando_configuracao: { label: "Pendente de configuração", bgColor: "bg-amber-100", color: "text-amber-800", order: 0 },
  orcamento: { label: "Orçamento", bgColor: "bg-gray-100", color: "text-gray-600", order: 6 },
  contratada: { label: "Contratada", bgColor: "bg-blue-100", color: "text-blue-600", order: 7 },
  em_andamento: { label: "Em Andamento", bgColor: "bg-yellow-100", color: "text-yellow-700", order: 8 },
  pausada: { label: "Pausada", bgColor: "bg-orange-100", color: "text-orange-600", order: 9 },
  concluida: { label: "Concluída", bgColor: "bg-green-100", color: "text-green-700", order: 10 },
  cancelada: { label: "Cancelada", bgColor: "bg-red-100", color: "text-red-500", order: 11 },
};

// Pedido A1 (13/10/2026, paridade com a Prospecta): o seletor da edição oferece as
// mesmas situações do filtro da lista de obras, na mesma ordem. Só o estado de
// sistema "Pendente de configuração" (fila do CRM) fica fora da escolha manual.
export const OBRA_STATUS_SELECIONAVEIS = (Object.keys(OBRA_STATUS_CONFIG) as ObraStatus[])
  .filter((s) => s !== "aguardando_configuracao")
  .sort((a, b) => OBRA_STATUS_CONFIG[a].order - OBRA_STATUS_CONFIG[b].order);

export function obraStatusLabel(status: string): string {
  return OBRA_STATUS_CONFIG[status as ObraStatus]?.label ?? status;
}

export function isObraStatusSelecionavel(status: string): boolean {
  return (OBRA_STATUS_SELECIONAVEIS as readonly string[]).includes(status);
}

/** Erro compreensível quando a mudança não é permitida; `null` quando é válida. */
export function validarMudancaStatusObra(atual: string, novo: string): string | null {
  if (novo === atual || isObraStatusSelecionavel(novo)) return null;
  const opcoes = OBRA_STATUS_SELECIONAVEIS.map(obraStatusLabel).join(", ");
  return `A classificação "${obraStatusLabel(novo)}" não está disponível. Escolha uma destas: ${opcoes}.`;
}

/**
 * Lote 1 (item 09): o tipo de projeto exibido vem do serviço do CRM. A
 * classificação antiga (`tipo`) é preservada no banco e só aparece em obras
 * sem serviço vinculado.
 */
export function tipoProjetoObra(o: { tipo: string | null; servicoLead?: { servico: string } | null }): {
  label: string;
  icon: string;
  origem: "crm" | "legado" | null;
} {
  if (o.servicoLead?.servico) return { label: o.servicoLead.servico, icon: "🔨", origem: "crm" };
  const legado = OBRA_TIPO_CONFIG[o.tipo as ObraTipo];
  if (legado) return { ...legado, origem: "legado" };
  if (o.tipo) return { label: o.tipo, icon: "🏗️", origem: "legado" };
  return { label: "Não definido", icon: "🏗️", origem: null };
}

export const OBRA_TIPO_CONFIG: Record<ObraTipo, { label: string; icon: string }> = {
  // P-08: tipo antigo "Obra Nova" exibido como o serviço oficial do CRM, igual à Prospecta.
  obra_nova: { label: "Obra e reforma", icon: "🔨" },
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
