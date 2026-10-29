import "server-only";
import { createHash, createSign } from "node:crypto";
import { descreverErroDrive, ErroDrive, lerCorpoErroGoogle, type EtapaDrive } from "@/lib/drive-erro";
import { conexaoOAuth, tokenOAuth } from "@/lib/google-drive-conexao";
import { prisma } from "@/lib/db";
import { caminhoImovel, caminhoMedicoesObra, CHAVE_RAIZ, nomeArquivo, nomeFotoImovel, pastaLegada, PASTAS_IMOVEL, PROPRIEDADE_PASTA, type AreaCliente, type PastaAlvo } from "@/lib/drive-estrutura";
import { caminhoDocumentoCliente, destinoDocumentoEstudo, numeroCurto } from "@/lib/drive-pastas";

const DRIVE = "https://www.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/drive";
let tokenCache: { token: string; until: number } | null = null;

/**
 * De onde vêm os arquivos: a conta Google do dono conectada em Configurações
 * (OAuth — preferida) ou a conta de serviço das variáveis de ambiente (legado).
 * Mesma regra de `server/drive-documents.ts` da Prospecta.
 */
export type FonteDrive = { modo: "oauth"; root: string; email: string | null } | { modo: "conta_servico"; root: string };

function contaServicoConfigurada(): boolean {
  return Boolean(process.env.SANTA_FE_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL &&
    process.env.SANTA_FE_GOOGLE_DRIVE_PRIVATE_KEY && process.env.SANTA_FE_GOOGLE_DRIVE_ROOT_FOLDER_ID);
}

async function fontes(): Promise<FonteDrive[]> {
  const lista: FonteDrive[] = [];
  const oauth = await conexaoOAuth();
  if (oauth) lista.push({ modo: "oauth", root: oauth.rootFolder, email: oauth.email });
  if (contaServicoConfigurada()) lista.push({ modo: "conta_servico", root: process.env.SANTA_FE_GOOGLE_DRIVE_ROOT_FOLDER_ID! });
  return lista;
}

export async function fonteDrive(): Promise<FonteDrive | null> {
  return (await fontes())[0] ?? null;
}

export async function driveRegistroConfigurado(): Promise<boolean> {
  return Boolean(await fonteDrive());
}

async function fonteObrigatoria(): Promise<FonteDrive> {
  const f = await fonteDrive();
  if (!f) throw new Error("Google Drive do Grupo Santa Fé não configurado.");
  return f;
}

async function token(fonte: FonteDrive) {
  if (fonte.modo === "oauth") return tokenOAuth();
  if (tokenCache && tokenCache.until > Date.now() + 60_000) return tokenCache.token;
  const email = process.env.SANTA_FE_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = process.env.SANTA_FE_GOOGLE_DRIVE_PRIVATE_KEY!.replace(/\\n/g, "\n");
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

async function authorized(fonte: FonteDrive, url: string, init: RequestInit = {}, etapa: EtapaDrive = "pasta") {
  const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await token(fonte)}` }, cache: "no-store" });
  if (!response.ok) {
    const { motivo, detalhe } = lerCorpoErroGoogle(await response.json().catch(() => null));
    throw new ErroDrive(etapa, response.status, motivo, detalhe);
  }
  return response;
}

async function assertPrivate(fonte: FonteDrive, id: string, etapa: EtapaDrive = "permissoes") {
  const response = await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(id)}/permissions?fields=permissions(type)&supportsAllDrives=true`, {}, etapa);
  const data = await response.json() as { permissions?: { type: string }[] };
  if (data.permissions?.some((permission) => permission.type === "anyone"))
    throw new Error("Pasta ou arquivo público no Google Drive. Operação recusada.");
}

const PASTA_MIME = "application/vnd.google-apps.folder";
const escapar = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

interface ArquivoDrive { id: string; name?: string; parents?: string[]; mimeType?: string; appProperties?: Record<string, string> }

/**
 * Pasta do sistema achada pela etiqueta interna (appProperties), não pelo nome:
 * se o nome exibido mudou (cliente renomeado), renomeia; se está em outro
 * lugar, move para `parent`. Só cria quando não existe nenhuma.
 */
