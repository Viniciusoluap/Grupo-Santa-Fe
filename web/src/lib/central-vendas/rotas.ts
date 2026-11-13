import "server-only";
// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/rotas.ts).
// Entrada de leads do site e do bloco "HTTP Request" da Logyca (rotas em app/api/central-vendas/entrada/*).
// Autenticadas por token próprio (cifrado no cofre, gerado na tela), payload validado (zod) e limitação de taxa.
// Respostas nunca ecoam dados pessoais.
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SegredoCentral } from "./config";
import { carregarConfig, erroSeguro, registrarEvento, segredo } from "./base";
import { receberContato, type OrigemContato } from "./entrada";
import { enfileirarTemplate, processarFila } from "./envio";
import { dentroDoLimite } from "./rotina";

const texto = (max: number) => z.string().trim().max(max).optional().nullable();
export const payloadEntrada = z.object({
  telefone: z.string().trim().min(8).max(30),
  nome: texto(255),
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  cidade: texto(100),
  mensagem: texto(2000),
  idExterno: texto(160),
  campanha: z.string().trim().max(80).regex(/^[a-zA-Z0-9_-]*$/).optional().nullable(),
  /** Consentimento LGPD coletado pelo formulário do site (o agente pede de novo no WhatsApp se faltar). */
  consentimentoLgpd: z.boolean().optional(),
}).strict();

function tokenConfere(recebido: string | undefined, esperado: string | null) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type PedidoEntrada = { authorization?: string | null; body: unknown; ip?: string | null };

export async function tratarEntrada(origem: Exclude<OrigemContato, "whatsapp">, req: PedidoEntrada): Promise<{ status: number; body: Record<string, unknown> }> {
  const config = await carregarConfig();
  if (!config.ativo || (origem === "logyca" && !config.logyca.ativo)) return { status: 404, body: { error: "Indisponível" } };
  const nome: SegredoCentral = origem === "site" ? "tokenSite" : "tokenLogycaEntrada";
  const bearer = /^Bearer\s+(.+)$/i.exec(String(req.authorization ?? ""))?.[1]?.trim();
  if (!(await dentroDoLimite(`entrada:${origem}:${req.ip ?? "?"}`, 30))) return { status: 429, body: { error: "Muitas requisições" } };
  if (!tokenConfere(bearer, segredo(config, nome))) {
    await registrarEvento({ tipo: "entrada_recusada", origem, resultado: "bloqueado", payload: { motivo: "token" } });
    return { status: 401, body: { error: "Não autorizado" } };
  }
  const p = payloadEntrada.safeParse(req.body ?? {});
  if (!p.success) {
    await registrarEvento({ tipo: "entrada_recusada", origem, resultado: "bloqueado", payload: { motivo: "payload", campos: p.error.issues.map(i => i.path.join(".")).slice(0, 10) } });
    return { status: 400, body: { error: "Dados inválidos", campos: p.error.issues.map(i => i.path.join(".")) } };
  }
  try {
    const d = p.data;
    const r = await receberContato({ origem, telefone: d.telefone, nome: d.nome, email: d.email || null, cidade: d.cidade, texto: d.mensagem, idExterno: d.idExterno, campanha: d.campanha });
    // Lead novo do site recebe a saudação com o pedido de consentimento (proativa: respeita 8h–20h).
    if (r.criado && r.leadId && origem === "site") {
      const job = await enfileirarTemplate({ leadId: r.leadId, slug: "cv-saudacao", chave: `saudacao:${r.leadId}`, proativa: true });
      if (job) await processarFila({ ids: [job.id] });
    }
    return { status: r.leadId ? 200 : 202, body: { ok: Boolean(r.leadId), leadId: r.leadId, novo: r.criado, motivo: r.motivo ?? null } };
  } catch (e) {
    await registrarEvento({ tipo: "erro_entrada", origem, resultado: "erro", erro: erroSeguro(e) });
    return { status: 500, body: { error: "Falha ao registrar" } };
  }
}

/** Adaptador para as rotas do Next (Request → tratarEntrada). */
export async function responderEntrada(origem: "site" | "logyca", req: Request) {
  const body = await req.json().catch(() => null);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
  const r = await tratarEntrada(origem, { authorization: req.headers.get("authorization"), body, ip });
  return Response.json(r.body, { status: r.status });
}
