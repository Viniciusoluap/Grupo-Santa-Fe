import "server-only";
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo } from "@/lib/segredo";
import { ErroDrive, lerCorpoErroGoogle } from "@/lib/drive-erro";
import { CHAVE_RAIZ, PROPRIEDADE_PASTA } from "@/lib/drive-estrutura";
import { CAMINHO_CALLBACK, lerCredencialOAuth, uriRetornoCadastrada } from "@/lib/google-drive-oauth";

// Google Drive com a conta Google do dono (OAuth). Mesma regra de
// `server/google-drive-oauth.ts` da Prospecta: o dono envia o JSON do cliente em
// Configurações e clica em "Conectar"; o token de atualização fica criptografado.

export const PASTA_RAIZ_OAUTH = "Grupo Santa Fé — Documentos do sistema";

type Linha = Awaited<ReturnType<typeof prisma.googleDriveOauth.findUnique>>;
let cache: { linha: Linha; ate: number } | undefined;
let tokenCache: { valor: string; expira: number } | undefined;

async function linha(): Promise<Linha> {
  if (cache && cache.ate > Date.now()) return cache.linha;
  const l = await prisma.googleDriveOauth.findUnique({ where: { id: 1 } });
  cache = { linha: l, ate: Date.now() + 30_000 };
  return l;
}
function limparCache() { cache = undefined; tokenCache = undefined; }

export async function estadoOAuth(origem: string) {
  const l = await linha();
  return {
    credencial: Boolean(l),
    conectado: Boolean(l?.refreshTokenEncrypted && l.rootFolderId),
    email: l?.accountEmail ?? null,
    conectadoEm: l?.connectedAt?.toISOString() ?? null,
    /** URI que precisa estar cadastrada no cliente "Aplicativo da Web" do Google. */
    callback: `${origem}${CAMINHO_CALLBACK}`,
  };
}

/** Grava (ou troca) o cliente OAuth. Trocar o cliente desfaz a conexão anterior. */
export async function salvarCredencialOAuth(texto: string, usuarioId: string, origem: string) {
  const c = lerCredencialOAuth(texto);
  const dados = {
    clientId: c.clientId, clientSecretEncrypted: criptografarSegredo(c.clientSecret), refreshTokenEncrypted: null,
    accountEmail: null, rootFolderId: null, connectedAt: null, updatedByUsuarioId: usuarioId,
  };
  await prisma.googleDriveOauth.upsert({ where: { id: 1 }, create: { id: 1, ...dados }, update: dados });
  limparCache();
  return { uriCadastrada: uriRetornoCadastrada(c, origem), callback: `${origem}${CAMINHO_CALLBACK}` };
}

export async function clienteOAuth() {
  const l = await linha();
  if (!l) throw new Error("Envie primeiro o JSON do cliente OAuth em Integrações → Google Drive.");
  return { clientId: l.clientId, clientSecret: descriptografarSegredo(l.clientSecretEncrypted) };
}

async function tokenEndpoint(corpo: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(corpo), cache: "no-store",
  });
  const json = await r.json().catch(() => null) as Record<string, unknown> | null;
  if (!r.ok) { const { motivo, detalhe } = lerCorpoErroGoogle(json); throw new ErroDrive("autenticacao", r.status, motivo ? `oauth_${motivo}` : "oauth", detalhe); }
  return json ?? {};
}

/**
 * Pasta raiz do sistema no Drive do dono. Reconectar reaproveita a que já
 * existe (etiqueta interna; ou, de versões antigas, pelo nome na raiz do Drive)
 * em vez de criar outra.
 */
