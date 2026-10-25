// LOTE B (25/10): chave central do Asaas (Configurações › Integrações). Gêmeo de
// `chaveAsaasCentral`/`ambienteDaChaveAsaas` em Prospecta/server/_core/asaas.ts e da leitura do
// token do webhook (Prospecta/server/asaas-webhook.ts). O Santa Fé não tem a tabela de cobranças
// da Prospecta: a chave e o token ficam na tabela `configuracoes`, criptografados (aceita "plain:",
// recriptografado no 1º uso). As variáveis ASAAS_API_KEY / ASAAS_WEBHOOK_TOKEN têm precedência.
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo, segredoEmTextoPuro } from "@/lib/segredo";

export const CHAVE_API_ASAAS = "asaas.apiKey";
export const CHAVE_TOKEN_ASAAS = "asaas.webhookToken";
const GRUPO = "integracoes";

export type AmbienteAsaas = "production" | "sandbox";
export type FonteSegredo = "env" | "banco";
export type ChaveAsaasCentral = { apiKey: string; environment: AmbienteAsaas; fonte: FonteSegredo };

/** O ambiente vem da própria chave: $aact_prod… = produção; o resto, sandbox. */
export function ambienteDaChaveAsaas(apiKey: string): AmbienteAsaas {
  return apiKey.trim().startsWith("$aact_prod") ? "production" : "sandbox";
}

/** Lê um segredo da tabela `configuracoes` (null se não houver) e recriptografa o "plain:". */
async function lerSegredoConfig(chave: string): Promise<string | null> {
  const l = await prisma.configuracao.findUnique({ where: { chave } });
  if (!l?.valor) return null;
  const claro = descriptografarSegredo(l.valor);
  if (segredoEmTextoPuro(l.valor)) await prisma.configuracao.update({ where: { chave }, data: { valor: criptografarSegredo(claro) } });
  return claro.trim() || null;
}

async function gravarSegredoConfig(chave: string, valor: string) {
  const cifrado = criptografarSegredo(valor.trim());
  await prisma.configuracao.upsert({ where: { chave }, create: { chave, valor: cifrado, grupo: GRUPO }, update: { valor: cifrado } });
}

/** Chave central em uso: ASAAS_API_KEY tem precedência; senão a salva em Integrações. null = nada configurado. */
export async function chaveAsaasCentral(): Promise<ChaveAsaasCentral | null> {
  const env = process.env.ASAAS_API_KEY?.trim();
  if (env) return { apiKey: env, environment: ambienteDaChaveAsaas(env), fonte: "env" };
  const salva = await lerSegredoConfig(CHAVE_API_ASAAS);
  return salva ? { apiKey: salva, environment: ambienteDaChaveAsaas(salva), fonte: "banco" } : null;
}

/** Há chave salva na tela (mesmo que a variável de ambiente esteja em uso)? */
export async function asaasSalvoNoBanco(): Promise<boolean> {
  return Boolean(await prisma.configuracao.findUnique({ where: { chave: CHAVE_API_ASAAS }, select: { id: true } }));
}

/** Token do webhook do Asaas: ASAAS_WEBHOOK_TOKEN tem precedência; senão o salvo em Integrações. */
export async function tokenWebhookAsaasCentral(): Promise<{ token: string; fonte: FonteSegredo } | null> {
  const env = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (env) return { token: env, fonte: "env" };
  const salvo = await lerSegredoConfig(CHAVE_TOKEN_ASAAS);
  return salvo ? { token: salvo, fonte: "banco" } : null;
}

/** Grava (criptografados) a chave de API e/ou o token do webhook. Quem chama valida antes. */
export async function salvarAsaasCentral(dados: { apiKey?: string; webhookToken?: string }) {
  if (dados.apiKey) await gravarSegredoConfig(CHAVE_API_ASAAS, dados.apiKey);
  if (dados.webhookToken) await gravarSegredoConfig(CHAVE_TOKEN_ASAAS, dados.webhookToken);
}

/** Valores gravados como "plain:" (carga inicial) passam a ficar criptografados. */
export async function recriptografarAsaasCentral() {
  for (const chave of [CHAVE_API_ASAAS, CHAVE_TOKEN_ASAAS]) await lerSegredoConfig(chave);
}
