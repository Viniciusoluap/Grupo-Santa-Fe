// Lote 2, correção 07 (AD-07): cada processo salvo em Incorporação › Projeto
// Aprovado é também um registro do módulo Projetos. Regras puras (sem banco),
// com o mesmo texto no Prospecta (shared/incorporacao/projeto-sincronizacao.ts).
//
// MAPEAMENTO (documentado e testado):
// - Chave única: (estudo, id do processo) → no máximo um projeto; salvar, editar
//   ou reabrir o estudo faz upsert, nunca duplica.
// - Dados compartilhados (sincronizados nos dois sentidos):
//     processo.orgao           ↔ projeto.aprovacaoOrgao (órgão)
//     processo.numeroProtocolo ↔ projeto.aprovacaoProtocolo
//     processo.prazoPrevisto   ↔ projeto.prazoEntrega (dia civil)
//     processo.status          ↔ projeto.aprovacaoStatus  (SITUAÇÃO DE APROVAÇÃO EXTERNA)
//     processo.observacoes     ↔ projeto.aprovacaoObservacoes
//     processo.engenheiro*     ↔ projeto.engenheiroId / engenheiro / engenheiroRegistro
// - projeto.status é o ANDAMENTO TÉCNICO INTERNO (orçamento → entregue). É editado
//   só em Projetos e nunca altera a situação externa. Únicos efeitos automáticos,
//   aplicados quando a situação externa muda pela Incorporação (onde o andamento
//   interno não aparece), e nunca sobre projeto entregue ou cancelado:
//     externa passa a "exigencia" → interno "revisao" (a exigência do órgão pede revisão técnica)
//     externa passa a "aprovado"  → interno "aprovado"
//   Demais mudanças externas não mexem no andamento interno.
// - Projeto criado pela Incorporação nasce com andamento "solicitado", nome
//   "<órgão> — <estudo>", cliente = nome do estudo (empreendimento), sem lead do
//   CRM, e tipos sugeridos pelo órgão (TIPOS_POR_ORGAO; vazio quando não há tipo
//   correspondente — o projeto fica "Aguardando dados técnicos").
// - Processo excluído na Incorporação → o projeto perde o vínculo com o processo
//   (continua apontando para o estudo, para consulta), é marcado como "cancelado"
//   e mantém checklist, documentos e revisões. Nada é apagado.
// - Projeto excluído em Projetos → o processo correspondente sai da lista do
//   Projeto Aprovado (é o mesmo registro visto pelos dois módulos; assim ele não
//   "renasce" no próximo salvamento do estudo).

import { ORGAOS_APROVACAO, type OrgaoAprovacao, type ProcessoAprovacao, type StatusAprovacao } from "./aprovacao-projeto";

export const STATUS_APROVACAO_EXTERNA: { value: StatusAprovacao; label: string }[] = [
  { value: "nao_protocolado", label: "Não protocolado" },
  { value: "protocolado", label: "Protocolado" },
  { value: "em_analise", label: "Em análise" },
  { value: "exigencia", label: "Exigência" },
  { value: "aprovado", label: "Aprovado" },
  { value: "indeferido", label: "Indeferido" },
];
const STATUS_VALIDOS = new Set<string>(STATUS_APROVACAO_EXTERNA.map((s) => s.value));
export const ehStatusAprovacao = (v: unknown): v is StatusAprovacao => typeof v === "string" && STATUS_VALIDOS.has(v);
export const ehOrgaoAprovacao = (v: unknown): v is OrgaoAprovacao =>
  typeof v === "string" && (ORGAOS_APROVACAO as readonly string[]).includes(v);
export const rotuloStatusAprovacao = (v: string | null | undefined) =>
  STATUS_APROVACAO_EXTERNA.find((s) => s.value === v)?.label ?? "—";

/** Andamento técnico interno com que nasce o projeto vindo da Incorporação. */
export const STATUS_INTERNO_INICIAL = "solicitado";
/** Andamentos internos que a situação externa nunca altera. */
export const STATUS_INTERNOS_FINAIS = ["entregue", "cancelado"] as const;
/** Andamento do projeto quando o processo é excluído na Incorporação. */
export const STATUS_INTERNO_PROCESSO_EXCLUIDO = "cancelado";

/** Tipos de projeto sugeridos pelo órgão do processo (somente na criação). */
export const TIPOS_POR_ORGAO: Record<OrgaoAprovacao, string[]> = {
  "Prefeitura (projeto arquitetônico)": ["projeto_arquitetonico"],
  "Corpo de Bombeiros": [],
  "Concessionária de Água/Esgoto": ["projeto_hidrossanitario"],
  "Concessionária de Energia": ["projeto_eletrico"],
  "Órgão Ambiental": [],
  "Cartório de Registro de Imóveis": [],
  "Outro": [],
};

export function nomeProjetoDoProcesso(orgao: string, estudoNome: string): string {
  return `${orgao} — ${estudoNome}`.slice(0, 255);
}

