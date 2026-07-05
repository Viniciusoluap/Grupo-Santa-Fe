import { put } from "@vercel/blob";

// Wrapper resiliente para o Vercel Blob.
//
// Problema real observado em produção: se o Blob Store conectado ao projeto for
// configurado como PRIVADO, chamar put() com access:"public" lança
// "Cannot use public access on a private store" e derruba a Server Action com
// erro 500 ("This page couldn't load"). Este wrapper NUNCA lança — devolve
// { url: null, erro } para o chamador decidir se a falha é fatal ou best-effort.

export interface UploadResult {
  url: string | null;
  erro?: string;
}

export async function uploadPublico(
  pathname: string,
  body: string | Buffer | Blob | ArrayBuffer | File,
  contentType?: string
): Promise<UploadResult> {
  try {
    const blob = await put(pathname, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return { url: blob.url };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // Mensagem amigável para o caso mais comum (store privado / sem token).
    const amigavel = /private store|No token found|BLOB_READ_WRITE_TOKEN/i.test(raw)
      ? "Armazenamento de arquivos (Vercel Blob) indisponível: conecte um Blob Store PÚBLICO ao projeto na Vercel."
      : `Falha ao salvar arquivo: ${raw}`;
    return { url: null, erro: amigavel };
  }
}
