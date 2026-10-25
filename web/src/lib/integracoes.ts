// LOTE B (25/10): Configurações › Integrações — um lugar só para as chaves do Asaas, da Pluggy e
// do WhatsApp (Evolution). Gêmeo de Prospecta/server/integracoes-router.ts (mesma regra; aqui as
// funções são chamadas pelas server actions de lib/actions/integracoes.ts, só para o admin).
// Cada bloco mostra o que está salvo (só os 4 últimos caracteres), testa com a mensagem real do
// serviço e troca a chave validando antes de salvar. Nenhuma função devolve segredo.
import { prisma } from "@/lib/db";
import {
  ambienteDaChaveAsaas, asaasSalvoNoBanco, chaveAsaasCentral, salvarAsaasCentral, tokenWebhookAsaasCentral,
  type ChaveAsaasCentral, type FonteSegredo,
} from "@/lib/bancos/asaas-central";
import { fetchAsaasSaldo } from "@/lib/bancos/asaas-extrato";
import { autenticarPluggyDetalhado, mensagemRecusaPluggy } from "@/lib/bancos/pluggy";
import { credenciaisPluggy, URL_WEBHOOK_ASAAS } from "@/lib/bancos";
import { criptografarSegredo } from "@/lib/segredo";
import { estadoInstancia, normalizarUrlEvolution, testarEvolution, type EvolutionConfig } from "@/lib/evolution";
import { configEvolution, salvarConfigEvolution } from "@/lib/whatsapp/evolution-config";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";

export type ServicoIntegracao = "asaas" | "pluggy" | "whatsapp";
export type EstadoWhatsapp = "conectado" | "aguardando_qr" | "desconectado" | "sem_conexao";
export type ResultadoTeste = { ok: boolean; mensagem: string; estado?: EstadoWhatsapp };

export type IntegracoesDeps = {
  lerAsaas: () => Promise<ChaveAsaasCentral | null>;
  /** Há chave salva no banco (mesmo que a variável de ambiente esteja em uso)? */
  asaasSalvoNoBanco: () => Promise<boolean>;
  lerWebhookAsaas: () => Promise<{ token: string; fonte: FonteSegredo } | null>;
  /** Grava criptografado (quem chama já validou). */
  salvarAsaas: (dados: { apiKey?: string; webhookToken?: string }) => Promise<void>;
  lerPluggy: () => Promise<{ clientId: string; clientSecret: string; fonte: FonteSegredo } | null>;
  salvarPluggy: (dados: { clientId: string; clientSecret: string }) => Promise<void>;
  lerEvolution: () => Promise<(EvolutionConfig & { fonte: FonteSegredo }) | null>;
  salvarEvolution: (dados: { url: string; apiKey: string }) => Promise<void>;
  estadoWhatsapp: (usuario: { id: string; perfil: string }, config: EvolutionConfig) => Promise<EstadoWhatsapp>;
  fetchImpl: typeof fetch;
};

/** "…1234" — nunca devolve a chave; chaves curtas demais não mostram nada. */
export function finalDaChave(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  return v.length >= 8 ? `…${v.slice(-4)}` : "…";
}

const mensagemDe = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

export const depsPadrao: IntegracoesDeps = {
  lerAsaas: chaveAsaasCentral,
  asaasSalvoNoBanco,
  lerWebhookAsaas: tokenWebhookAsaasCentral,
  salvarAsaas: salvarAsaasCentral,
  lerPluggy: credenciaisPluggy,
  salvarPluggy: async ({ clientId, clientSecret }) => {
    const dados = { clientIdEncrypted: criptografarSegredo(clientId), clientSecretEncrypted: criptografarSegredo(clientSecret), isActive: true };
    await prisma.configuracaoPluggy.upsert({ where: { id: 1 }, create: { id: 1, ...dados }, update: dados });
  },
  lerEvolution: configEvolution,
  salvarEvolution: ({ url, apiKey }) => salvarConfigEvolution(url, apiKey),
  estadoWhatsapp: async (usuario, config) => {
    const dono = await donoDaConexaoWhatsApp(usuario.id, usuario.perfil);
    const conn = dono ? await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: dono } }) : null;
    if (!conn || conn.provedor !== "evolution" || !conn.instancia) return "sem_conexao";
    const estado = await estadoInstancia(config, conn.instancia);
    return estado === "open" ? "conectado" : estado === "connecting" ? "aguardando_qr" : "desconectado";
  },
  fetchImpl: (...args) => fetch(...args),
};

