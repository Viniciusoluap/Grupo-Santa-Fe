// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-02 (`shared/incorporacao/logotipo.ts`): logotipo de cada empreendimento:
// tipos aceitos, limites e conferência pelo conteúdo (bytes iniciais).
// Diferença do Santa Fé: PDF é reconhecido, mas recusado no envio (o Santa Fé não tem o leitor de PDF no navegador
// para gerar a imagem de exibição) e não há geração por IA (o Santa Fé não tem gerador de imagem) — sem `promptLogotipo`.
// O navegador gera a imagem de exibição (PNG) — PDF e SVG viram PNG —; o servidor confere e guarda as duas.

export const TIPOS_LOGO = ["image/png", "image/jpeg", "image/svg+xml", "application/pdf"] as const;
export type TipoLogo = (typeof TIPOS_LOGO)[number];
export const ACCEPT_LOGO = ".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf";

/** Arquivo original (vai em partes de 1 MiB). */
export const LIMITE_LOGO_BYTES = 10 * 1024 * 1024;
/** PNG de exibição: vai junto do pedido final, bem abaixo do limite de ~4,5 MB da Vercel. */
export const LIMITE_EXIBICAO_BYTES = 1536 * 1024;
/** Maior lado da imagem de exibição, em pixels. */
export const LADO_EXIBICAO = 512;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const comeca = (b: Uint8Array, assinatura: number[]) => assinatura.every((v, i) => b[i] === v);

export const ehPng = (b: Uint8Array) => b.length > 8 && comeca(b, PNG);

/**
 * Largura e altura lidas do cabeçalho IHDR do PNG; null quando o arquivo é curto demais ou o primeiro bloco não é
 * IHDR (portão de QA de 16/11: só a assinatura de 8 bytes não basta — um "PNG" de 9 bytes quebrava o PDF da proposta).
 */
export function dimensoesDoPng(b: Uint8Array): { largura: number; altura: number } | null {
  if (b.length < 33 || !comeca(b, PNG)) return null;
  if (b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null; // "IHDR"
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const largura = v.getUint32(16), altura = v.getUint32(20);
  return largura >= 1 && altura >= 1 ? { largura, altura } : null;
}

/** Tipo real do arquivo pelos bytes iniciais; null quando não é PNG, JPG, SVG nem PDF. */
export function tipoDoLogo(b: Uint8Array): TipoLogo | null {
  if (ehPng(b)) return "image/png";
  if (b.length > 3 && comeca(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (b.length > 5 && comeca(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  // SVG: texto que começa (depois de BOM, declaração XML, comentários e DOCTYPE) por <svg
  let t = new TextDecoder("utf-8").decode(b.subarray(0, 4096)).replace(/^﻿/, "");
  for (let i = 0; i < 20; i++) {
    const antes = t;
    t = t.replace(/^\s+/, "").replace(/^<\?xml[\s\S]*?\?>/, "").replace(/^<!--[\s\S]*?-->/, "").replace(/^<!DOCTYPE[^>]*>/i, "");
    if (t === antes) break;
  }
  return /^<svg[\s>]/i.test(t) ? "image/svg+xml" : null;
}

/** Tipo esperado pela extensão do nome (o conteúdo precisa bater). */
export function tipoPelaExtensao(nome: string): TipoLogo | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "pdf") return "application/pdf";
  return null;
}

/** Tipos aceitos no envio pelo Santa Fé (PNG, JPG e SVG). */
export const TIPOS_LOGO_ENVIO: readonly TipoLogo[] = ["image/png", "image/jpeg", "image/svg+xml"];
export const ACCEPT_LOGO_ENVIO = ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml";
export const MENSAGEM_LOGO_PDF = "Logotipo em PDF ainda não é aceito aqui: exporte o logotipo em PNG, JPG ou SVG e envie de novo.";
