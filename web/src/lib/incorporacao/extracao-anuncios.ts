// Paridade Prospecta (13/11): mesma regra de shared/incorporacao/extracao-anuncios.ts.
// Extração DETERMINÍSTICA de anúncios a partir do texto devolvido por um buscador (Tavily),
// sem IA e sem estimativa (correção 06 — provedor gratuito).
//
// Os resultados costumam ser páginas de LISTAGEM dos portais, com vários anúncios no mesmo
// trecho ("Terreno no bairro X - Imperatriz/MA. 522m². R$ 450.000 ; Terreno em Goiânia. 200m² ·
// R$ 80.000"). Por isso o texto é dividido em trechos (";" e "·") e um trecho só vira anúncio
// quando tem EXATAMENTE um preço de venda e UMA área — nunca se "escolhe" um número.
// São descartados: aluguel, parcelas/entrada, médias de mercado, preço por m², valores
// implausíveis e trechos que mencionam outra cidade. Tudo o que é aceito vem do texto real.

import type { AnuncioBruto, TipologiaImovel } from "./analise-anuncios";

export interface ResultadoBusca {
  url: string;
  title?: string;
  content?: string;
}

export interface Descarte { trecho: string; motivo: string; url: string }

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "1.234.567,89" / "150.000" / "1,5" → número (padrão brasileiro). */
function numeroBR(txt: string): number | null {
  const t = txt.trim();
  let norm: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) norm = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d+)?$/.test(t)) norm = t.replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(t)) norm = t; // ponto decimal (250.50)
  else return null;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

const RE_PRECO = /R\$\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*(milh(?:ão|ao|ões|oes)|mil)(?![a-zà-ú]))?/gi;
// (?<![\d.,]) impede casar só o fim de um número ("250.50" nunca vira "50"); ponto com 1–2 casas = decimal
const RE_AREA = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+\.\d{1,2}(?!\d)|\d+(?:,\d+)?)\s?(m²|m2|metros quadrados)(?![a-z])/gi;
const RE_HECTARE = /(?<![\d.,])(\d+(?:,\d+)?)\s?(ha|hectares?)(?![a-z])/gi;
// palavras que tornam o trecho inadequado como anúncio de VENDA com preço total
const RE_DESCARTE = /(\/\s*m[êe]s|\bmensa|\balug|\bloca[çc][ãa]o|\bloca-se|\blocar\b|parcela|entrada|a partir de|valor m[ée]dio|\bm[ée]dia\b|\bm[ée]dio\b|condom[íi]nio r\$|iptu|\/\s*m²|\/\s*m2|por m²|por m2|valor do m|m² r\$|leil[ãa]o|lance)/i;

function precosDe(trecho: string): number[] {
  const out: number[] = [];
  for (const m of Array.from(trecho.matchAll(RE_PRECO))) {
    const base = numeroBR(m[1]);
    if (base === null) continue;
    const mult = m[2] ? (/^mil$/i.test(m[2]) ? 1e3 : 1e6) : 1;
    out.push(Math.round(base * mult * 100) / 100);
  }
  return out;
}

function areasDe(trecho: string): number[] {
  const out: number[] = [];
  for (const m of Array.from(trecho.matchAll(RE_AREA))) { const n = numeroBR(m[1]); if (n !== null) out.push(n); }
  for (const m of Array.from(trecho.matchAll(RE_HECTARE))) { const n = numeroBR(m[1]); if (n !== null) out.push(n * 10_000); }
  return out;
}

const distintos = (xs: number[]) => Array.from(new Set(xs.map((x) => Math.round(x * 100) / 100)));

function tipologiaDoTrecho(trecho: string, padrao: TipologiaImovel): TipologiaImovel {
  const s = semAcento(trecho);
  if (/\bapart|\bapto\b|\bflat\b/.test(s)) return "apartamento";
  if (/\bcasa\b|\bsobrado\b/.test(s)) return "casa";
  if (/\blote|\bloteamento/.test(s)) return "lote";
  if (/\bterreno|\bgleba|\bchacara|\bsitio\b|\barea\b/.test(s)) return padrao === "lote" ? "lote" : "terreno";
  return padrao;
}

const UFS = new Set(["ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to"]);

