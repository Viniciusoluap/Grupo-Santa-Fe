// Google Drive com a conta Google do dono (OAuth, escopo drive.file).
// Funções puras — mesmo arquivo em Prospecta/shared/google-drive-oauth.ts.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ESCOPOS_DRIVE = ["https://www.googleapis.com/auth/drive.file", "openid", "email"];
export const CAMINHO_CALLBACK = "/api/google-drive/callback";

export interface CredencialOAuth { clientId: string; clientSecret: string; redirectUris: string[] }

/**
 * Lê o JSON baixado em Google Auth Platform → Clientes. Aceita só o cliente
 * "Aplicativo da Web" (`{"web": {...}}`) e explica o erro dos outros arquivos.
 */
export function lerCredencialOAuth(texto: string): CredencialOAuth {
  let json: unknown;
  try { json = JSON.parse(texto); } catch { throw new Error("O arquivo não é um JSON válido. Envie o arquivo baixado do Google sem editar."); }
  const obj = (json ?? {}) as Record<string, unknown>;
  if (obj.type === "service_account")
    throw new Error("Esse é o JSON da conta de serviço. Envie o JSON do cliente OAuth (Google Auth Platform → Clientes → Aplicativo da Web).");
  if (obj.installed)
    throw new Error("Esse cliente é do tipo \"App para computador\". Crie um cliente do tipo \"Aplicativo da Web\" e envie o JSON dele.");
  const web = obj.web as Record<string, unknown> | undefined;
  const clientId = typeof web?.client_id === "string" ? web.client_id.trim() : "";
  const clientSecret = typeof web?.client_secret === "string" ? web.client_secret.trim() : "";
  if (!web || !clientId || !clientSecret)
    throw new Error("JSON sem client_id/client_secret. Baixe de novo em Google Auth Platform → Clientes → seu cliente → Baixar JSON.");
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error("client_id inválido no JSON.");
  const redirectUris = Array.isArray(web.redirect_uris) ? web.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  return { clientId, clientSecret, redirectUris };
}

/** A URI de retorno deste domínio está cadastrada no cliente do Google? (JSON sem a lista: não dá para saber.) */
export function uriRetornoCadastrada(credencial: CredencialOAuth, origem: string): boolean {
  return credencial.redirectUris.length === 0 || credencial.redirectUris.includes(`${origem}${CAMINHO_CALLBACK}`);
}

/** `state` assinado (HMAC) e com validade: amarra o retorno do Google ao usuário que iniciou a conexão. */
export function assinarEstado(segredo: string, usuarioId: string, agora = Date.now()): string {
  const corpo = Buffer.from(JSON.stringify({ u: usuarioId, e: agora + 10 * 60_000, n: randomBytes(8).toString("hex") })).toString("base64url");
  return `${corpo}.${createHmac("sha256", segredo).update(corpo).digest("base64url")}`;
}

export function verificarEstado(segredo: string, estado: string, agora = Date.now()): string | null {
  const [corpo, assinatura] = estado.split(".");
  if (!corpo || !assinatura) return null;
  const esperada = Buffer.from(createHmac("sha256", segredo).update(corpo).digest("base64url"));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(corpo, "base64url").toString()) as { u?: unknown; e?: unknown };
    return typeof u === "string" && typeof e === "number" && e > agora ? u : null;
  } catch { return null; }
}

export function urlAutorizacao(clientId: string, origem: string, estado: string): string {
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId, redirect_uri: `${origem}${CAMINHO_CALLBACK}`, response_type: "code",
    scope: ESCOPOS_DRIVE.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: estado,
  })}`;
}

/** Origem pública da requisição (atrás da Vercel): https, exceto localhost. */
export function origemDaRequisicao(host: string | undefined): string {
  const h = (host ?? "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(h)) throw new Error("Host inválido");
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h) ? `http://${h}` : `https://${h}`;
}
