import { DOCUMENTOS_PADRAO_REGISTRO } from "./registro-incorporacao";
import { lerDueDiligence } from "./due-diligence";

// O upload atravessa uma Vercel Function: manter a requisição abaixo do limite
// de payload da plataforma (4,5 MB), inclusive metadados do Server Action.
export const LIMITE_DOCUMENTO_REGISTRO = 3 * 1024 * 1024;

export function mimeDocumentoRegistro(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export function itemRegistroValido(itemId: string, json: string | null | undefined, dueDiligenceJson?: string | null): boolean {
  if (!itemId || itemId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return false;
  if (itemId.startsWith("dd_")) {
    const [, etapaId, documentoId, extra] = itemId.split("_");
    if (extra || !etapaId || !documentoId) return false;
    try { return lerDueDiligence(dueDiligenceJson).etapas.some((e) => e.id === etapaId && e.documentos.some((d) => d.id === documentoId)); }
    catch { return false; }
  }
  if (itemId.startsWith("padrao-") && DOCUMENTOS_PADRAO_REGISTRO[Number(itemId.slice(7))] && /^padrao-(0|[1-9]\d*)$/.test(itemId)) return true;
  if (!json) return false;
  try {
    const data = JSON.parse(json) as { documentos?: { id?: unknown }[] };
    return Array.isArray(data.documentos) && data.documentos.some((d) => d.id === itemId);
  } catch { return false; }
}
