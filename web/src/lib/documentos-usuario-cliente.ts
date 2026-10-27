// Lote 2, correção 04: envio e leitura dos documentos do usuário em partes de 1 MB
// (limite de 4,5 MB da Vercel), para visualizar, baixar o original e montar o ZIP no
// navegador. Mesmo comportamento do Prospecta (client/src/lib/documentos-usuario.ts).
import {
  LIMITE_DOCUMENTO_USUARIO_BYTES, montarZipDocumentos, nomeZipDocumentos, PARTE_DOCUMENTO_USUARIO_BYTES, podeVisualizarNoNavegador,
  type CategoriaDocumentoUsuario,
} from "@/lib/engenheiro";

const base = (usuarioId: string) => `/api/usuarios/${encodeURIComponent(usuarioId)}/documentos`;

async function postar(usuarioId: string, corpo: Record<string, unknown>) {
  const r = await fetch(base(usuarioId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const b = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(b?.error || "Falha no envio.");
}

export async function enviarDocumentoUsuario(usuarioId: string, categoria: CategoriaDocumentoUsuario, file: File, substituirId?: string, progresso?: (parte: number, total: number) => void) {
  if (!file.size || file.size > LIMITE_DOCUMENTO_USUARIO_BYTES) throw new Error("Envie arquivos de até 15 MB.");
  const uploadId = crypto.randomUUID();
  const total = Math.ceil(file.size / PARTE_DOCUMENTO_USUARIO_BYTES);
  for (let parte = 0; parte < total; parte++) {
    const slice = file.slice(parte * PARTE_DOCUMENTO_USUARIO_BYTES, (parte + 1) * PARTE_DOCUMENTO_USUARIO_BYTES);
    const chunk = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.readAsDataURL(slice);
    });
    await postar(usuarioId, { acao: "parte", categoria, uploadId, parte, total, nome: file.name, chunk });
    progresso?.(parte + 1, total);
  }
  await postar(usuarioId, { acao: "finalizar", categoria, uploadId, substituirId });
}

export async function lerDocumentoUsuario(usuarioId: string, documentoId: string): Promise<Uint8Array> {
  const partes: Uint8Array[] = [];
  let offset = 0;
  let total = 0;
  do {
    const r = await fetch(`${base(usuarioId)}/${encodeURIComponent(documentoId)}?offset=${offset}`, { cache: "no-store" });
    if (!r.ok) {
      const b = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(b?.error || "Não foi possível ler o documento.");
    }
    total = Number(r.headers.get("X-Document-Size"));
    if (!Number.isSafeInteger(total) || total < 1 || total > LIMITE_DOCUMENTO_USUARIO_BYTES) throw new Error("Documento inválido.");
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!bytes.length || offset + bytes.length > total) throw new Error("Documento incompleto. Tente novamente.");
    partes.push(bytes);
    offset += bytes.length;
  } while (offset < total);
  const tudo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { tudo.set(p, pos); pos += p.length; }
  return tudo;
}

function salvar(bytes: Uint8Array, nome: string, mime: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url; link.download = nome; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function baixarDocumentoUsuario(usuarioId: string, doc: { id: string; nome: string; mime: string }) {
  salvar(await lerDocumentoUsuario(usuarioId, doc.id), doc.nome, doc.mime);
}

/** Abre PDF/imagem numa nova aba (aberta antes da leitura por causa do bloqueio de pop-up). */
export async function visualizarDocumentoUsuario(usuarioId: string, doc: { id: string; nome: string; mime: string }) {
  if (!podeVisualizarNoNavegador(doc.mime)) return baixarDocumentoUsuario(usuarioId, doc);
  const aba = window.open("", "_blank");
  try {
    const bytes = await lerDocumentoUsuario(usuarioId, doc.id);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: doc.mime }));
    if (aba) aba.location.href = url; else window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    aba?.close();
    throw e;
  }
}

export async function baixarTodosDocumentosUsuario(usuarioId: string, nomeUsuario: string | null, docs: { id: string; nome: string; categoria: string }[]) {
  const arquivos = [];
  for (const d of docs) arquivos.push({ nome: d.nome, categoria: d.categoria, bytes: await lerDocumentoUsuario(usuarioId, d.id) });
  salvar(montarZipDocumentos(arquivos), nomeZipDocumentos(nomeUsuario), "application/zip");
}