/** Menção a OUTRA cidade no trecho ("em Trindade de Goiania", "Goiânia/GO", "Timon - MA")? */
function mencionaOutraCidade(trecho: string, municipio: string, uf: string): boolean {
  const alvo = semAcento(municipio);
  const s = semAcento(trecho);
  if (s.includes(alvo)) {
    // homônimo: "Bom Jesus/RS" ou "Bom Jesus - RS" numa pesquisa de Bom Jesus/PI → outra cidade
    const esc = alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of Array.from(s.matchAll(new RegExp(`${esc}\\s?(?:\\/|-|–|,)\\s?([a-z]{2})\\b`, "g")))) {
      if (UFS.has(m[1]) && m[1] !== semAcento(uf)) return true;
    }
    return false;
  }
  // "Cidade/UF" ou "Cidade - UF" com cidade diferente
  if (/[a-z]{3,}\s?(\/|-)\s?[a-z]{2}\b/.test(s) && /\b(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)\b/.test(s)) return true;
  // "... em Nome Próprio" (lugar) sem o município-alvo
  return /\bem\s+[A-ZÀ-Ú][a-zà-ú]{2,}/.test(trecho);
}

function bairroDo(trecho: string, municipio: string): string | undefined {
  const m1 = trecho.match(/bairro\s+([A-ZÀ-Ú][\wÀ-ú.' ]{2,40}?)\s*(?:[-,–]|$)/);
  if (m1) return m1[1].trim();
  const esc = municipio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // só palavras com inicial maiúscula (e conectivos de/da/do/dos/das) imediatamente antes de ", Município"
  const m2 = trecho.match(new RegExp(`((?:[A-ZÀ-Ú][\\wÀ-ú.']*)(?:\\s+(?:de|da|do|dos|das|[A-ZÀ-Ú][\\wÀ-ú.']*))*),\\s*${esc}`));
  return m2 ? m2[1].trim() : undefined;
}

/** Extrai anúncios de UM resultado de busca. Determinístico; tudo o que entra vem do texto. */
export function extrairAnunciosDeResultado(
  r: ResultadoBusca, consulta: { municipio: string; uf: string; tipologia: TipologiaImovel }
): { anuncios: AnuncioBruto[]; descartes: Descarte[] } {
  const anuncios: AnuncioBruto[] = [];
  const descartes: Descarte[] = [];
  const texto = (r.content ?? "").replace(/\s+/g, " ").trim();
  if (!texto) return { anuncios, descartes };
  const paginaDoMunicipio = semAcento(`${r.title ?? ""} ${r.url}`).replace(/[-_/]+/g, " ").includes(semAcento(consulta.municipio));
  let fonte = "";
  try { fonte = new URL(r.url).host.replace(/^www\./, ""); } catch { fonte = ""; }
  const trechos = texto.split(/\s;\s|;\s|\s·\s/).map((t) => t.trim()).filter((t) => t.length > 0);
  trechos.forEach((trecho, i) => {
    const descartar = (motivo: string) => descartes.push({ trecho: trecho.slice(0, 200), motivo, url: r.url });
    if (RE_DESCARTE.test(trecho)) return descartar("Aluguel, parcela, média de mercado ou preço por m² — não é preço total de venda.");
    const precos = distintos(precosDe(trecho));
    const areas = distintos(areasDe(trecho));
    if (precos.length === 0 || areas.length === 0) return descartar("Trecho sem preço E área juntos.");
    if (precos.length > 1 || areas.length > 1) return descartar("Mais de um preço ou área no trecho (ambíguo) — nenhum número é escolhido.");
    const [preco] = precos, [area] = areas;
    if (preco < 1_000) return descartar("Preço implausível para venda (< R$ 1.000).");
    if (area < 10) return descartar("Área implausível (< 10 m²).");
    if (!paginaDoMunicipio && !semAcento(trecho).includes(semAcento(consulta.municipio))) return descartar("Página e trecho não são do município pesquisado.");
    if (mencionaOutraCidade(trecho, consulta.municipio, consulta.uf)) return descartar("O trecho menciona outra localidade (ou o mesmo nome em outro estado).");
    anuncios.push({
      titulo: trecho.slice(0, 140),
      url: r.url,
      fonte,
      bairro: bairroDo(trecho, consulta.municipio),
      tipologia: tipologiaDoTrecho(trecho, consulta.tipologia),
      areaM2: area,
      preco,
      caracteristicas: trecho,
      idTrecho: String(i),
    });
  });
  return { anuncios, descartes };
}
