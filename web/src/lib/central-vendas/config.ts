// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/shared/central-vendas/config.ts).
// Configuração editável em tela (só admin). Guardada como JSON em central_vendas_config.dados; tudo que faltar vem dos padrões abaixo. Segredos ficam cifrados (cofre).
import { z } from "zod";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const configSchema = z.object({
  /** Interruptor geral: desligado, a Central não faz nada (o WhatsApp segue como antes). */
  ativo: z.boolean().default(false),
  automacoes: z.object({
    ia: z.boolean().default(true),
    documentos: z.boolean().default(true),
    lembretes: z.boolean().default(true),
    followup: z.boolean().default(true),
    reativacao: z.boolean().default(true),
  }).prefault({}),
  /** Modo de teste: só números da lista são atendidos e recebem mensagens. Começa ligado por segurança. */
  modoTeste: z.boolean().default(true),
  numerosTeste: z.array(z.string().trim().min(8).max(20)).max(50).default([]),
  /** Usuários (admin/colaborador ativos) que recebem atendimentos no rodízio. */
  operadores: z.array(z.string().trim().min(1).max(40)).max(100).default([]),
  /** Usuários que recebem a tarefa de análise e registram a decisão (além do admin). */
  analistas: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  horarioAtendimento: z.object({
    dias: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    inicio: hora.default("08:00"),
    fim: hora.default("18:00"),
  }).prefault({}),
  /** Janela de envio das mensagens automáticas (America/Fortaleza). */
  janelaEnvio: z.object({ inicio: hora.default("08:00"), fim: hora.default("20:00") }).prefault({}),
  slaMinutos: z.number().int().min(1).max(24 * 60).default(15),
  limiteDiarioPorNumero: z.number().int().min(1).max(500).default(20),
  intervaloMinSeg: z.number().int().min(0).max(600).default(15),
  intervaloMaxSeg: z.number().int().min(0).max(1200).default(45),
  limiteMensalTokens: z.number().int().min(0).max(1_000_000_000).default(2_000_000),
  modeloIA: z.string().trim().min(3).max(80).default("claude-sonnet-5"),
  limiarConfianca: z.number().min(0).max(1).default(0.6),
  checklistPadraoId: z.number().int().positive().nullable().default(null),
  lembretesDias: z.array(z.number().int().min(1).max(60)).max(10).default([1, 3, 7]),
  /** Número usado nos links wa.me das campanhas (sem ele, usa o da conexão). */
  numeroCampanhas: z.string().trim().max(20).default(""),
  logyca: z.object({
    ativo: z.boolean().default(false),
    usarParaEnvio: z.boolean().default(false),
    /** Endpoint copiado do menu "Mensagens API" da Logyca. */
    endpointEnvio: z.string().trim().max(500).default(""),
  }).prefault({}),
  /** Cifrados com encryptSecret; nunca voltam para a tela. */
  segredos: z.object({
    tokenSite: z.string().optional(),
    tokenLogycaEntrada: z.string().optional(),
    tokenLogycaEnvio: z.string().optional(),
    chaveAnthropic: z.string().optional(),
  }).prefault({}),
});

export type ConfigCentral = z.infer<typeof configSchema>;
export type SegredoCentral = keyof ConfigCentral["segredos"];

export function lerConfig(json: string | null | undefined): ConfigCentral {
  let bruto: unknown = {};
  try { bruto = JSON.parse(json || "{}"); } catch { bruto = {}; }
  const r = configSchema.safeParse(bruto);
  return r.success ? r.data : configSchema.parse({});
}

/** O que a tela recebe: sem segredos, só se cada um existe. */
export function configParaTela(c: ConfigCentral) {
  const { segredos, ...resto } = c;
  return {
    ...resto,
    segredosDefinidos: {
      tokenSite: Boolean(segredos.tokenSite),
      tokenLogycaEntrada: Boolean(segredos.tokenLogycaEntrada),
      tokenLogycaEnvio: Boolean(segredos.tokenLogycaEnvio),
      chaveAnthropic: Boolean(segredos.chaveAnthropic),
    },
  };
}

export const STATUS_ATENDIMENTO = ["novo", "em_atendimento_ia", "em_atendimento_humano", "aguardando_cliente", "sem_resposta", "encerrado"] as const;
export const STATUS_DOCUMENTAL = ["nao_iniciado", "aguardando_documentos", "parcial", "completo"] as const;
export const STATUS_ANALISE = ["nao_enviado", "em_analise", "pendente", "aprovado", "reprovado"] as const;
export type StatusAtendimento = (typeof STATUS_ATENDIMENTO)[number];
export type StatusDocumental = (typeof STATUS_DOCUMENTAL)[number];
export type StatusAnalise = (typeof STATUS_ANALISE)[number];
export const DECISOES_ANALISE = ["pendente", "aprovado", "reprovado"] as const;
export type DecisaoAnalise = (typeof DECISOES_ANALISE)[number];

export const ROTULOS_STATUS: Record<string, string> = {
  novo: "Novo", em_atendimento_ia: "Em atendimento IA", em_atendimento_humano: "Em atendimento humano",
  aguardando_cliente: "Aguardando cliente", sem_resposta: "Sem resposta", encerrado: "Encerrado",
  nao_iniciado: "Não iniciado", aguardando_documentos: "Aguardando documentos", parcial: "Parcial", completo: "Completo",
  nao_enviado: "Não enviado", em_analise: "Em análise", pendente: "Pendente", aprovado: "Aprovado", reprovado: "Reprovado",
};

export const TIPOS_SEQUENCIA = ["followup_aprovado", "sem_resposta", "reativacao"] as const;
export type TipoSequencia = (typeof TIPOS_SEQUENCIA)[number];
export const ROTULOS_SEQUENCIA: Record<TipoSequencia, string> = {
  followup_aprovado: "Follow-up comercial após aprovação",
  sem_resposta: "Cliente sem resposta",
  reativacao: "Reativação de contatos inativos",
};
export const passoSequenciaSchema = z.object({ aposDias: z.number().min(0.01).max(365), templateSlug: z.string().trim().min(2).max(80) });
export type PassoSequencia = z.infer<typeof passoSequenciaSchema>;

/** Tipos do checklist de documentos do CRM (documentos_cliente.tipo — DOCUMENTOS_CLIENTE). */
export const TIPOS_DOCUMENTO = ["rg", "address_proof", "income_proof_formal", "spouse_docs", "spouse_income_proof", "pis", "fgts", "birth_marriage_certificate", "other"] as const;
export const itemChecklistSchema = z.object({
  chave: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/, "Use letras minúsculas, números, _ ou -"),
  nome: z.string().trim().min(2).max(120),
  tipo: z.enum(TIPOS_DOCUMENTO).default("other"),
  obrigatorio: z.boolean().default(true),
});
export type ItemChecklist = z.infer<typeof itemChecklistSchema>;

export function lerItensChecklist(json: string | null | undefined): ItemChecklist[] {
  try {
    const r = z.array(itemChecklistSchema).safeParse(JSON.parse(json || "[]"));
    return r.success ? r.data : [];
  } catch { return []; }
}

export function lerPassos(json: string | null | undefined): PassoSequencia[] {
  try {
    const r = z.array(passoSequenciaSchema).safeParse(JSON.parse(json || "[]"));
    return r.success ? [...r.data].sort((a, b) => a.aposDias - b.aposDias) : [];
  } catch { return []; }
}
