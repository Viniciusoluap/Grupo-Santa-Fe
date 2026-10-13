import "server-only";
import { createHash, createSign } from "node:crypto";
import { descreverErroDrive, ErroDrive, lerCorpoErroGoogle, type EtapaDrive } from "@/lib/drive-erro";

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
  if (!response.ok) {
    const { motivo, detalhe } = lerCorpoErroGoogle(await response.json().catch(() => null));
    throw new ErroDrive("autenticacao", response.status, motivo, detalhe);
  }
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google OAuth não retornou token.");
  tokenCache = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function authorized(url: string, init: RequestInit = {}, etapa: EtapaDrive = "pasta") {
  const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await token()}` }, cache: "no-store" });
  if (!response.ok) {
    const { motivo, detalhe } = lerCorpoErroGoogle(await response.json().catch(() => null));
    throw new ErroDrive(etapa, response.status, motivo, detalhe);
  }
  return response;
}

async function assertPrivate(id: string, etapa: EtapaDrive = "permissoes") {
  const response = await authorized(`${DRIVE}/drive/v3/files/${encodeURIComponent(id)}/permissions?fields=permissions(type)&supportsAllDrives=true`, {}, etapa);
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
  await assertPrivate(root, "pasta_raiz");
  const study = await folder(root, `incorporacao-${estudoId}`);
  const item = await folder(study, `documento-${itemId}`);
  const session = await authorized(`${DRIVE}/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(bytes.length) },
    body: JSON.stringify({ name, parents: [item], description: `Grupo Santa Fé: incorporação ${estudoId}, item ${itemId}` }),
  }, "upload");
  const location = session.headers.get("location");
  if (!location || new URL(location).origin !== DRIVE) throw new Error("Sessão de upload do Drive inválida.");
  const uploaded = await authorized(location, {
    method: "PUT", headers: { "Content-Type": mime, "Content-Length": String(bytes.length) }, body: Uint8Array.from(bytes),
  }, "upload");
  const result = await uploaded.json() as { id?: string };
  if (!result.id) throw new Error("Drive não retornou ID de arquivo.");
  await assertPrivate(result.id);
  return result.id;
}

export async function lerDocumentoRegistro(fileId: string) {
  await assertPrivate(fileId);
  const result = await authorized(`${DRIVE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {}, "leitura");
  return Buffer.from(await result.arrayBuffer());
}

/**
 * Tenta gravar no Google Drive. Se o Drive não estiver configurado ou recusar
 * (sem espaço, sem permissão, API desligada…), devolve `fileId: null` e o motivo
 * legível; quem chama guarda o arquivo no banco. O envio nunca se perde.
 */
export async function tentarUploadDrive(upload: () => Promise<string>): Promise<{ fileId: string | null; nota: string | null }> {
  if (!driveRegistroConfigurado()) return { fileId: null, nota: null };
  try {
    return { fileId: await upload(), nota: null };
  } catch (error) {
    const nota = descreverErroDrive(error);
    // Só etapa/código/motivo do Google: sem token, chave ou conteúdo do arquivo.
    console.error("[drive] gravação recusada; arquivo guardado no banco:", error instanceof Error ? error.message : "erro desconhecido");
    return { fileId: null, nota };
  }
}

export interface DiagnosticoDrive {
  configurado: boolean;
  ok: boolean;
  /** Pasta raiz dentro de um Drive compartilhado (Workspace); fora dele contas de serviço não têm espaço. */
  driveCompartilhado: boolean | null;
  etapas: { etapa: string; ok: boolean }[];
  explicacao: string | null;
}

/**
 * Teste real, em etapas: autenticação, pasta raiz, permissões e gravação de um
 * arquivo de 1 KB que é apagado logo depois. Devolve o motivo exato da falha.
 */
export async function diagnosticarDrive(): Promise<DiagnosticoDrive> {
  const etapas: DiagnosticoDrive["etapas"] = [];
  if (!driveRegistroConfigurado()) return { configurado: false, ok: false, driveCompartilhado: null, etapas, explicacao: descreverErroDrive(new Error("não configurado")) };
  let driveCompartilhado: boolean | null = null;
  try {
    tokenCache = null;
    await token();
    etapas.push({ etapa: "Autenticação da conta de serviço", ok: true });
    const root = config().root;
    const meta = await authorized(`${DRIVE}/drive/v3/files/${encodeURIComponent(root)}?fields=id,driveId,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`, {}, "pasta_raiz");
    const info = await meta.json() as { driveId?: string; mimeType?: string; capabilities?: { canAddChildren?: boolean } };
    driveCompartilhado = Boolean(info.driveId);
    if (info.mimeType !== "application/vnd.google-apps.folder") throw new Error("O ID configurado não é uma pasta");
    if (info.capabilities?.canAddChildren === false) throw new ErroDrive("pasta_raiz", 403, "insufficientFilePermissions", undefined);
    etapas.push({ etapa: "Acesso à pasta raiz", ok: true });
    await assertPrivate(root, "pasta_raiz");
    etapas.push({ etapa: "Pasta privada (sem link público)", ok: true });
    const bytes = Buffer.alloc(1024, 46);
    const session = await authorized(`${DRIVE}/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true`, {
      method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "text/plain", "X-Upload-Content-Length": String(bytes.length) },
      body: JSON.stringify({ name: `teste-conexao-${Date.now()}.txt`, parents: [root] }),
    }, "upload");
    const location = session.headers.get("location");
    if (!location || new URL(location).origin !== DRIVE) throw new Error("Sessão de upload do Drive inválida.");
    const enviado = await authorized(location, { method: "PUT", headers: { "Content-Type": "text/plain", "Content-Length": String(bytes.length) }, body: Uint8Array.from(bytes) }, "upload");
    const { id } = await enviado.json() as { id?: string };
    if (id) await authorized(`${DRIVE}/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: "DELETE" }, "upload").catch(() => undefined);
    etapas.push({ etapa: "Gravação de arquivo de teste", ok: true });
    return { configurado: true, ok: true, driveCompartilhado, etapas, explicacao: null };
  } catch (error) {
    return { configurado: true, ok: false, driveCompartilhado, etapas, explicacao: descreverErroDrive(error) };
  }
}
