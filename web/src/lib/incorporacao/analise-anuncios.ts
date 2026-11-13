// Paridade Prospecta (13/11): mesma regra de shared/incorporacao/analise-anuncios.ts.
// Tratamento de comparáveis de mercado imobiliário (correção 06 — motor 2).
//
// Função PURA, independente do provedor que trouxe os anúncios: valida, deduplica,
// rejeita anúncios incompletos, marca valores atípicos (Tukey/IQR sobre R$/m²) e
// calcula mediana, faixa e confiabilidade. Nada é inventado: sem amostras válidas,
// o resultado diz que a pesquisa é insuficiente.
//
// Preço ANUNCIADO não é preço de TRANSAÇÃO — o resultado sempre carrega esse aviso.

export type TipologiaImovel = "lote" | "casa" | "apartamento" | "terreno" | "outro";

export interface AnuncioBruto {
  titulo?: string;
  url?: string;
  fonte?: string;
  municipio?: string;
  bairro?: string;
  tipologia?: string;
  areaM2?: number | string;
  preco?: number | string;
  caracteristicas?: string;
  dataAnuncio?: string;
  /** Vários anúncios na MESMA página de listagem: identifica o trecho (a URL sozinha não basta). */
  idTrecho?: string;
}

export interface AnuncioValido {
  titulo: string;
  url: string;
  fonte: string;
  bairro: string | null;
  tipologia: TipologiaImovel;
  areaM2: number;
  preco: number;
  precoM2: number;
  caracteristicas: string | null;
  atipico: boolean;
}

export interface Rejeitado { anuncio: AnuncioBruto; motivo: string }

export interface AnaliseAnuncios {
  consultadoEm: string;
  municipio: string;
  bairro: string | null;
  tipologia: TipologiaImovel;
  provedor: string;
  validos: AnuncioValido[];
  rejeitados: Rejeitado[];
  duplicados: number;
  amostrasValidas: number; // sem atípicos
  mediana: number | null;
  q1: number | null;
  q3: number | null;
  minimo: number | null;
  maximo: number | null;
  confiabilidade: "alta" | "media" | "baixa" | "insuficiente";
  justificativaConfiabilidade: string;
  aviso: string;
}

export const AVISO_PRECO_ANUNCIADO = "Valores ANUNCIADOS (oferta), não preços efetivos de transação. Use como referência e valide antes de aplicar na precificação.";

