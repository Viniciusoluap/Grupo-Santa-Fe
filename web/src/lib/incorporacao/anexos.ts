// Gêmeo de Prospecta/shared/incorporacao/anexos.ts (paridade: mesma regra nos dois sistemas).
// Anexos dos documentos do estudo (Due Diligence e registro da incorporação):
// qualquer tipo de arquivo — foto (inclusive HEIC do iPhone/iPad), DWG, Word,
// Excel, ZIP... O envio e a leitura vão em partes porque a Vercel limita cada
// requisição/resposta a ~4,5 MB.

/** Tamanho de cada parte enviada/lida (2 MiB → ~2,8 MB em base64). */
export const PARTE_ANEXO_BYTES = 2 * 1024 * 1024;
/** Limite de um anexo. */
export const LIMITE_ANEXO_BYTES = 50 * 1024 * 1024;
export const LIMITE_ANEXO_ROTULO = "50 MB";
export const MIME_GENERICO = "application/octet-stream";

const POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff", bmp: "image/bmp",
  dwg: "image/vnd.dwg", dxf: "application/dxf", kml: "application/vnd.google-earth.kml+xml", kmz: "application/vnd.google-earth.kmz",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  mp4: "video/mp4", mov: "video/quicktime", mp3: "audio/mpeg",
};

const MIME_VALIDO = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,62}$/;

/** Tipo a gravar: o informado pelo navegador; sem ele (iPad/Arquivos), pela extensão; senão genérico. */
export function mimeDoAnexo(nome: string, tipoInformado?: string | null): string {
  const tipo = String(tipoInformado ?? "").trim().toLowerCase().split(";")[0];
  if (tipo && tipo.length <= 120 && MIME_VALIDO.test(tipo)) return tipo;
  const ext = nome.includes(".") ? nome.split(".").pop()!.toLowerCase() : "";
  return POR_EXTENSAO[ext] ?? MIME_GENERICO;
}

export function mimeAnexoValido(mime: string) { return mime.length <= 120 && MIME_VALIDO.test(mime); }

/**
 * Só estes tipos abrem numa aba; o resto é baixado com o nome original.
 * HTML/SVG/XML nunca são abertos (executariam script na origem do sistema).
 */
const VISUALIZAVEIS = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "text/plain", "text/csv", "video/mp4", "audio/mpeg"]);
export function anexoVisualizavel(mime: string) { return VISUALIZAVEIS.has(mime.toLowerCase()); }

export function partesDoAnexo(tamanho: number) { return Math.max(1, Math.ceil(tamanho / PARTE_ANEXO_BYTES)); }

/** Nome seguro (sem barras/controles), preservando a extensão. */
export function nomeAnexoSeguro(nome: string) {
  const limpo = String(nome ?? "").replace(/[\\/\x00-\x1f\x7f]/g, "_").trim();
  return (limpo || "arquivo").slice(-255);
}
