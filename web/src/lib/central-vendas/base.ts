import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/base.ts).
// Infraestrutura comum: configuração, auditoria, templates, avisos e as dependências externas (envio de WhatsApp,
// IA, relógio), substituíveis nos testes. Atomicidade por chaves únicas e `updateMany` condicionado ao estado.
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo } from "@/lib/segredo";
import { lerConfig, type ConfigCentral, type SegredoCentral } from "./config";
import { partesFortaleza } from "./regras";
import { templatePadrao } from "./templates";

export const db = () => prisma;

// ── Dependências externas (injetáveis) ──

export type ResultadoEnvio = { ok: boolean; externalId: string | null; conexaoId: string | null; erro?: string };
export type Enviador = (p: { numero: string; texto: string; conexaoId: string | null; config: ConfigCentral }) => Promise<ResultadoEnvio>;
export type RespostaIA = { texto: string; entrada: number; saida: number };
export type ClienteIA = (p: { sistema: string; mensagens: { role: "user" | "assistant"; content: string }[]; maxTokens: number; config: ConfigCentral }) => Promise<RespostaIA>;

type Dependencias = { enviar: Enviador | null; ia: ClienteIA | null; agora: () => Date; aleatorio: () => number; dormir: (ms: number) => Promise<void> };
const padrao: Dependencias = { enviar: null, ia: null, agora: () => new Date(), aleatorio: Math.random, dormir: ms => new Promise(r => setTimeout(r, ms)) };
let deps: Dependencias = { ...padrao };

/** Só para testes: troca envio/IA/relógio. Sem argumento, volta ao padrão. */
export function definirDependencias(d?: Partial<Dependencias>) { deps = d ? { ...deps, ...d } : { ...padrao }; }
export const dependencias = () => deps;
export const agora = () => deps.agora();
/** Data de hoje em Fortaleza (AAAA-MM-DD). */
export const partesHoje = () => partesFortaleza(agora()).data;

// ── Configuração ──

export async function carregarConfig(): Promise<ConfigCentral> {
  const r = await db().centralVendasConfig.findUnique({ where: { id: 1 }, select: { dados: true } });
  return lerConfig(r?.dados);
}

export async function salvarConfig(c: ConfigCentral, userId: string | null): Promise<void> {
  const dados = JSON.stringify(c);
  await db().centralVendasConfig.upsert({
    where: { id: 1 },
    create: { id: 1, dados, atualizadoPor: userId, atualizadoEm: agora() },
    update: { dados, atualizadoPor: userId, atualizadoEm: agora() },
  });
}

export const cifrar = (v: string) => criptografarSegredo(v);
export function segredo(c: ConfigCentral, nome: SegredoCentral): string | null {
  const v = c.segredos[nome];
  if (!v) return null;
  try { return descriptografarSegredo(v); } catch { return null; }
}

// ── Auditoria (central_vendas_eventos): payload resumido, sem dados pessoais ──

export type Evento = { tipo: string; leadId?: string | null; origem?: string; payload?: Record<string, unknown>; resultado?: "ok" | "erro" | "bloqueado" | "ignorado"; erro?: string | null; chave?: string };

/** Grava o evento. Com `chave`, grava uma única vez e devolve false se já existia. */
export async function registrarEvento(e: Evento): Promise<boolean> {
  const valores = {
    tipo: e.tipo.slice(0, 60), leadId: e.leadId ?? null, origem: (e.origem ?? "sistema").slice(0, 30),
    payload: e.payload ? JSON.stringify(e.payload).slice(0, 2000) : null, resultado: e.resultado ?? "ok",
    erro: e.erro ? e.erro.slice(0, 500) : null, chave: e.chave?.slice(0, 200) ?? null, criadoEm: agora(),
  };
  if (!e.chave) { await db().centralVendasEvento.create({ data: valores }); return true; }
  const r = await db().centralVendasEvento.createMany({ data: [valores], skipDuplicates: true });
  return r.count > 0;
}

/** Mensagem de erro sem dados pessoais (corta números longos, e-mails e tamanho). */
export function erroSeguro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "falha");
  return m.replace(/\d{6,}/g, "[número]").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]").slice(0, 300);
}

// ── Templates (whatsapp_templates, com o texto padrão como reserva) ──

export async function textoTemplate(slug: string): Promise<string | null> {
  const t = await db().whatsappTemplate.findFirst({ where: { slug, ativo: true }, select: { conteudo: true } });
  return t?.conteudo ?? templatePadrao(slug)?.conteudo ?? null;
}

// ── Pessoas e avisos ──

export async function usuariosAtivos(ids: string[]) {
  if (!ids.length) return [];
  return db().usuario.findMany({
    where: { id: { in: ids }, ativo: true, papel: { in: ["admin", "colaborador"] } },
    select: { id: true, nome: true, papel: true },
  });
}

export async function administradores() {
  return db().usuario.findMany({ where: { papel: "admin", ativo: true }, select: { id: true } });
}

export async function avisar(userIds: (string | null | undefined)[], titulo: string, mensagem: string, leadId?: string | null) {
  const ids = Array.from(new Set(userIds.filter((x): x is string => typeof x === "string" && x.length > 0)));
  if (!ids.length) return;
  await db().notificacao.createMany({
    data: ids.map(usuarioId => ({
      usuarioId, tipo: "central_vendas", titulo: titulo.slice(0, 255), mensagem: mensagem.slice(0, 2000),
      link: leadId ? `/admin/leads/${leadId}` : "/admin/central-vendas", criadoEm: agora(),
    })),
  });
}

export async function avisarAdmins(titulo: string, mensagem: string, leadId?: string | null) {
  await avisar((await administradores()).map(a => a.id), titulo, mensagem, leadId);
}

// ── Lead da Central ──

export async function registroCentral(leadId: string) {
  return db().centralVendasLead.findUnique({ where: { leadId } });
}
export type RegistroCentral = NonNullable<Awaited<ReturnType<typeof registroCentral>>>;

export async function dadosDoLead(leadId: string) {
  return db().lead.findUnique({ where: { id: leadId } });
}

export async function atualizarCentral(leadId: string, data: Parameters<typeof prisma.centralVendasLead.updateMany>[0]["data"]) {
  await db().centralVendasLead.updateMany({ where: { leadId }, data: { ...data, atualizadoEm: agora() } });
}

export const primeiroNome = (nome: string | null | undefined) => {
  const n = (nome ?? "").trim();
  if (!n || /^whatsapp\s/i.test(n)) return "";
  return n.split(/\s+/)[0];
};

/** Registro no histórico do lead (interações do CRM), como a Central faz na Prospecta (lead_activities). */
export async function registrarInteracao(leadId: string, descricao: string, tipo = "nota", criadoPor = "Central de Vendas") {
  await db().interacao.create({ data: { leadId, tipo, descricao: descricao.slice(0, 2000), criadoPor, criadoEm: agora() } });
}
