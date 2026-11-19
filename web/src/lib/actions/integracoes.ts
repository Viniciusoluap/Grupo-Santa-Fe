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
  finalDaChave,
} from "@/lib/integracoes";
import { removerTokenMapbox, salvarTokenMapbox, tokenMapbox } from "@/lib/geo/mapbox-config";
import { verificarTokenMapbox } from "@/lib/geo/mapbox-token";
import {
  conferirModelosDasFuncoes, mascararChaveAnthropic, modelosAnthropicPainel, removerAnthropicPainel, salvarChaveAnthropicPainel,
  salvarModeloDaFuncao, salvarModeloPreferencialAnthropic, statusAnthropicPainel, statusModelosPorFuncao, testarAnthropicPainel,
  type ContextoDasFuncoes,
} from "@/lib/ia/anthropic-painel";
import { ehFuncaoAnthropic } from "@/lib/ia/funcoes-anthropic";
import { carregarConfig as carregarConfigCentral } from "@/lib/central-vendas/base";
import { MERCADO_ENV } from "@/lib/incorporacao/mercado-config";

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

// ─── Mapbox (opcional, 11/11): token PÚBLICO para o satélite do mapa do terreno. Sem ele, Esri. ───
// Gêmeo das procedures integracoes.statusMapbox/testarMapbox/salvarMapbox/removerMapbox da Prospecta.
export async function statusMapboxAcao(): Promise<{ configurado: boolean; final: string | null; fonte: "env" | "banco" | null; erro?: string }> {
  try {
    await exigirAdminAtivo();
    const t = await tokenMapbox().catch(() => null);
    return { configurado: Boolean(t), final: finalDaChave(t?.token), fonte: t?.fonte ?? null };
  } catch (e) { return { configurado: false, final: null, fonte: null, erro: motivo(e) }; }
}

export async function testarMapboxAcao(): Promise<{ ok: boolean; mensagem: string }> {
  try {
    await exigirAdminAtivo();
    const t = await tokenMapbox().catch(() => null);
    if (!t) return { ok: true, mensagem: "Sem token do Mapbox — o mapa do terreno usa o satélite da Esri (funciona sem configurar nada)." };
    return await verificarTokenMapbox(t.token);
  } catch (e) { return { ok: false, mensagem: motivo(e) }; }
}

export async function salvarMapboxAcao(token: string): Promise<{ mensagem?: string; erro?: string }> {
  try {
    await exigirAdminAtivo();
    const r = await salvarTokenMapbox(token);
    revalidatePath(ROTA);
    return { mensagem: r.mensagem };
  } catch (e) { return { erro: motivo(e, "Não foi possível salvar.") }; }
}

export async function removerMapboxAcao(): Promise<{ erro?: string }> {
  try { await exigirAdminAtivo(); await removerTokenMapbox(); revalidatePath(ROTA); return {}; }
  catch (e) { return { erro: motivo(e) }; }
}

// ─── Anthropic (paridade 17/11, bloco 3 — gêmeo das procedures integracoes.*Anthropic da Prospecta, EPIC-024 S-10/S-11) ───
// Só cadastro da chave (criptografada), teste quando o admin pedir, lista de modelos, preferência e modelo por função.
// Nada aqui liga a IA: nenhuma função do Santa Fé lê a chave do painel (guarda em integracoes-anthropic.test.ts).
// Só o admin ativo (exigirAdminAtivo = perfil admin). A chave nunca volta para a tela; erros saem mascarados.

const motivoAnthropic = (e: unknown, padrao: string) => mascararChaveAnthropic(motivo(e, padrao));