function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const limpo = v.replace(/[R$\s]/g, "").replace(/m²|m2/gi, "");
  let norm: string;
  if (limpo.includes(",")) {
    // BR com vírgula: "1.234.567,89" → 1234567.89 ; US "1,234,567.89" → 1234567.89
    norm = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(limpo) ? limpo.replace(/,/g, "") : limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    norm = limpo.replace(/\./g, ""); // BR só com milhar: "150.000" → 150000 (não 150)
  } else {
    norm = limpo;
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

export function normalizarTipologia(t: string | undefined): TipologiaImovel {
  const s = (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\blote|loteamento/.test(s)) return "lote";
  if (/terreno|gleba|area/.test(s)) return "terreno";
  if (/apart|apto|flat/.test(s)) return "apartamento";
  if (/casa|sobrado/.test(s)) return "casa";
  return "outro";
}

/** URL canônica (sem query de rastreamento, sem barra final, minúscula no host) para deduplicar. */
export function urlCanonica(u: string): string | null {
  try {
    const url = new URL(u.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const k of Array.from(url.searchParams.keys())) if (/^(utm_|gclid|fbclid|ref|origem)/i.test(k)) url.searchParams.delete(k);
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return null;
  }
}

function quantil(ordenado: number[], q: number): number {
  const pos = (ordenado.length - 1) * q;
  const i = Math.floor(pos), f = pos - i;
  return ordenado[i] + (ordenado[Math.min(i + 1, ordenado.length - 1)] - ordenado[i]) * f;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function analisarAnuncios(
  brutos: AnuncioBruto[],
  consulta: { municipio: string; bairro?: string | null; tipologia: TipologiaImovel; areaMinM2?: number; areaMaxM2?: number; provedor: string },
  agoraIso: string
): AnaliseAnuncios {
  const rejeitados: Rejeitado[] = [];
  const vistos = new Set<string>();
  const vistosConteudo = new Set<string>();
  let duplicados = 0;
  const candidatos: Omit<AnuncioValido, "atipico">[] = [];
  for (const a of brutos) {
    const url = a.url ? urlCanonica(a.url) : null;
    const preco = numero(a.preco), area = numero(a.areaM2);
    if (!url) { rejeitados.push({ anuncio: a, motivo: "Sem link verificável do anúncio." }); continue; }
    if (!preco || preco <= 0) { rejeitados.push({ anuncio: a, motivo: "Preço ausente ou inválido." }); continue; }
    if (!area || area <= 0) { rejeitados.push({ anuncio: a, motivo: "Área ausente ou inválida." }); continue; }
    const tipologia = normalizarTipologia(a.tipologia ?? a.titulo);
    if (tipologia !== consulta.tipologia && !(consulta.tipologia === "lote" && tipologia === "terreno")) {
      rejeitados.push({ anuncio: a, motivo: `Tipologia incompatível (${tipologia}).` });
      continue;
    }
    if ((consulta.areaMinM2 && area < consulta.areaMinM2) || (consulta.areaMaxM2 && area > consulta.areaMaxM2)) {
      rejeitados.push({ anuncio: a, motivo: "Área fora da faixa de comparabilidade." });
      continue;
    }
    const chaveUrl = a.idTrecho ? `${url}#${a.idTrecho}` : url;
    if (vistos.has(chaveUrl)) { duplicados++; continue; }
    const assinatura = `${Math.round(preco)}|${Math.round(area)}|${(a.bairro ?? "").trim().toLowerCase()}`;
    if (vistosConteudo.has(assinatura)) { duplicados++; continue; } // mesmo imóvel em portais diferentes
    vistos.add(chaveUrl);
    vistosConteudo.add(assinatura);
    let fonte = a.fonte?.trim() || "";
    if (!fonte) { try { fonte = new URL(url).host; } catch { fonte = "desconhecida"; } }
    candidatos.push({
      titulo: (a.titulo ?? "").trim() || "Anúncio sem título", url, fonte, bairro: a.bairro?.trim() || null, tipologia,
      areaM2: area, preco, precoM2: r2(preco / area), caracteristicas: a.caracteristicas?.trim() || null,
    });
  }

  // valores atípicos: cercas de Tukey (1,5 × IQR) — só com amostra mínima de 4
  const precos = candidatos.map((c) => c.precoM2).sort((a, b) => a - b);
  let lo = -Infinity, hi = Infinity;
  if (precos.length >= 4) {
    const q1 = quantil(precos, 0.25), q3 = quantil(precos, 0.75), iqr = q3 - q1;
    lo = q1 - 1.5 * iqr; hi = q3 + 1.5 * iqr;
  }
  const validos: AnuncioValido[] = candidatos.map((c) => ({ ...c, atipico: c.precoM2 < lo || c.precoM2 > hi }));
  const usados = validos.filter((v) => !v.atipico).map((v) => v.precoM2).sort((a, b) => a - b);
  const n = usados.length;
  const mediana = n ? r2(quantil(usados, 0.5)) : null;
  const q1 = n ? r2(quantil(usados, 0.25)) : null;
  const q3 = n ? r2(quantil(usados, 0.75)) : null;
  const dispersao = mediana && q1 !== null && q3 !== null ? (q3 - q1) / mediana : Infinity;
  let confiabilidade: AnaliseAnuncios["confiabilidade"];
  let justificativa: string;
  if (n < 3) { confiabilidade = "insuficiente"; justificativa = `Apenas ${n} amostra(s) válida(s) — pesquisa insuficiente para indicar preço de referência.`; }
  else if (n >= 10 && dispersao <= 0.35) { confiabilidade = "alta"; justificativa = `${n} amostras válidas com dispersão interquartil de ${(dispersao * 100).toFixed(0)}% da mediana.`; }
  else if (n >= 5 && dispersao <= 0.6) { confiabilidade = "media"; justificativa = `${n} amostras válidas; dispersão interquartil de ${(dispersao * 100).toFixed(0)}% da mediana.`; }
  else { confiabilidade = "baixa"; justificativa = `${n} amostras válidas com dispersão elevada (${Number.isFinite(dispersao) ? (dispersao * 100).toFixed(0) : "—"}% da mediana) ou amostra pequena.`; }

  return {
    consultadoEm: agoraIso, municipio: consulta.municipio, bairro: consulta.bairro ?? null, tipologia: consulta.tipologia, provedor: consulta.provedor,
    validos, rejeitados, duplicados, amostrasValidas: n, mediana, q1, q3,
    minimo: n ? usados[0] : null, maximo: n ? usados[n - 1] : null,
    confiabilidade, justificativaConfiabilidade: justificativa, aviso: AVISO_PRECO_ANUNCIADO,
  };
}
