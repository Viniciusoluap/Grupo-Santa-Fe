"use server";
// LOTE B (25/10): Configurações › Integrações (Asaas, Pluggy, WhatsApp/Evolution) — só o admin.
// Gêmeo do router `integracoes` da Prospecta. Em produção o Next esconde a mensagem de erros
// lançados em server actions; por isso todas devolvem { erro } com o motivo legível.
import { revalidatePath } from "next/cache";
import { exigirAdminAtivo } from "@/lib/auth/modulos";
import { chaveAsaasCentral, tokenWebhookAsaasCentral } from "@/lib/bancos/asaas-central";
import { URL_WEBHOOK_ASAAS } from "@/lib/bancos";
import { verificarWebhookAsaas, WebhookRecoveryError, type WebhookDiagnostic } from "@/lib/bancos/asaas-webhook-recovery";
import {
  salvarAsaasIntegracao, salvarEvolutionIntegracao, salvarPluggyIntegracao, statusIntegracoes, testarIntegracao,
  type ResultadoTeste, type ServicoIntegracao, type StatusIntegracoes,
} from "@/lib/integracoes";

const ROTA = "/admin/integracoes";
const SERVICOS: readonly ServicoIntegracao[] = ["asaas", "pluggy", "whatsapp"];
const motivo = (e: unknown, padrao = "Operação falhou.") => (e instanceof Error && e.message ? e.message : padrao);

export async function verificarWebhookAsaasAcao(recuperar = false): Promise<{ status?: WebhookDiagnostic; erro?: string }> {
  try {
    await exigirAdminAtivo();
    const [asaas, webhook] = await Promise.all([chaveAsaasCentral(), tokenWebhookAsaasCentral()]);
    if (!asaas || !webhook) return { erro: "Configure a chave de API e o token do webhook antes de verificar a sincronização." };
    const status = await verificarWebhookAsaas({ apiKey: asaas.apiKey, token: webhook.token,
      environment: asaas.environment, canonicalUrl: URL_WEBHOOK_ASAAS(), legacyHosts: [],
    }, recuperar);
    return { status };
  } catch (error) { return { erro: error instanceof WebhookRecoveryError ? error.message : "Não foi possível verificar ou recuperar o webhook. Confira a configuração e tente novamente." }; }
}

export async function statusIntegracoesAcao(): Promise<{ status?: StatusIntegracoes; erro?: string }> {
  try { await exigirAdminAtivo(); return { status: await statusIntegracoes() }; }
  catch (e) { return { erro: motivo(e) }; }
}

export async function testarIntegracaoAcao(servico: ServicoIntegracao): Promise<ResultadoTeste & { erro?: string }> {
  try {
    const u = await exigirAdminAtivo();
    if (!SERVICOS.includes(servico)) throw new Error("Serviço inválido.");
    return await testarIntegracao(servico, { id: u.id, perfil: u.perfil ?? "admin" });
  } catch (e) { const m = motivo(e); return { ok: false, mensagem: m, erro: m }; }
}

export async function salvarAsaasIntegracaoAcao(input: { apiKey?: string; webhookToken?: string }): Promise<{ ambiente?: string | null; erro?: string }> {
  try {
    await exigirAdminAtivo();
    const r = await salvarAsaasIntegracao(input);
    revalidatePath(ROTA);
    return { ambiente: r.ambiente };
  } catch (e) { return { erro: motivo(e, "Não foi possível salvar.") }; }
}

export async function salvarPluggyIntegracaoAcao(input: { clientId: string; clientSecret: string }): Promise<{ erro?: string }> {
  try {
    await exigirAdminAtivo();
    await salvarPluggyIntegracao(input);
    revalidatePath(ROTA);
    return {};
  } catch (e) { return { erro: motivo(e, "Não foi possível salvar.") }; }
}

export async function salvarEvolutionIntegracaoAcao(input: { url: string; apiKey: string }): Promise<{ url?: string; erro?: string }> {
  try {
    await exigirAdminAtivo();
    const r = await salvarEvolutionIntegracao(input);
    revalidatePath(ROTA);
    revalidatePath("/admin/whatsapp");
    return { url: r.url };
  } catch (e) { return { erro: motivo(e, "Não foi possível salvar.") }; }
}