async function pastaGerenciada(fonte: FonteDrive, parent: string, alvo: PastaAlvo): Promise<string> {
  const q = new URLSearchParams({
    q: `appProperties has { key='${PROPRIEDADE_PASTA}' and value='${escapar(alvo.chave)}' } and mimeType = '${PASTA_MIME}' and trashed = false`,
    fields: "files(id,name,parents)", orderBy: "createdTime", pageSize: "10", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
  });
  const response = await authorized(fonte, `${DRIVE}/drive/v3/files?${q}`);
  const existente = ((await response.json()) as { files?: ArquivoDrive[] }).files?.[0];
  if (existente) {
    const params = new URLSearchParams({ supportsAllDrives: "true", fields: "id" });
    const pais = existente.parents ?? [];
    if (!pais.includes(parent)) {
      params.set("addParents", parent);
      if (pais.length) params.set("removeParents", pais.join(","));
    }
    if (existente.name !== alvo.nome || !pais.includes(parent)) {
      await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(existente.id)}?${params}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: alvo.nome }),
      });
    }
    return existente.id;
  }
  const created = await authorized(fonte, `${DRIVE}/drive/v3/files?fields=id&supportsAllDrives=true`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: alvo.nome, mimeType: PASTA_MIME, parents: [parent], appProperties: { [PROPRIEDADE_PASTA]: alvo.chave } }),
  });
  const result = await created.json() as { id?: string };
  if (!result.id) throw new Error("Drive não retornou ID de pasta.");
  return result.id;
}

async function pastaDoCaminho(fonte: FonteDrive, raiz: string, caminho: PastaAlvo[]): Promise<string> {
  let atual = raiz;
  for (const alvo of caminho) atual = await pastaGerenciada(fonte, atual, alvo);
  await assertPrivate(fonte, atual);
  return atual;
}

