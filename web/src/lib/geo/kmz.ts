// Paridade 17/11 (bloco 2): cópia de Prospecta server/_core/geo/kmz.ts (EPIC-024 S-08), mesma regra.
// EPIC-024 S-08 — arquivo do terreno em KML ou KMZ.
// O KMZ é um ZIP: lê o diretório central sem confiar nos tamanhos declarados, escolhe o KML interno
// (`doc.kml`, senão o primeiro `.kml`; ignora `__MACOSX` e imagens) e descompacta em fluxo, parando
// no limite — protege contra bomba de compressão. O KML segue para `parseKmlTerreno`.
import { Inflate } from "fflate";

export const LIMITE_ARQUIVO_TERRENO = 20 * 1024 * 1024;
/** KML descompactado: 20 MiB bastam para qualquer poligonal (um KML de 20 MiB tem milhões de vértices). */
export const LIMITE_KML_DESCOMPACTADO = 20 * 1024 * 1024;
export const LIMITE_ENTRADAS_KMZ = 1000;

export interface ArquivoTerrenoLido {
  kml: string;
  formato: "kml" | "kmz";
  /** Nome do KML usado dentro do KMZ (null no KML puro). */
  kmlInterno: string | null;
  /** Quantos KML havia no KMZ (só o escolhido é lido). */
  kmlsNoKmz: number;
}

const ehZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6);
const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const utf8 = new TextDecoder("utf-8");

interface Entrada { nome: string; metodo: number; flags: number; compactado: number; descompactado: number; local: number }

function entradasDoZip(b: Uint8Array): Entrada[] {
  // fim do diretório central: nos últimos 22 + 65535 bytes (comentário)
  let fim = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("KMZ inválido: o arquivo compactado está corrompido ou incompleto.");
  const total = u16(b, fim + 10), tamanho = u32(b, fim + 12), inicio = u32(b, fim + 16);
  if (total === 0xffff || inicio === 0xffffffff) throw new Error("KMZ inválido: formato ZIP64 não é aceito para o terreno.");
  if (total > LIMITE_ENTRADAS_KMZ) throw new Error(`KMZ recusado: tem ${total} arquivos internos (máx. ${LIMITE_ENTRADAS_KMZ}).`);
  if (inicio + tamanho > fim) throw new Error("KMZ inválido: o arquivo compactado está corrompido.");
  const entradas: Entrada[] = [];
  let p = inicio;
  for (let n = 0; n < total; n++) {
    if (p + 46 > fim || u32(b, p) !== 0x02014b50) throw new Error("KMZ inválido: o arquivo compactado está corrompido.");
    const tamNome = u16(b, p + 28), extra = u16(b, p + 30), coment = u16(b, p + 32);
    entradas.push({
      flags: u16(b, p + 8), metodo: u16(b, p + 10), compactado: u32(b, p + 20), descompactado: u32(b, p + 24),
      local: u32(b, p + 42), nome: utf8.decode(b.subarray(p + 46, p + 46 + tamNome)),
    });
    p += 46 + tamNome + extra + coment;
  }
  return entradas;
}

/** Só KML de verdade: sem pasta de metadados do Mac, sem `._arquivo`, sem caminho absoluto ou `..`. */
function kmlAceitavel(nome: string): boolean {
  const partes = nome.replace(/\\/g, "/").split("/");
  const base = partes[partes.length - 1];
  if (!/\.kml$/i.test(base) || base.startsWith("._")) return false;
  if (nome.startsWith("/") || /^[a-z]:/i.test(nome) || partes.includes("..")) return false;
  return !partes.some((p) => p.toLowerCase() === "__macosx");
}

function escolherKml(entradas: Entrada[]): { escolhida: Entrada; quantas: number } {
  const kmls = entradas.filter((e) => kmlAceitavel(e.nome));
  if (!kmls.length) throw new Error("KMZ sem arquivo KML dentro. Exporte de novo o terreno como KMZ ou envie o KML.");
  const base = (e: Entrada) => e.nome.replace(/\\/g, "/").split("/").pop()!.toLowerCase();
  const escolhida = kmls.find((e) => e.nome.toLowerCase() === "doc.kml") ?? kmls.find((e) => base(e) === "doc.kml") ?? kmls[0];
  return { escolhida, quantas: kmls.length };
}

function descompactar(b: Uint8Array, e: Entrada): Uint8Array {
  if (e.flags & 1) throw new Error("KMZ protegido por senha não pode ser lido.");
  if (e.descompactado > LIMITE_KML_DESCOMPACTADO) throw new Error("KMZ recusado: o KML interno passa de 20 MB descompactado.");
  if (e.local + 30 > b.length || u32(b, e.local) !== 0x04034b50) throw new Error("KMZ inválido: o arquivo compactado está corrompido.");
  const dados = e.local + 30 + u16(b, e.local + 26) + u16(b, e.local + 28);
  if (dados + e.compactado > b.length) throw new Error("KMZ inválido: o arquivo compactado está incompleto.");
  const compactado = b.subarray(dados, dados + e.compactado);
  if (e.metodo === 0) return compactado;
  if (e.metodo !== 8) throw new Error("KMZ com compressão não suportada. Exporte de novo pelo Google Earth.");
  // o tamanho declarado pode mentir: conta o que sai e para no limite
  const saida: Uint8Array[] = [];
  let bytes = 0;
  const inflate = new Inflate((parte) => {
    bytes += parte.length;
    if (bytes > LIMITE_KML_DESCOMPACTADO) throw new Error("KMZ recusado: o KML interno passa de 20 MB descompactado.");
    saida.push(parte);
  });
  const PASSO = 16 * 1024;
  try {
    for (let i = 0; i < compactado.length; i += PASSO) inflate.push(compactado.subarray(i, i + PASSO), i + PASSO >= compactado.length);
    if (!compactado.length) inflate.push(new Uint8Array(0), true);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("KMZ")) throw err;
    throw new Error("KMZ inválido: não foi possível descompactar o KML interno.");
  }
  const kml = new Uint8Array(bytes);
  let o = 0;
  for (const parte of saida) { kml.set(parte, o); o += parte.length; }
  return kml;
}

/** Lê o arquivo enviado (KML ou KMZ) e devolve o texto KML. Não grava nada: falhou, nada muda. */
export function lerArquivoTerreno(bytes: Uint8Array, nomeArquivo: string): ArquivoTerrenoLido {
  if (!bytes.length) throw new Error("O arquivo está vazio.");
  if (bytes.length > LIMITE_ARQUIVO_TERRENO) throw new Error("Arquivo muito grande (máx. 20 MB).");
  const kmzPeloNome = /\.kmz$/i.test(nomeArquivo);
  if (!ehZip(bytes)) {
    if (kmzPeloNome) throw new Error("O arquivo .kmz não é um KMZ válido (não é um arquivo compactado).");
    return { kml: utf8.decode(bytes), formato: "kml", kmlInterno: null, kmlsNoKmz: 0 };
  }
  const { escolhida, quantas } = escolherKml(entradasDoZip(bytes));
  return { kml: utf8.decode(descompactar(bytes, escolhida)), formato: "kmz", kmlInterno: escolhida.nome, kmlsNoKmz: quantas };
}