async function pastaRaiz(auth: { Authorization: string }): Promise<string> {
  const buscar = async (q: string) => {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, fields: "files(id)", orderBy: "createdTime", pageSize: "1" })}`, { headers: auth, cache: "no-store" });
    if (!r.ok) { const { motivo, detalhe } = lerCorpoErroGoogle(await r.json().catch(() => null)); throw new ErroDrive("pasta_raiz", r.status, motivo, detalhe); }
    return ((await r.json()) as { files?: { id: string }[] }).files?.[0]?.id ?? null;
  };
  const pasta = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const existente = await buscar(`appProperties has { key='${PROPRIEDADE_PASTA}' and value='${CHAVE_RAIZ}' } and ${pasta}`)
    ?? await buscar(`name = '${PASTA_RAIZ_OAUTH.replace(/'/g, "\\'")}' and 'root' in parents and ${pasta}`);
  if (existente) return existente;
  const criada = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ name: PASTA_RAIZ_OAUTH, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!criada.ok) { const { motivo, detalhe } = lerCorpoErroGoogle(await criada.json().catch(() => null)); throw new ErroDrive("pasta_raiz", criada.status, motivo, detalhe); }
  return ((await criada.json()) as { id: string }).id;
}

/** Troca o código do Google pelo token, descobre o e-mail e prepara a pasta raiz no Drive do dono. */
export async function concluirConexao(codigo: string, origem: string, usuarioId: string) {
  const { clientId, clientSecret } = await clienteOAuth();
  const t = await tokenEndpoint({ code: codigo, client_id: clientId, client_secret: clientSecret, redirect_uri: `${origem}${CAMINHO_CALLBACK}`, grant_type: "authorization_code" });
  const acesso = typeof t.access_token === "string" ? t.access_token : "";
  const refresh = typeof t.refresh_token === "string" ? t.refresh_token : "";
  if (!acesso || !refresh) throw new Error("O Google não devolveu a autorização permanente. Tente conectar de novo.");
  const escopos = typeof t.scope === "string" ? t.scope : "";
  if (!escopos.includes("drive.file")) throw new Error("A permissão do Google Drive não foi concedida. Conecte de novo e marque a opção do Drive.");
  const auth = { Authorization: `Bearer ${acesso}` };
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: auth, cache: "no-store" }).then((r) => r.json()).catch(() => ({})) as { email?: string };
  const id = await pastaRaiz(auth);
  await prisma.googleDriveOauth.update({ where: { id: 1 }, data: {
    refreshTokenEncrypted: criptografarSegredo(refresh), accountEmail: info.email?.slice(0, 320) ?? null, rootFolderId: id,
    connectedAt: new Date(), updatedByUsuarioId: usuarioId,
  } });
  limparCache();
  return { email: info.email ?? null };
}

export async function desconectarOAuth(usuarioId: string) {
  const l = await linha();
  if (l?.refreshTokenEncrypted) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(descriptografarSegredo(l.refreshTokenEncrypted))}`, { method: "POST", cache: "no-store" }).catch(() => undefined);
  }
  await prisma.googleDriveOauth.updateMany({ where: { id: 1 }, data: { refreshTokenEncrypted: null, accountEmail: null, rootFolderId: null, connectedAt: null, updatedByUsuarioId: usuarioId } });
  limparCache();
}

/** Conexão OAuth ativa (para os documentos), ou null se não houver. Nunca lança. */
export async function conexaoOAuth(): Promise<{ rootFolder: string; email: string | null } | null> {
  try {
    const l = await linha();
    return l?.refreshTokenEncrypted && l.rootFolderId ? { rootFolder: l.rootFolderId, email: l.accountEmail } : null;
  } catch { return null; }
}

export async function tokenOAuth(forcar = false): Promise<string> {
  if (!forcar && tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.valor;
  const l = await linha();
  if (!l?.refreshTokenEncrypted) throw new Error("Google Drive não conectado");
  const { clientId, clientSecret } = await clienteOAuth();
  const t = await tokenEndpoint({ refresh_token: descriptografarSegredo(l.refreshTokenEncrypted), client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" });
  if (typeof t.access_token !== "string") throw new Error("Google OAuth não retornou token");
  tokenCache = { valor: t.access_token, expira: Date.now() + (typeof t.expires_in === "number" ? t.expires_in : 3600) * 1000 };
  return tokenCache.valor;
}

export function segredoEstado() {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET ausente");
  return `google-drive:${process.env.AUTH_SECRET}`;
}