async function enviarParaPasta(fonte: FonteDrive, pasta: string, name: string, mime: string, bytes: Buffer): Promise<string> {
  const session = await authorized(fonte, `${DRIVE}/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(bytes.length) },
    body: JSON.stringify({ name, parents: [pasta] }),
  }, "upload");
  const location = session.headers.get("location");
  if (!location || new URL(location).origin !== DRIVE) throw new Error("Sessão de upload do Drive inválida.");
  const uploaded = await authorized(fonte, location, {
    method: "PUT", headers: { "Content-Type": mime, "Content-Length": String(bytes.length) }, body: Uint8Array.from(bytes),
  }, "upload");
  const result = await uploaded.json() as { id?: string };
  if (!result.id) throw new Error("Drive não retornou ID de arquivo.");
  await assertPrivate(fonte, result.id);
  return result.id;
}

export function hashDocumento(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

/** Incorporação/<Estudo (nº)>/<Etapa>/<Documento — dd-mm-aaaa.ext> */
export async function uploadDocumentoRegistro(estudoId: string, itemId: string, name: string, mime: string, bytes: Buffer): Promise<string> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const destino = await destinoDocumentoEstudo(estudoId, itemId);
  const pasta = await pastaDoCaminho(fonte, root, destino.caminho);
  return enviarParaPasta(fonte, pasta, nomeArquivo(destino.rotulo, new Date(), name, mime), mime, bytes);
}

/** Clientes/<Nome (nº)>/<Área>/<Rótulo — dd-mm-aaaa.ext> */
export async function uploadDocumentoCliente(doc: { leadId: string; area: AreaCliente; rotulo: string; nomeOriginal: string | null; mime: string; bytes: Buffer }): Promise<string> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const pasta = await pastaDoCaminho(fonte, root, await caminhoDocumentoCliente(doc.leadId, doc.area));
  return enviarParaPasta(fonte, pasta, nomeArquivo(doc.rotulo, new Date(), doc.nomeOriginal, doc.mime), doc.mime, doc.bytes);
}

/** Obras/<Obra (nº)>/Medições CAIXA/<Rótulo — dd-mm-aaaa.ext> (PCI original e medições preenchidas). */
export async function uploadArquivoMedicaoObra(obra: { id: string; nome: string }, doc: { rotulo: string; nomeOriginal: string; mime: string; bytes: Buffer }): Promise<string> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const pasta = await pastaDoCaminho(fonte, root, caminhoMedicoesObra({ id: obra.id, numero: numeroCurto(obra.id), nome: obra.nome }));
  return enviarParaPasta(fonte, pasta, nomeArquivo(doc.rotulo, new Date(), doc.nomeOriginal, doc.mime), doc.mime, doc.bytes);
}

/**
 * Pedido de 15/10: Imóveis/<Título (nº)>/ com o checklist fixo de pastas
 * (01 - Fotos, 02 - Documentos, 03 - Plantas, 04 - Propostas). Devolve a pasta
 * de fotos já criada/renomeada. Gêmeo de pastaFotosImovel da Prospecta.
 */
async function pastaFotosImovel(fonte: FonteDrive, imovel: { id: string; titulo: string }): Promise<string> {
  const root = await prepararRaiz(fonte);
  const base = { id: imovel.id, numero: numeroCurto(imovel.id), nome: imovel.titulo };
  let fotos = "";
  for (const p of PASTAS_IMOVEL) {
    const id = await pastaDoCaminho(fonte, root, caminhoImovel(base, p.chave));
    if (p.chave === "fotos") fotos = id;
  }
  return fotos;
}

/** Grava as fotos em "01 - Fotos" como "Foto NN — dd-mm-aaaa.ext"; devolve os IDs na mesma ordem. */
export async function uploadFotosImovel(imovel: { id: string; titulo: string }, fotos: { ordem: number; mime: string; bytes: Buffer }[]): Promise<string[]> {
  const fonte = await fonteObrigatoria();
  const pasta = await pastaFotosImovel(fonte, imovel);
  const ids: string[] = [];
  for (const f of fotos) ids.push(await enviarParaPasta(fonte, pasta, nomeFotoImovel(f.ordem, new Date(), f.mime), f.mime, f.bytes));
  return ids;
}

/** Mantém a numeração das fotos igual à ordem do anúncio (e a pasta com o título atual). */
export async function organizarFotosImovel(imovel: { id: string; titulo: string }, fotos: { driveFileId: string; mime: string; criadaEm: Date }[]): Promise<void> {
  if (!fotos.length) return;
  const fonte = await fonteObrigatoria();
  const pasta = await pastaFotosImovel(fonte, imovel);
  for (let i = 0; i < fotos.length; i++) await moverArquivo(fonte, fotos[i].driveFileId, pasta, nomeFotoImovel(i + 1, fotos[i].criadaEm, fotos[i].mime));
}

/** Foto retirada do anúncio vai para a lixeira do Drive (recuperável por 30 dias). */
export async function enviarParaLixeira(fileId: string): Promise<void> {
  const fonte = await fonteObrigatoria();
  await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }),
  });
}

// ─── Pedido de 29/10: primitivas da organização completa do Drive ────────────
// Usadas por `lib/drive-organizacao.ts` (cópia de cada tipo, exclusões e o
// sincronizador). Pastas sempre achadas pela etiqueta interna, nunca pelo nome.

/** Pastas já resolvidas numa mesma execução (evita repetir buscas por etiqueta). */
export type CachePastas = Map<string, string>;

async function pastaDoCaminhoCache(fonte: FonteDrive, root: string, caminho: PastaAlvo[], cache?: CachePastas): Promise<string> {
  const k = caminho.map((p) => `${p.chave}\u0000${p.nome}`).join("\u0001");
  const salvo = cache?.get(k);
  if (salvo) return salvo;
  const id = await pastaDoCaminho(fonte, root, caminho);
  cache?.set(k, id);
  return id;
}

/** Grava um arquivo no caminho indicado (cria/renomeia as pastas) e devolve o ID no Drive. */
export async function enviarArquivoNoCaminho(caminho: PastaAlvo[], nome: string, mime: string, bytes: Buffer, cache?: CachePastas): Promise<string> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const pasta = await pastaDoCaminhoCache(fonte, root, caminho, cache);
  return enviarParaPasta(fonte, pasta, nome, mime || "application/octet-stream", bytes);
}

/** Leva o arquivo ao caminho certo com o nome certo; false quando já estava assim. */
export async function moverArquivoParaCaminho(fileId: string, caminho: PastaAlvo[], nome: string, cache?: CachePastas): Promise<boolean> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const pasta = await pastaDoCaminhoCache(fonte, root, caminho, cache);
  return moverArquivo(fonte, fileId, pasta, nome);
}

/** Arquivo (não pasta) com este nome exato no caminho, fora da lixeira. */
/**
 * Arquivo com este nome na pasta do caminho. Com `md5`, só devolve o que tem
 * o MESMO conteúdo (MD5 do Drive): uma versão antiga nunca é confundida com a atual.
 */
export async function buscarArquivoNoCaminho(caminho: PastaAlvo[], nome: string, cache?: CachePastas, md5?: string): Promise<string | null> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const pasta = await pastaDoCaminhoCache(fonte, root, caminho, cache);
  const q = new URLSearchParams({
    q: `'${escapar(pasta)}' in parents and name = '${escapar(nome)}' and mimeType != '${PASTA_MIME}' and trashed = false`,
    fields: "files(id,md5Checksum)", pageSize: "10", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
  });
  const r = await authorized(fonte, `${DRIVE}/drive/v3/files?${q}`);
  const arquivos = ((await r.json()) as { files?: (ArquivoDrive & { md5Checksum?: string })[] }).files ?? [];
  return (md5 ? arquivos.find((f) => f.md5Checksum === md5) : arquivos[0])?.id ?? null;
}

async function pastasComEtiqueta(fonte: FonteDrive, chave: string, dentroDe?: string): Promise<string[]> {
  const pai = dentroDe ? ` and '${escapar(dentroDe)}' in parents` : "";
  const q = new URLSearchParams({
    q: `appProperties has { key='${PROPRIEDADE_PASTA}' and value='${escapar(chave)}' } and mimeType = '${PASTA_MIME}' and trashed = false${pai}`,
    fields: "files(id)", orderBy: "createdTime", pageSize: "100", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
  });
  const r = await authorized(fonte, `${DRIVE}/drive/v3/files?${q}`);
  return (((await r.json()) as { files?: ArquivoDrive[] }).files ?? []).map((f) => f.id);
}

/** Pasta do sistema com esta etiqueta (ex.: "cliente:<id>"), ou null. */
export async function pastaPorChave(chave: string): Promise<string | null> {
  const fonte = await fonteDrive();
  if (!fonte) return null;
  return (await pastasComEtiqueta(fonte, chave))[0] ?? null;
}

/**
 * Manda para a lixeira do Drive (recuperável por 30 dias) toda pasta com esta
 * etiqueta. Nunca exclui de forma permanente; sem Drive configurado não faz nada.
 */
export async function enviarPastaParaLixeira(chave: string): Promise<number> {
  const fonte = await fonteDrive();
  if (!fonte) return 0;
  const ids = await pastasComEtiqueta(fonte, chave);
  for (const id of ids) {
    await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }),
    });
  }
  return ids.length;
}

/**
 * Subpastas (uma página) da pasta de topo `chavePai` que fica DENTRO da raiz
 * atual (outra raiz — ex.: ambiente de teste — nunca é varrida), com a etiqueta.
 */
export async function listarSubpastasDoSistema(chavePai: string, pageToken?: string | null): Promise<{ pastas: { id: string; chave: string | null }[]; proxima: string | null }> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const pai = (await pastasComEtiqueta(fonte, chavePai, root))[0];
  if (!pai) return { pastas: [], proxima: null };
  const q = new URLSearchParams({
    q: `'${escapar(pai)}' in parents and mimeType = '${PASTA_MIME}' and trashed = false`,
    fields: "nextPageToken,files(id,appProperties)", orderBy: "createdTime", pageSize: "200", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
  });
  if (pageToken) q.set("pageToken", pageToken);
  const r = await authorized(fonte, `${DRIVE}/drive/v3/files?${q}`);
  const corpo = (await r.json()) as { files?: ArquivoDrive[]; nextPageToken?: string };
  return {
    pastas: (corpo.files ?? []).map((f) => ({ id: f.id, chave: f.appProperties?.[PROPRIEDADE_PASTA] ?? null })),
    proxima: corpo.nextPageToken ?? null,
  };
}

/** Lê pela fonte atual; arquivo gravado antes por outra fonte (ex.: conta de serviço) é lido por ela. */
export async function lerDocumentoRegistro(fileId: string) {
  const lista = await fontes();
  if (!lista.length) throw new Error("Google Drive do Grupo Santa Fé não configurado.");
  let ultimoErro: unknown;
  for (const fonte of lista) {
    try {
      await assertPrivate(fonte, fileId);
      const result = await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {}, "leitura");
      return Buffer.from(await result.arrayBuffer());
    } catch (erro) { ultimoErro = erro; }
  }
  throw ultimoErro;
}

/**
 * Tenta gravar no Google Drive. Se o Drive não estiver configurado ou recusar
 * (sem espaço, sem permissão, API desligada…), devolve `fileId: null` e o motivo
 * legível; quem chama guarda o arquivo no banco. O envio nunca se perde.
 */
export async function tentarUploadDrive(upload: () => Promise<string>): Promise<{ fileId: string | null; nota: string | null }> {
  if (!(await driveRegistroConfigurado())) return { fileId: null, nota: null };
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
  /** "oauth" = conta Google do dono conectada em Configurações; "conta_servico" = legado. */
  modo: FonteDrive["modo"] | null;
  /** Conta Google conectada (só no modo OAuth). */
  email: string | null;
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
  const fonte = await fonteDrive();
  if (!fonte) return { configurado: false, ok: false, modo: null, email: null, driveCompartilhado: null, etapas, explicacao: descreverErroDrive(new Error("não configurado")) };
  const email = fonte.modo === "oauth" ? fonte.email : null;
  let driveCompartilhado: boolean | null = null;
  try {
    if (fonte.modo === "oauth") { await tokenOAuth(true); etapas.push({ etapa: `Autorização da conta Google${email ? ` (${email})` : ""}`, ok: true }); }
    else { tokenCache = null; await token(fonte); etapas.push({ etapa: "Autenticação da conta de serviço", ok: true }); }
    const root = fonte.root;
    const meta = await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(root)}?fields=id,driveId,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true`, {}, "pasta_raiz");
    const info = await meta.json() as { driveId?: string; mimeType?: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean } };
    if (fonte.modo === "conta_servico") driveCompartilhado = Boolean(info.driveId);
    if (info.mimeType !== "application/vnd.google-apps.folder") throw new Error("O ID configurado não é uma pasta");
    if (info.trashed) throw new ErroDrive("pasta_raiz", 404, "notFound", "pasta na lixeira");
    if (info.capabilities?.canAddChildren === false) throw new ErroDrive("pasta_raiz", 403, "insufficientFilePermissions", undefined);
    etapas.push({ etapa: "Acesso à pasta raiz", ok: true });
    await assertPrivate(fonte, root, "pasta_raiz");
    etapas.push({ etapa: "Pasta privada (sem link público)", ok: true });
    const bytes = Buffer.alloc(1024, 46);
    const session = await authorized(fonte, `${DRIVE}/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true`, {
      method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "text/plain", "X-Upload-Content-Length": String(bytes.length) },
      body: JSON.stringify({ name: `teste-conexao-${Date.now()}.txt`, parents: [root] }),
    }, "upload");
    const location = session.headers.get("location");
    if (!location || new URL(location).origin !== DRIVE) throw new Error("Sessão de upload do Drive inválida.");
    const enviado = await authorized(fonte, location, { method: "PUT", headers: { "Content-Type": "text/plain", "Content-Length": String(bytes.length) }, body: Uint8Array.from(bytes) }, "upload");
    const { id } = await enviado.json() as { id?: string };
    if (id) await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: "DELETE" }, "upload").catch(() => undefined);
    etapas.push({ etapa: "Gravação de arquivo de teste", ok: true });
    await prepararRaiz(fonte);
    let pendentes = 0;
    if (ultimaOrganizacao) {
      const o = ultimaOrganizacao;
      pendentes = o.falhas;
      ultimaOrganizacao = null;
      etapas.push({
        etapa: `Organização das pastas: ${o.arquivosMovidos} arquivo(s) movido(s), ${o.pastasRemovidas} pasta(s) antiga(s) enviada(s) para a lixeira${o.ignorados ? `, ${o.ignorados} não encontrado(s) no Drive` : ""}${o.falhas ? `, ${o.falhas} pendente(s) — será tentado de novo` : ""}`,
        ok: o.falhas === 0,
      });
    }
    if (pendentes) {
      return { configurado: true, ok: false, modo: fonte.modo, email, driveCompartilhado, etapas,
        explicacao: `O Google Drive está funcionando e os novos arquivos são gravados normalmente, mas ${pendentes} arquivo(s) antigo(s) ainda não foram reorganizados. O sistema tenta de novo no próximo envio ou no próximo teste.` };
    }
    return { configurado: true, ok: true, modo: fonte.modo, email, driveCompartilhado, etapas, explicacao: null };
  } catch (error) {
    return { configurado: true, ok: false, modo: fonte.modo, email, driveCompartilhado, etapas, explicacao: descreverErroDrive(error) };
  }
}