const ROTULO_ESTADO: Record<EstadoWhatsapp, string> = {
  conectado: "WhatsApp conectado.",
  aguardando_qr: "WhatsApp aguardando a leitura do QR code (Central WhatsApp).",
  desconectado: "WhatsApp desconectado — gere o QR code na Central WhatsApp.",
  sem_conexao: "Nenhum WhatsApp conectado ainda — gere o QR code na Central WhatsApp.",
};

/** O que está salvo em cada serviço — sem nenhum segredo, só os 4 últimos caracteres. */
export async function statusIntegracoes(deps: IntegracoesDeps = depsPadrao) {
  const [asaas, asaasNoBanco, webhook, pluggy, evolution] = await Promise.all([
    deps.lerAsaas().catch(() => null),
    deps.asaasSalvoNoBanco().catch(() => false),
    deps.lerWebhookAsaas().catch(() => null),
    deps.lerPluggy().catch(() => null),
    deps.lerEvolution().catch(() => null),
  ]);
  return {
    asaas: {
      configurado: Boolean(asaas),
      final: finalDaChave(asaas?.apiKey),
      fonte: asaas?.fonte ?? null,
      ambiente: asaas ? ambienteDaChaveAsaas(asaas.apiKey) : null,
      /** Chave salva na tela, mas ignorada porque ASAAS_API_KEY está definida. */
      salvaNoBancoIgnorada: asaas?.fonte === "env" && asaasNoBanco,
      webhookUrl: URL_WEBHOOK_ASAAS(),
      webhookConfigurado: Boolean(webhook),
      webhookFinal: finalDaChave(webhook?.token),
      webhookFonte: webhook?.fonte ?? null,
    },
    pluggy: {
      configurado: Boolean(pluggy),
      clientIdFinal: finalDaChave(pluggy?.clientId),
      secretFinal: finalDaChave(pluggy?.clientSecret),
      fonte: pluggy?.fonte ?? null,
    },
    whatsapp: {
      configurado: Boolean(evolution),
      url: evolution?.url ?? null,
      final: finalDaChave(evolution?.apiKey),
      fonte: evolution?.fonte ?? null,
    },
  };
}
export type StatusIntegracoes = Awaited<ReturnType<typeof statusIntegracoes>>;