/**
 * Efeito da situação externa sobre o andamento técnico interno (ver mapeamento
 * no topo). Só reage a MUDANÇA da situação externa.
 */
export function statusInternoAposSituacaoExterna(
  interno: string,
  externaAnterior: string | null | undefined,
  externaNova: StatusAprovacao,
): string {
  if ((STATUS_INTERNOS_FINAIS as readonly string[]).includes(interno)) return interno;
  if (externaAnterior === externaNova) return interno;
  if (externaNova === "exigencia") return "revisao";
  if (externaNova === "aprovado") return "aprovado";
  return interno;
}

const texto = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const dia = (v: unknown): string | undefined =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;

/** Lê e normaliza a lista salva (JSON corrompido → lista vazia; ids repetidos → primeiro vence). */
export function lerProcessosAprovacao(json: string | null | undefined): ProcessoAprovacao[] {
  if (!json) return [];
  let bruto: unknown;
  try { bruto = JSON.parse(json); } catch { return []; }
  const lista = (bruto as { processos?: unknown })?.processos;
  return Array.isArray(lista) ? normalizarProcessos(lista) : [];
}

export function normalizarProcessos(lista: unknown[]): ProcessoAprovacao[] {
  const vistos = new Set<string>();
  const saida: ProcessoAprovacao[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const id = texto(p.id, 100);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    saida.push({
      id,
      orgao: ehOrgaoAprovacao(p.orgao) ? p.orgao : "Outro",
      numeroProtocolo: texto(p.numeroProtocolo, 120),
      dataProtocolo: dia(p.dataProtocolo),
      prazoPrevisto: dia(p.prazoPrevisto),
      status: ehStatusAprovacao(p.status) ? p.status : "nao_protocolado",
      observacoes: texto(p.observacoes, 2000),
      engenheiroId: texto(p.engenheiroId, 100),
      engenheiro: texto(p.engenheiro, 255),
      engenheiroRegistro: texto(p.engenheiroRegistro, 60),
    });
  }
  return saida;
}

export type ProjetoVinculado = { id: string; processoAprovacaoId: string | null };

/** Separa o que criar, atualizar e desvincular (processo excluído) — base do upsert sem duplicar. */
export function planejarSincronizacao<P extends ProjetoVinculado>(processos: ProcessoAprovacao[], vinculados: P[]) {
  const porProcesso = new Map<string, P>();
  for (const p of vinculados) if (p.processoAprovacaoId && !porProcesso.has(p.processoAprovacaoId)) porProcesso.set(p.processoAprovacaoId, p);
  const ids = new Set(processos.map((p) => p.id));
  return {
    criar: processos.filter((p) => !porProcesso.has(p.id)),
    atualizar: processos.flatMap((p) => { const projeto = porProcesso.get(p.id); return projeto ? [{ processo: p, projeto }] : []; }),
    desvincular: vinculados.filter((p) => p.processoAprovacaoId && !ids.has(p.processoAprovacaoId)),
  };
}

/** Dados compartilhados do projeto (lado Projetos) usados para atualizar o processo. */
export type DadosCompartilhadosProjeto = {
  aprovacaoOrgao: string | null;
  aprovacaoProtocolo: string | null;
  aprovacaoStatus: string | null;
  aprovacaoObservacoes: string | null;
  prazoDia: string | null;
  engenheiroId: string | null;
  engenheiro: string | null;
  engenheiroRegistro: string | null;
};

/** Edição feita em Projetos → processo do estudo (mantém id, data de protocolo e campos não compartilhados). */
export function processoComDadosDoProjeto(processo: ProcessoAprovacao, d: DadosCompartilhadosProjeto): ProcessoAprovacao {
  return {
    ...processo,
    orgao: ehOrgaoAprovacao(d.aprovacaoOrgao) ? d.aprovacaoOrgao : processo.orgao,
    numeroProtocolo: d.aprovacaoProtocolo?.trim() || undefined,
    prazoPrevisto: d.prazoDia || undefined,
    status: ehStatusAprovacao(d.aprovacaoStatus) ? d.aprovacaoStatus : processo.status,
    observacoes: d.aprovacaoObservacoes?.trim() || undefined,
    engenheiroId: d.engenheiroId ?? undefined,
    engenheiro: d.engenheiro?.trim() || undefined,
    engenheiroRegistro: d.engenheiroRegistro?.trim() || undefined,
  };
}

/** Nota acrescentada ao projeto quando o processo é excluído na Incorporação. */
export function notaProcessoExcluido(notas: string | null | undefined, quando: Date): string {
  const data = quando.toISOString().slice(0, 10).split("-").reverse().join("/");
  const linha = `Processo de aprovação excluído na Incorporação em ${data}; projeto arquivado como cancelado.`;
  return notas?.trim() ? `${notas.trim()}\n${linha}` : linha;
}
