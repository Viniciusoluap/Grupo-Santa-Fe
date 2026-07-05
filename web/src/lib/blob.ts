import { prisma } from "@/lib/db";

// Armazenamento de arquivos NO PRÓPRIO BANCO (tabela "arquivos").
//
// Decisão de arquitetura (regra do projeto: automação primeiro): não dependemos
// do Vercel Blob nem de nenhum store externo configurado manualmente. Os bytes
// são gravados no Postgres e servidos por uma rota autenticada (/api/arquivo/[id]).
// Isso funciona em qualquer deploy, sem nenhuma configuração na Vercel.
//
// A assinatura é mantida compatível com o wrapper anterior (uploadPublico) para
// não quebrar os chamadores existentes (juridico, incorporacao).

export interface UploadResult {
  url: string | null;
  erro?: string;
}

async function paraBuffer(
  body: string | Buffer | Blob | ArrayBuffer | File
): Promise<Buffer> {
  if (typeof body === "string") return Buffer.from(body, "utf-8");
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  // Blob | File (têm arrayBuffer())
  const ab = await (body as Blob).arrayBuffer();
  return Buffer.from(ab);
}

function nomeDoPath(pathname: string): string {
  const partes = pathname.split("/");
  return partes[partes.length - 1] || "arquivo";
}

function mimePorExtensao(nome: string, contentType?: string): string {
  if (contentType) return contentType;
  const ext = nome.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "kml": return "application/vnd.google-earth.kml+xml";
    case "csv": return "text/csv";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    default: return "application/octet-stream";
  }
}

/**
 * Salva um arquivo no banco e devolve a URL interna de download.
 * Nunca lança: em caso de falha devolve { url: null, erro }.
 */
export async function uploadPublico(
  pathname: string,
  body: string | Buffer | Blob | ArrayBuffer | File,
  contentType?: string
): Promise<UploadResult> {
  try {
    const buffer = await paraBuffer(body);
    const nome = nomeDoPath(pathname);
    const mime = mimePorExtensao(nome, contentType);
    // Prisma Bytes espera Uint8Array com ArrayBuffer próprio (não SharedArrayBuffer).
    const dados = new Uint8Array(new ArrayBuffer(buffer.byteLength));
    dados.set(buffer);
    const arquivo = await prisma.arquivo.create({
      data: { nome, mime, tamanho: buffer.length, dados },
      select: { id: true },
    });
    return { url: `/api/arquivo/${arquivo.id}` };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { url: null, erro: `Falha ao salvar arquivo: ${raw}` };
  }
}
