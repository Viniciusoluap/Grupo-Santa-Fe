import { LEAD_STAGE_CONFIG, type LeadStage } from "@/lib/types/crm";

export type LeadPipelineSnapshot = {
  etapaOperacional: string | null;
  status: string;
  arquivadoEm?: Date | string | null;
  excluidoEm?: Date | string | null;
};

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LEAD_STAGE_CONFIG, value);
}

// Somente os dois estados inequívocos recebem equivalência. Os outros estados
// comerciais permanecem registrados e aguardam classificação operacional.
export function etapaDoLead(lead: LeadPipelineSnapshot): LeadStage | null {
  if (isLeadStage(lead.etapaOperacional)) return lead.etapaOperacional;
  if (lead.etapaOperacional) return null;
  if (lead.status === "novo") return "novo_lead";
  if (lead.status === "contato") return "em_atendimento";
  return null;
}

export function leadNoPipelineAtivo(lead: LeadPipelineSnapshot): boolean {
  return !lead.arquivadoEm && !lead.excluidoEm && !["perdido", "arquivado", "archived", "lost", "excluido", "deleted"].includes(lead.status);
}

export function parseServicosLead(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
    if (typeof parsed === "string") return parsed.trim() ? [parsed] : [];
  } catch { /* Serviço legado em texto simples. */ }
  return value.trim() ? [value] : [];
}