// ─── Organização das pastas (mesma regra da Prospecta) ───────────────────────

export interface ResultadoOrganizacao { arquivosMovidos: number; falhas: number; pastasRemovidas: number; /** Arquivo que não existe mais no Drive. */ ignorados: number }

const preparacoes = new Map<string, Promise<string>>();
let ultimaOrganizacao: ResultadoOrganizacao | null = null;

/**
 * Na primeira vez que o sistema usa uma pasta raiz (ou depois da troca para
 * esta estrutura), reorganiza o que já estava gravado e marca a raiz com a
 * etiqueta interna. Se algum arquivo não puder ser movido, não marca: a
 * próxima gravação tenta de novo.
 */
async function prepararRaiz(fonte: FonteDrive): Promise<string> {
  const root = fonte.root;
  let pronta = preparacoes.get(root);
  if (!pronta) {
    pronta = (async () => {
      await assertPrivate(fonte, root, "pasta_raiz");
      const info = await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(root)}?fields=appProperties&supportsAllDrives=true`, {}, "pasta_raiz");
      const { appProperties } = await info.json() as ArquivoDrive;
      if (appProperties?.[PROPRIEDADE_PASTA] === CHAVE_RAIZ) return root;
      const resultado = await reorganizar(fonte, root).catch((erro) => {
        console.error("[drive] organização das pastas falhou:", erro instanceof Error ? erro.message : "erro desconhecido");
        return { arquivosMovidos: 0, falhas: 1, pastasRemovidas: 0, ignorados: 0 };
      });
      if (!resultado.falhas) {
        await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(root)}?supportsAllDrives=true&fields=id`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appProperties: { [PROPRIEDADE_PASTA]: CHAVE_RAIZ } }),
        }, "pasta_raiz");
      }
      ultimaOrganizacao = resultado;
      // Com pendências a raiz fica sem etiqueta e a próxima gravação tenta de novo.
      if (resultado.falhas) preparacoes.delete(root);
      return root;
    })();
    preparacoes.set(root, pronta);
    pronta.catch(() => preparacoes.delete(root));
  }
  return pronta;
}