/** Testa o serviço com a chave em uso e devolve a mensagem real do serviço. */
export async function testarIntegracao(
  servico: ServicoIntegracao,
  usuario: { id: string; perfil: string },
  deps: IntegracoesDeps = depsPadrao,
): Promise<ResultadoTeste> {
  if (servico === "asaas") {
    let c: ChaveAsaasCentral | null;
    try { c = await deps.lerAsaas(); } catch (e) { return { ok: false, mensagem: mensagemDe(e, "Configuração do Asaas inválida.") }; }
    if (!c) return { ok: false, mensagem: "Nenhuma chave do Asaas configurada." };
    try {
      const saldo = await fetchAsaasSaldo(c.apiKey, deps.fetchImpl);
      const amb = ambienteDaChaveAsaas(c.apiKey) === "production" ? "produção" : "sandbox";
      return { ok: true, mensagem: `Asaas conectado (${amb}). Saldo: ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.` };
    } catch (e) { return { ok: false, mensagem: mensagemDe(e, "O Asaas não respondeu.") }; }
  }
  if (servico === "pluggy") {
    let c: Awaited<ReturnType<IntegracoesDeps["lerPluggy"]>>;
    try { c = await deps.lerPluggy(); } catch (e) { return { ok: false, mensagem: mensagemDe(e, "Configuração da Pluggy inválida.") }; }
    if (!c) return { ok: false, mensagem: "Client ID e Client Secret da Pluggy não configurados." };
    const r = await autenticarPluggyDetalhado(c.clientId, c.clientSecret, deps.fetchImpl);
    return r.ok ? { ok: true, mensagem: "Pluggy conectada." } : { ok: false, mensagem: mensagemRecusaPluggy(r.status, r.mensagem) };
  }
  let c: Awaited<ReturnType<IntegracoesDeps["lerEvolution"]>>;
  try { c = await deps.lerEvolution(); } catch (e) { return { ok: false, mensagem: mensagemDe(e, "Configuração da Evolution inválida.") }; }
  if (!c) return { ok: false, mensagem: "Endereço e chave do servidor da Evolution não configurados." };
  try { await testarEvolution(c, deps.fetchImpl); }
  catch (e) { return { ok: false, mensagem: mensagemDe(e, "A Evolution não respondeu.") }; }
  const estado = await deps.estadoWhatsapp(usuario, c).catch(() => null);
  return { ok: true, mensagem: `Servidor da Evolution conectado. ${estado ? ROTULO_ESTADO[estado] : "Estado do WhatsApp indisponível."}`, ...(estado ? { estado } : {}) };
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Troca a chave de API e/ou o token do webhook do Asaas. A chave é validada no Asaas antes de salvar. */
export async function salvarAsaasIntegracao(input: { apiKey?: string; webhookToken?: string }, deps: IntegracoesDeps = depsPadrao) {
  const apiKey = texto(input?.apiKey), webhookToken = texto(input?.webhookToken);
  if (!apiKey && !webhookToken) throw new Error("Cole a nova chave de API ou o novo token do webhook.");
  if (webhookToken && (webhookToken.length < 8 || webhookToken.length > 255)) throw new Error("Token do webhook do Asaas inválido (mínimo de 8 caracteres).");
  let ambiente: ReturnType<typeof ambienteDaChaveAsaas> | null = null;
  if (apiKey) {
    ambiente = ambienteDaChaveAsaas(apiKey);
    await fetchAsaasSaldo(apiKey, deps.fetchImpl);
  }
  await deps.salvarAsaas({ ...(apiKey ? { apiKey } : {}), ...(webhookToken ? { webhookToken } : {}) });
  return { success: true as const, ambiente };
}

/** Troca o Client ID/Secret da Pluggy; recusa não salva e devolve o motivo real. */
export async function salvarPluggyIntegracao(input: { clientId: string; clientSecret: string }, deps: IntegracoesDeps = depsPadrao) {
  const clientId = texto(input?.clientId), clientSecret = texto(input?.clientSecret);
  if (!clientId) throw new Error("Informe o Client ID.");
  if (!clientSecret) throw new Error("Informe o Client Secret.");
  const r = await autenticarPluggyDetalhado(clientId, clientSecret, deps.fetchImpl);
  if (!r.ok) throw new Error(mensagemRecusaPluggy(r.status, r.mensagem));
  await deps.salvarPluggy({ clientId, clientSecret });
  return { success: true as const };
}

/** Troca o servidor da Evolution: endereço normalizado (https, sem /manager) e testado antes de salvar. */
export async function salvarEvolutionIntegracao(input: { url: string; apiKey: string }, deps: IntegracoesDeps = depsPadrao) {
  const bruto = texto(input?.url), apiKey = texto(input?.apiKey);
  if (bruto.length < 4) throw new Error("Informe o endereço do servidor.");
  if (apiKey.length < 8) throw new Error("Chave de acesso muito curta.");
  const url = normalizarUrlEvolution(bruto);
  if (!/^https:\/\/[^\s/]+\S*$/i.test(url)) throw new Error("Endereço inválido (ex.: https://seu-servico.up.railway.app).");
  try { new URL(url); } catch { throw new Error("Endereço inválido (ex.: https://seu-servico.up.railway.app)."); }
  await testarEvolution({ url, apiKey }, deps.fetchImpl);
  await deps.salvarEvolution({ url, apiKey });
  return { success: true as const, url };
}