/** O que cada função já tem fora do painel: só nomes de modelo e SE há a chave dela (nunca a chave). */
async function contextoDasFuncoesAnthropic(): Promise<ContextoDasFuncoes> {
  const central = await carregarConfigCentral().catch(() => null);
  const chaveServidor = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const iaMercadoDesligada = process.env.INCORPORACAO_IA_ATIVA === "0";
  return {
    central_vendas_agente: {
      anterior: central?.modeloIA ?? null,
      temChave: Boolean(central?.segredos.chaveAnthropic) || chaveServidor,
      semChave: "A Central de Vendas está sem chave da IA (nem a chave própria dela nem ANTHROPIC_API_KEY no servidor): o agente não roda.",
      nota: "Sem escolha aqui, vale o \"Modelo da IA\" das configurações da Central de Vendas. A chave continua a da Central (ou ANTHROPIC_API_KEY), nunca a deste painel.",
    },
    incorporacao_mercado: {
      ambiente: process.env.INCORPORACAO_IA_MODELO?.trim() || null,
      padrao: MERCADO_ENV.incorporacaoIaModelo,
      temChave: chaveServidor && !iaMercadoDesligada,
      semChave: iaMercadoDesligada
        ? "A pesquisa de anúncios com IA está desligada (INCORPORACAO_IA_ATIVA=0): não roda."
        : "Sem ANTHROPIC_API_KEY no servidor, a pesquisa de anúncios pela Anthropic não roda (os dados oficiais e os comparáveis manuais continuam).",
      nota: "Com INCORPORACAO_IA_MODELO no servidor, ela tem prioridade sobre a escolha daqui. Só vale quando o provedor em uso é a Anthropic (Tavily e Google vêm antes). A chave continua ANTHROPIC_API_KEY.",
    },
  };
}

export async function statusAnthropicAcao() {
  try { await exigirAdminAtivo(); return { status: await statusAnthropicPainel() }; }
  catch (e) { return { erro: motivoAnthropic(e, "Não foi possível ler a configuração.") }; }
}

export async function testarAnthropicAcao(): Promise<{ ok: boolean; mensagem: string }> {
  try { await exigirAdminAtivo(); return await testarAnthropicPainel(); }
  catch (e) { return { ok: false, mensagem: motivoAnthropic(e, "Não foi possível testar.") }; }
}

export async function salvarAnthropicAcao(apiKey: string) {
  try {
    await exigirAdminAtivo();
    const r = await salvarChaveAnthropicPainel(typeof apiKey === "string" ? apiKey.slice(0, 500) : "");
    revalidatePath(ROTA);
    return r;
  } catch (e) { return { erro: motivoAnthropic(e, "Chave da Anthropic não aceita.") }; }
}

export async function removerAnthropicAcao(): Promise<{ erro?: string }> {
  try { await exigirAdminAtivo(); await removerAnthropicPainel(); revalidatePath(ROTA); return {}; }
  catch (e) { return { erro: motivoAnthropic(e, "Não foi possível remover.") }; }
}

/** Lista os modelos da chave salva e confere o modelo escolhido de cada função (o que sumiu da conta é limpo, com aviso). */
export async function modelosAnthropicAcao() {
  try {
    await exigirAdminAtivo();
    const modelos = await modelosAnthropicPainel();
    await conferirModelosDasFuncoes(modelos).catch(() => undefined);
    return { modelos };
  } catch (e) { return { erro: motivoAnthropic(e, "Não foi possível listar os modelos.") }; }
}

export async function salvarModeloAnthropicAcao(modelo: string) {
  try { await exigirAdminAtivo(); return { modelo: await salvarModeloPreferencialAnthropic(typeof modelo === "string" ? modelo.slice(0, 200) : "") }; }
  catch (e) { return { erro: motivoAnthropic(e, "Não foi possível salvar o modelo.") }; }
}

export async function modelosPorFuncaoAnthropicAcao() {
  try { await exigirAdminAtivo(); return { status: await statusModelosPorFuncao(await contextoDasFuncoesAnthropic()) }; }
  catch (e) { return { erro: motivoAnthropic(e, "Não foi possível ler os modelos por função.") }; }
}

/** Valida e grava o modelo de uma função (vazio = próxima opção da ordem). Não liga nada nem consome tokens. */
export async function salvarModeloFuncaoAnthropicAcao(funcao: string, modelo: string) {
  try {
    await exigirAdminAtivo();
    if (!ehFuncaoAnthropic(funcao)) throw new Error("Função desconhecida.");
    const m = await salvarModeloDaFuncao(funcao, typeof modelo === "string" ? modelo.slice(0, 200) : "");
    return { modelo: m, status: await statusModelosPorFuncao(await contextoDasFuncoesAnthropic()) };
  } catch (e) { return { erro: motivoAnthropic(e, "Não foi possível salvar o modelo da função.") }; }
}