/** Move e renomeia um arquivo; devolve false quando já estava no lugar certo. */
async function moverArquivo(fonte: FonteDrive, fileId: string, destino: string, nome: string): Promise<boolean> {
  const r = await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,parents&supportsAllDrives=true`, {}, "leitura");
  const info = await r.json() as ArquivoDrive;
  const pais = info.parents ?? [];
  if (pais.length === 1 && pais[0] === destino && info.name === nome) return false;
  const params = new URLSearchParams({ supportsAllDrives: "true", fields: "id" });
  if (!pais.includes(destino)) params.set("addParents", destino);
  const remover = pais.filter((p) => p !== destino);
  if (remover.length) params.set("removeParents", remover.join(","));
  await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(fileId)}?${params}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nome }),
  });
  return true;
}

async function filhos(fonte: FonteDrive, pasta: string): Promise<ArquivoDrive[]> {
  const q = new URLSearchParams({
    q: `'${escapar(pasta)}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,appProperties)", pageSize: "1000", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
  });
  const r = await authorized(fonte, `${DRIVE}/drive/v3/files?${q}`);
  return ((await r.json()) as { files?: ArquivoDrive[] }).files ?? [];
}

/** Manda para a lixeira do Drive pastas antigas sem nenhum arquivo dentro (nunca apaga arquivo). */
async function removerPastaVazia(fonte: FonteDrive, pasta: string): Promise<{ vazia: boolean; removidas: number }> {
  let vazia = true;
  let removidas = 0;
  for (const item of await filhos(fonte, pasta)) {
    if (item.mimeType !== PASTA_MIME) { vazia = false; continue; }
    const sub = await removerPastaVazia(fonte, item.id);
    removidas += sub.removidas;
    if (!sub.vazia) vazia = false;
  }
  if (vazia) {
    await authorized(fonte, `${DRIVE}/drive/v3/files/${encodeURIComponent(pasta)}?supportsAllDrives=true&fields=id`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }),
    });
    removidas += 1;
  }
  return { vazia, removidas };
}

