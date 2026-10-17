// Acesso do corretor (pedido de 15/10). Gêmeo de shared/broker-portal.ts da Prospecta.
import { LEAD_STAGES, LEAD_STAGE_CONFIG } from "@/lib/types/crm";
import { etapaDoLead, type LeadPipelineSnapshot } from "@/lib/crm/pipeline";

/** Tipos de imóvel que o corretor pode marcar (sem texto livre). */
export const TIPOS_IMOVEL_CORRETOR = [
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Apartamento" },
  { value: "lote", label: "Lote" },
  { value: "sala_comercial", label: "Sala comercial" },
  { value: "galpao", label: "Galpão" },
] as const;

/** Todos os tipos do cadastro da equipe (inclui os do corretor). */
export const TIPOS_IMOVEL = [
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Apartamento" },
  { value: "lote", label: "Lote" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
  { value: "sala_comercial", label: "Sala comercial" },
  { value: "galpao", label: "Galpão" },
  { value: "chacara", label: "Chácara" },
] as const;

export const ROTULO_TIPO_IMOVEL: Record<string, string> = Object.fromEntries(TIPOS_IMOVEL.map((t) => [t.value, t.label]));

export function tiposDoCadastro(perfil: string | null | undefined) {
  return perfil === "corretor" ? TIPOS_IMOVEL_CORRETOR : TIPOS_IMOVEL;
}

/** Nomes das etapas como aparecem no filtro do CRM. */
const NOME_ETAPA: Record<string, string> = {
  novo_lead: "Lead Novo",
  em_atendimento: "Em Atendimento",
  aprovado_follow_up: "Aprovado e Follow up",
  projetos_vistorias: "Projetos e Vistorias",
  contratos_cartorio: "Contratos e Cartório",
  medicoes: "Medições",
  finalizado: "Finalizado",
};

export const ETAPAS_ACOMPANHAMENTO = LEAD_STAGES.map((e) => ({ chave: e, nome: NOME_ETAPA[e] ?? LEAD_STAGE_CONFIG[e].label }));

/** Etapa do CRM em que o lead está, com a posição na régua das 7 etapas. */
export function etapaParaCorretor(lead: LeadPipelineSnapshot): { nome: string; indice: number } {
  const etapa = etapaDoLead(lead);
  const indice = etapa ? LEAD_STAGES.indexOf(etapa) : -1;
  return { nome: indice >= 0 ? ETAPAS_ACOMPANHAMENTO[indice].nome : "Em classificação", indice };
}

/** Item 8 (18/10): o corretor vê o cadastro recusado por 3 dias; depois ele some da lista dele. */
export const DIAS_AVISO_RECUSA = 3;

export function recusaAindaVisivel(recusadoEm: Date | string, agora: Date = new Date()): boolean {
  const quando = new Date(recusadoEm).getTime();
  return Number.isFinite(quando) && agora.getTime() - quando < DIAS_AVISO_RECUSA * 24 * 60 * 60 * 1000;
}
