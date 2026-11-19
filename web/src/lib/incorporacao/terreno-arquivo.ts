// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-08 (`server/incorporacao-terreno-arquivo.ts`): arquivo do terreno
// (KML ou KMZ) enviado em partes de 1 MiB, porque a Vercel recusa corpo acima de ~4,5 MB. As partes ficam na tabela
// `documento_upload_partes` que o Santa Fé já tinha (tipo "inc-terreno", item = id do estudo). O envio direto (FormData,
// arquivo pequeno) continua aceito.
import { lerArquivoTerreno, LIMITE_ARQUIVO_TERRENO, type ArquivoTerrenoLido } from "@/lib/geo/kmz";
import { limparPartes, montarPartes } from "@/lib/documentos-upload-partes";

export const TIPO_PARTES_TERRENO = "inc-terreno";

export type EntradaArquivoTerreno =
  | { kmlContent: string }
  | { uploadId: string; fileName: string }
  | { bytes: Uint8Array; fileName: string };

type Montar = (uploadId: string, usuarioId: string, tipo: string, itemId: string) => Promise<{ nome: string; bytes: Buffer }>;
type Limpar = (uploadId: string, usuarioId: string, tipo: string, itemId: string) => Promise<unknown>;

/** Devolve o KML do envio; lança Error com mensagem clara. Não grava nada. */
export async function kmlDoEnvio(
  input: EntradaArquivoTerreno, estudoId: string, usuarioId: string,
  montar: Montar = montarPartes, limpar: Limpar = limparPartes,
): Promise<ArquivoTerrenoLido> {
  if ("kmlContent" in input) return { kml: input.kmlContent, formato: "kml", kmlInterno: null, kmlsNoKmz: 0 };
  if ("bytes" in input) {
    if (!/\.(kml|kmz)$/i.test(input.fileName)) throw new Error("Envie um arquivo .kml ou .kmz.");
    return lerArquivoTerreno(input.bytes, input.fileName);
  }
  if (!input.uploadId || !input.fileName) throw new Error("Selecione um arquivo KML ou KMZ.");
  if (!/\.(kml|kmz)$/i.test(input.fileName)) throw new Error("Envie um arquivo .kml ou .kmz.");
  try {
    const { nome, bytes } = await montar(input.uploadId, usuarioId, TIPO_PARTES_TERRENO, estudoId);
    if (nome !== input.fileName) throw new Error("Envio incompleto. Tente novamente.");
    if (bytes.length > LIMITE_ARQUIVO_TERRENO) throw new Error("Arquivo muito grande (máx. 20 MB).");
    return lerArquivoTerreno(new Uint8Array(bytes), input.fileName);
  } finally {
    await limpar(input.uploadId, usuarioId, TIPO_PARTES_TERRENO, estudoId).catch(() => undefined);
  }
}

/** Aviso para a tela quando o KMZ tinha mais de um KML. */
export function avisoDoKmz(lido: ArquivoTerrenoLido): string | null {
  if (lido.formato !== "kmz" || lido.kmlsNoKmz <= 1) return null;
  return `O KMZ tinha ${lido.kmlsNoKmz} arquivos KML; foi usado "${lido.kmlInterno}".`;
}