async function reorganizar(fonte: FonteDrive, root: string): Promise<ResultadoOrganizacao> {
  const resultado: ResultadoOrganizacao = { arquivosMovidos: 0, falhas: 0, pastasRemovidas: 0, ignorados: 0 };
  const documentos = await prisma.estudoDocumentoRegistro.findMany({
    where: { driveFileId: { not: null } }, select: { estudoId: true, itemId: true, driveFileId: true, nome: true, mime: true, enviadoEm: true },
  });
  for (const d of documentos) {
    try {
      const destino = await destinoDocumentoEstudo(d.estudoId, d.itemId);
      const pasta = await pastaDoCaminho(fonte, root, destino.caminho);
      if (await moverArquivo(fonte, d.driveFileId!, pasta, nomeArquivo(destino.rotulo, d.enviadoEm, d.nome, d.mime))) resultado.arquivosMovidos += 1;
    } catch (erro) {
      // Arquivo apagado no Drive ou gravado por outra conta: não há o que mover.
      if (erro instanceof ErroDrive && erro.status === 404 && erro.etapa === "leitura") { resultado.ignorados += 1; continue; }
      resultado.falhas += 1;
      console.error("[drive] arquivo não reorganizado:", erro instanceof Error ? erro.message : "erro desconhecido");
    }
  }
  // Pedido de 15/10: fotos de imóveis em Imóveis/<Título (nº)>/01 - Fotos, numeradas na ordem de envio.
  const fotos = await prisma.imovelFoto.findMany({
    where: { driveFileId: { not: null } }, orderBy: [{ imovelId: "asc" }, { criadoEm: "asc" }],
    select: { imovelId: true, driveFileId: true, mime: true, criadoEm: true, imovel: { select: { titulo: true } } },
  });
  const posicao = new Map<string, number>();
  for (const f of fotos) {
    const n = (posicao.get(f.imovelId) ?? 0) + 1;
    posicao.set(f.imovelId, n);
    try {
      const pasta = await pastaDoCaminho(fonte, root, caminhoImovel({ id: f.imovelId, numero: numeroCurto(f.imovelId), nome: f.imovel.titulo }, "fotos"));
      if (await moverArquivo(fonte, f.driveFileId!, pasta, nomeFotoImovel(n, f.criadoEm, f.mime))) resultado.arquivosMovidos += 1;
    } catch (erro) {
      if (erro instanceof ErroDrive && erro.status === 404 && erro.etapa === "leitura") { resultado.ignorados += 1; continue; }
      resultado.falhas += 1;
      console.error("[drive] foto não reorganizada:", erro instanceof Error ? erro.message : "erro desconhecido");
    }
  }
  for (const item of await filhos(fonte, root)) {
    if (item.mimeType !== PASTA_MIME || !pastaLegada(item)) continue;
    try {
      resultado.pastasRemovidas += (await removerPastaVazia(fonte, item.id)).removidas;
    } catch {
      resultado.falhas += 1;
    }
  }
  return resultado;
}

