// Paridade 17/11 (bloco 2) — Prospecta `client/src/lib/documentos-partes.ts` (`enviarPartes`): arquivo grande enviado
// em partes de 1 MiB pela rota /api/envio (a Vercel recusa corpo acima de ~4,5 MB), com a barra de progresso global.
import { enviarComProgresso } from "@/lib/envio-progresso";
import { LIMITE_DOCUMENTO_BYTES, PARTE_DOCUMENTO_BYTES } from "@/lib/documentos-upload-partes-limites";

export const LIMITE_PARTES_BYTES = LIMITE_DOCUMENTO_BYTES;

/** Envia o arquivo em partes pela ação `acao` (com os `campos` fixos) e devolve o identificador do envio. */
export async function enviarEmPartes(acao: string, arquivo: File, campos: Record<string, string>, item = "arquivo"): Promise<string> {
  if (arquivo.size > LIMITE_DOCUMENTO_BYTES) throw new Error("Arquivo muito grande (máx. 20 MB).");
  const uploadId = crypto.randomUUID();
  const total = Math.max(1, Math.ceil(arquivo.size / PARTE_DOCUMENTO_BYTES));
  for (let parte = 0; parte < total; parte++) {
    const pedaco = arquivo.slice(parte * PARTE_DOCUMENTO_BYTES, (parte + 1) * PARTE_DOCUMENTO_BYTES);
    await enviarComProgresso(acao, { ...campos, uploadId, parte: String(parte), total: String(total), nome: arquivo.name, pedaco }, { item, atual: parte + 1, total });
  }
  return uploadId;
}
