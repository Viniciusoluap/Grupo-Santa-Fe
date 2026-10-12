import "server-only";
import { createHash, createSign } from "node:crypto";

const DRIVE = "https://www.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/drive";
let tokenCache: { token: string; until: number } | null = null;

export function driveRegistroConfigurado(): boolean {
  return Boolean(process.env.SANTA_FE_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL &&
    process.env.SANTA_FE_GOOGLE_DRIVE_PRIVATE_KEY && process.env.SANTA_FE_GOOGLE_DRIVE_ROOT_FOLDER_ID);
}

function config() {
  if (!driveRegistroConfigurado()) throw new Error("Google Drive do Grupo Santa Fé não configurado.");
  return {
    email: process.env.SANTA_FE_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL!,
    privateKey: process.env.SANTA_FE_GOOGLE_DRIVE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    root: process.env.SANTA_FE_GOOGLE_DRIVE_ROOT_FOLDER_ID!,
  };
}

async function token() {
  if (tokenCache && tokenCache.until > Date.now() + 60_000) return tokenCache.token;
  const { email, privateKey } = config();
  const now = Math.floor(Date.now() / 1000);
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iss: email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Google OAuth recusou autenticação (${response.status}).`);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google OAuth não retornou token.");
  tokenCache = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function authorized(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await token()}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Google Drive indisponível (${response.status}).`);
  return response;
}

async function assertPrivate(id: string) {
  const response = await authorized(`${DRIVE}/drive/v3/files/${encodeURIComponent(id)}/permissions?fields=permissions(type)&supportsAllDrives=true`);
  const data = await response.json() as { permissions?: { type: string }[] };
  if (data.permissions?.some((permission) => permission.type === "anyone"))
    throw new Error("Pasta ou arquivo público no Google Drive. Operação recusada.");
}

async function folder(parent: string, name: string): Promise<string> {
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = new URLSearchParams({
    q: `'${parent.replace(/'/g, "\\'")}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "nextPageToken,files(id)", pageSize: "2", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
  });
  const response = await authorized(`${DRIVE}/drive/v3/files?${q}`);
  const data = await response.json() as { files?: { id: string }[]; nextPageToken?: string };
  if ((data.files?.length ?? 0) > 1 || data.nextPageToken) throw new Error("Pasta duplicada no Drive; revisão necessária.");
  if (data.files?.[0]) { await assertPrivate(data.files[0].id); return data.files[0].id; }
  const created = await authorized(`${DRIVE}/drive/v3/files?fields=id&supportsAllDrives=true`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
  });
  const result = await created.json() as { id?: string };
  if (!result.id) throw new Error("Drive não retornou ID de pasta.");
  await assertPrivate(result.id);
  return result.id;
}

export function hashDocumento(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

export async function uploadDocumentoRegistro(estudoId: string, itemId: string, name: string, mime: string, bytes: Buffer): Promise<string> {
  const root = config().root;
  await assertPrivate(root);
  const study = await folder(root, `incorporacao-${estudoId}`);
  const item = await folder(study, `documento-${itemId}`);
  const session = await authorized(`${DRIVE}/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(bytes.length) },
    body: JSON.stringify({ name, parents: [item], description: `Grupo Santa Fé: incorporação ${estudoId}, item ${itemId}` }),
  });
  const location = session.headers.get("location");
  if (!location || new URL(location).origin !== DRIVE) throw new Error("Sessão de upload do Drive inválida.");
  const uploaded = await authorized(location, {
    method: "PUT", headers: { "Content-Type": mime, "Content-Length": String(bytes.length) }, body: Uint8Array.from(bytes),
  });
  const result = await uploaded.json() as { id?: string };
  if (!result.id) throw new Error("Drive não retornou ID de arquivo.");
  await assertPrivate(result.id);
  return result.id;
}

export async function lerDocumentoRegistro(fileId: string) {
  await assertPrivate(fileId);
  const result = await authorized(`${DRIVE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
  return Buffer.from(await result.arrayBuffer());
}