/** Portfólio por cliente/projeto/item. Sessão retomável; cada requisição leva até 1 MiB. */
export async function iniciarUploadProjetoDrive(doc: { projectId: string; clientId: string; clientName: string; projectName: string; itemId: string; itemName: string; kind: "editable" | "pdf"; name: string; canonicalName?: string; mime: string; size: number }): Promise<string> {
  const fonte = await fonteObrigatoria();
  const root = await prepararRaiz(fonte);
  const caminho: PastaAlvo[] = [
    { chave: "clientes", nome: "Clientes" },
    { chave: `cliente:${doc.clientId}`, nome: `${doc.clientName.replace(/[\\/\x00-\x1f]/g, " ").slice(0, 100)} (nº ${doc.clientId})` },
    { chave: `cliente:${doc.clientId}:projetos`, nome: "Projetos" },
    { chave: `cliente-${doc.clientId}-portfolio`, nome: "Portfólio de projetos" },
    { chave: `projeto-${doc.projectId}`, nome: `${doc.projectName.replace(/[\\/\x00-\x1f]/g, " ").slice(0, 100)} (nº ${doc.projectId})` },
    { chave: `projeto-${doc.projectId}-item-${doc.itemId}`, nome: doc.itemName.replace(/[\\/\x00-\x1f]/g, " ").slice(0, 100) },
  ];
  const pasta = await pastaDoCaminho(fonte, root, caminho);
  
  const session = await authorized(fonte, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Upload-Content-Type": doc.mime, "X-Upload-Content-Length": String(doc.size) },
    body: JSON.stringify({ name: doc.canonicalName || nomeArquivo(`${doc.itemName} — ${doc.kind === "pdf" ? "PDF" : "Editável"}`, new Date(), doc.name, doc.mime), parents: [pasta] }),
  }, "upload");
  const location = session.headers.get("location");
  if (!location || new URL(location).origin !== "https://www.googleapis.com" || !new URL(location).pathname.startsWith("/upload/drive/")) throw new Error("Sessão de upload inválida.");
  return location;
}

export async function enviarParteProjetoDrive(location: string, start: number, total: number, mime: string, bytes: Buffer): Promise<{ offset: number; driveFileId?: string }> {
  const url = new URL(location);
  if (url.origin !== "https://www.googleapis.com" || !url.pathname.startsWith("/upload/drive/")) throw new Error("Sessão de upload inválida.");
  const fonte = await fonteObrigatoria();
  const response = await fetch(location, {
    method: "PUT", headers: { Authorization: `Bearer ${await token(fonte)}`, "Content-Type": mime, "Content-Length": String(bytes.length),
      "Content-Range": bytes.length ? `bytes ${start}-${start + bytes.length - 1}/${total}` : `bytes */${total}` },
    body: Uint8Array.from(bytes),
  });
  if (response.status === 308) {
    const range = /bytes=0-(\d+)/.exec(response.headers.get("range") || "");
    return { offset: range ? Number(range[1]) + 1 : 0 };
  }
  if (!response.ok) throw new Error(response.status === 404 ? "Envio expirado. Selecione o arquivo novamente." : "Falha no Google Drive. Tente continuar o envio.");
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("Drive não confirmou o arquivo.");
  await assertPrivate(fonte, result.id);
  return { offset: total, driveFileId: result.id };
}
