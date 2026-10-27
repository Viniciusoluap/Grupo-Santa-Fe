// Estudo de massa GENERATIVO — motor de parcelamento urbano.
//
// Pipeline: polígono da gleba (lng/lat) → projeção local em metros →
// malha viária orientada por um ângulo → quadras (2 faixas de lotes + via) →
// lotes com testada/profundidade → clip à gleba → KPIs (lotes, área vendável,
// aproveitamento, VGV). Um ALGORITMO GENÉTICO busca o conjunto de parâmetros
// (ângulo da malha, testada, profundidade, largura de via) que maximiza o VGV.
//
// Durante a evolução usamos avaliação aproximada (amostragem de pontos dentro
// do polígono) por performance; os cenários vencedores recebem o desenho
// geométrico exato para exibição no mapa.
//
// Honestidade técnica: é um estudo de aproveitamento — não substitui projeto
// urbanístico aprovado. Os percentuais de doação (institucional/verde) são
// atendidos convertendo os lotes de menor valor em área pública.

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import intersect from "@turf/intersect";
import area from "@turf/area";
import { polygon as turfPolygon, featureCollection, point } from "@turf/helpers";
import type { Feature, Polygon, Position } from "geojson";
import { calcularQuadroAreasMassa, totalRestricoes, type QuadroAreasMassa, type RestricoesNaoParcelaveis } from "@/lib/incorporacao/massa-quadro-areas";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Rótulo fixo exibido na tela e em todas as saídas do estudo de massa. */
export const ROTULO_ESTUDO_PRELIMINAR = "Estudo preliminar — não substitui projeto urbanístico";

export type TipologiaMassa = "grid" | "cul_de_sac";

export const TIPOLOGIAS_MASSA: { value: TipologiaMassa; label: string }[] = [
  { value: "grid", label: "Grade (grid)" },
  { value: "cul_de_sac", label: "Cul-de-sac (ruas sem saída com balão)" },
];

export interface ParametrosMassa {
  larguraViaM: number;        // largura das vias (m)
  testadaLoteM: number;       // frente do lote (m)
  profundidadeLoteM: number;  // fundo do lote (m)
  loteMinimoM2: number;       // área mínima legal do lote
  comprimentoMaxQuadraM: number; // comprimento máximo de quadra (m)
  percentInstitucional: number;  // 0..1 (sobre a área parcelável)
  percentAreaVerde: number;      // 0..1 (sobre a área parcelável)
  precoM2Lote: number;           // R$/m² para VGV
  /** Tipologia viária do cenário (padrão: grid). */
  tipologia?: TipologiaMassa;
  /** Áreas não parceláveis informadas em m² (quando não vierem do KML/mapa). */
  appM2?: number;
  supressaoVegetalM2?: number;
  faixaTransmissaoM2?: number;
  faixaServidaoM2?: number;
  outrasNaoParcelaveisM2?: number;
}

export interface LoteGerado {
  /** Anel do lote em [lng, lat] (fechado). */
  anel: Position[];
  areaM2: number;
  tipo: "vendavel" | "area_publica" | "nao_parcelavel";
  /** Destinação da área pública (doação). */
  uso?: "institucional" | "verde";
  /** Identificação (só lotes vendáveis): quadra e nº do lote na quadra. */
  quadra?: string;
  numero?: string;
}

export interface CenarioMassa {
  id: string;
  anguloVia: number;
  testadaLoteM: number;
  profundidadeLoteM: number;
  larguraViaM: number;
  tipologia?: TipologiaMassa;
  lotes: LoteGerado[];
  /** Geometrias viárias desenhadas (balões de retorno do cul-de-sac), [lng, lat]. */
  vias?: Position[][];
  kpis: {
    lotesVendaveis: number;
    lotesPublicos: number;
    areaVendavelM2: number;
    areaPublicaM2: number;
    aproveitamento: number; // areaVendavel / areaGleba
    vgv: number;
  };
  quadroAreas?: QuadroAreasMassa;
  /** Motivo quando o cenário é inviável (nenhum lote vendável). */
  inviabilidade?: string | null;
  /** Limitações conhecidas do desenho (ex.: balão que não coube na poligonal). */
  limitacoes?: string[];
}

interface Genoma {
  angulo: number;       // 0..180 graus
  testada: number;      // m
  profundidade: number; // m
  via: number;          // m
}

/** Restrições não parceláveis a partir dos parâmetros (ausentes = 0). */
export function restricoesDosParametros(p: ParametrosMassa): RestricoesNaoParcelaveis {
  return {
    appM2: p.appM2 ?? 0,
    supressaoVegetalM2: p.supressaoVegetalM2 ?? 0,
    faixaTransmissaoM2: p.faixaTransmissaoM2 ?? 0,
    faixaServidaoM2: p.faixaServidaoM2 ?? 0,
    outrasNaoParcelaveisM2: p.outrasNaoParcelaveisM2 ?? 0,
  };
}

// ─── Projeção local (equiretangular) ────────────────────────────────────────

const M_POR_GRAU_LAT = 110_540;

export function criarProjecao(centro: [number, number]) {
  const [lng0, lat0] = centro;
  const mPorGrauLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return {
    paraMetros(p: Position): [number, number] {
      return [(p[0] - lng0) * mPorGrauLng, (p[1] - lat0) * M_POR_GRAU_LAT];
    },
    paraGeo(p: Position): [number, number] {
      return [lng0 + p[0] / mPorGrauLng, lat0 + p[1] / M_POR_GRAU_LAT];
    },
  };
}

function rotacionar(p: Position, anguloGraus: number): [number, number] {
  const a = (anguloGraus * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos];
}

// ─── Geração de um cenário (dado um genoma) ─────────────────────────────────

interface FramePoly {
  poly: Feature<Polygon>;       // polígono no frame rotacionado (metros)
  bbox: [number, number, number, number];
}

function prepararFrame(anelMetros: Position[], angulo: number): FramePoly {
  const rot = anelMetros.map((p) => rotacionar(p, -angulo));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of rot) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { poly: turfPolygon([rot]), bbox: [minX, minY, maxX, maxY] };
}

interface LoteFrame {
  anel: Position[];
  area: number;
  /** Retângulo nominal (antes do recorte) no frame: [x0, y0, x1, y1]. */
  ret: [number, number, number, number];
  linha: number;
  faixa: 0 | 1;
  segmento: number;
}

/** Trechos de quadra no eixo X do frame. Grid: quadras de comprimento máximo
 *  separadas por vias transversais. Cul-de-sac: módulos com uma via-tronco
 *  central e duas ruas sem saída (uma para cada lado) de comprimento máximo. */
function segmentosQuadra(minX: number, maxX: number, g: Genoma, p: ParametrosMassa): { x0: number; x1: number; ladoBalao: -1 | 1 }[] {
  const segs: { x0: number; x1: number; ladoBalao: -1 | 1 }[] = [];
  const comp = p.comprimentoMaxQuadraM;
  if (p.tipologia === "cul_de_sac") {
    const modulo = 2 * comp + g.via;
    for (let xs = minX; xs < maxX; xs += modulo) {
      segs.push({ x0: xs, x1: Math.min(xs + comp, maxX), ladoBalao: -1 });
      const dir0 = xs + comp + g.via;
      if (dir0 < maxX) segs.push({ x0: dir0, x1: Math.min(dir0 + comp, maxX), ladoBalao: 1 });
    }
    return segs;
  }
  for (let x0 = minX + g.via; x0 < maxX; x0 += comp + g.via) {
    segs.push({ x0, x1: Math.min(x0 + comp, maxX), ladoBalao: 1 });
  }
  return segs;
}

/** Raio do balão de retorno do cul-de-sac (diâmetro mínimo usual de 20 m). */
export function raioBalaoM(larguraViaM: number): number {
  return Math.max(10, larguraViaM);
}

function circulo(cx: number, cy: number, r: number, n = 24): Position[] {
  const anel: Position[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    anel.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  anel.push(anel[0]);
  return anel;
}

function retanguloToca(ret: [number, number, number, number], cx: number, cy: number, r: number): boolean {
  const px = Math.max(ret[0], Math.min(cx, ret[2]));
  const py = Math.max(ret[1], Math.min(cy, ret[3]));
  return (px - cx) ** 2 + (py - cy) ** 2 < r * r;
}

/** Gera os lotes no frame rotacionado. exato=true faz clip geométrico e desenha os baloes. */
function gerarLotesFrame(
  frame: FramePoly,
  g: Genoma,
  p: ParametrosMassa,
  exato: boolean
): { lotes: LoteFrame[]; baloes: Position[][]; limitacoes: string[]; candidatos: number } {
  const [minX, minY, maxX, maxY] = frame.bbox;
  const quadraAltura = 2 * g.profundidade;
  const pitchY = quadraAltura + g.via;
  const segmentos = segmentosQuadra(minX, maxX, g, p);

  const lotes: LoteFrame[] = [];
  const areaLoteNominal = g.testada * g.profundidade;
  let candidatos = 0;

  let linha = 0;
  for (let y = minY + g.via; y + quadraAltura <= maxY + quadraAltura; y += pitchY, linha++) {
    segmentos.forEach((seg, segmento) => {
      // duas faixas de lotes por quadra (frente para cada via)
      for (const faixa of [0, 1] as const) {
        const yBase = y + faixa * g.profundidade;
        if (yBase + g.profundidade > maxY) continue;
        // no cul-de-sac os lotes começam junto à via-tronco (lado oposto ao balão)
        const n = Math.floor((seg.x1 - seg.x0) / g.testada);
        for (let i = 0; i < n; i++) {
          const x = seg.ladoBalao === -1 ? seg.x1 - (i + 1) * g.testada : seg.x0 + i * g.testada;
          const ret: [number, number, number, number] = [x, yBase, x + g.testada, yBase + g.profundidade];
          const rect: Position[] = [
            [ret[0], ret[1]], [ret[2], ret[1]], [ret[2], ret[3]], [ret[0], ret[3]], [ret[0], ret[1]],
          ];
          if (exato) {
            const clipped = intersect(featureCollection([turfPolygon([rect]), frame.poly]));
            if (!clipped || clipped.geometry.type !== "Polygon") continue;
            const aM2 = areaPlanar(clipped.geometry.coordinates[0]);
            if (aM2 < Math.max(p.loteMinimoM2, 0.6 * areaLoteNominal)) continue;
            candidatos++;
            lotes.push({ anel: clipped.geometry.coordinates[0], area: aM2, ret, linha, faixa, segmento });
          } else {
            // aproximação: 5 pontos de amostragem dentro do retângulo
            const cx = x + g.testada / 2, cy = yBase + g.profundidade / 2;
            const pontos: Position[] = [
              [cx, cy],
              [x + 1, yBase + 1], [x + g.testada - 1, yBase + 1],
              [x + 1, yBase + g.profundidade - 1], [x + g.testada - 1, yBase + g.profundidade - 1],
            ];
            let dentro = 0;
            for (const pt of pontos) {
              if (booleanPointInPolygon(point(pt), frame.poly)) dentro++;
            }
            if (dentro === 5 && areaLoteNominal >= p.loteMinimoM2) {
              candidatos++;
              lotes.push({ anel: rect, area: areaLoteNominal, ret, linha, faixa, segmento });
            }
          }
        }
      }
    });
  }

  const baloes: Position[][] = [];
  const limitacoes: string[] = [];
  if (!exato || p.tipologia !== "cul_de_sac" || lotes.length === 0) {
    return { lotes, baloes, limitacoes, candidatos };
  }

  // Cul-de-sac: um balão de retorno no fim de cada rua sem saída. A rua k fica
  // abaixo da linha de quadras k; é servida pela faixa 0 da linha k e pela faixa
  // 1 da linha k-1. O balão é centrado no eixo da rua, recuado de um raio a
  // partir do último lote, e os lotes que ele toca viram sistema viário.
  const r = raioBalaoM(g.via);
  const remover = new Set<LoteFrame>();
  let semEspaco = 0;
  const linhas = Math.max(...lotes.map((l) => l.linha)) + 1;
  for (let k = 0; k <= linhas; k++) {
    segmentos.forEach((seg, s) => {
      const frente = lotes.filter((l) => l.segmento === s && ((l.linha === k && l.faixa === 0) || (l.linha === k - 1 && l.faixa === 1)));
      if (frente.length === 0) return;
      const extremo = seg.ladoBalao === 1 ? Math.max(...frente.map((l) => l.ret[2])) : Math.min(...frente.map((l) => l.ret[0]));
      const inicio = seg.ladoBalao === 1 ? Math.min(...frente.map((l) => l.ret[0])) : Math.max(...frente.map((l) => l.ret[2]));
      if (Math.abs(extremo - inicio) < 3 * r) { semEspaco++; return; }
      const yRua = minY + g.via + k * pitchY - g.via / 2;
      const cx = extremo - seg.ladoBalao * r;
      if (!booleanPointInPolygon(point([cx, yRua]), frame.poly)) { semEspaco++; return; }
      const recortado = intersect(featureCollection([turfPolygon([circulo(cx, yRua, r)]), frame.poly]));
      if (!recortado || recortado.geometry.type !== "Polygon") { semEspaco++; return; }
      baloes.push(recortado.geometry.coordinates[0]);
      for (const l of frente) if (retanguloToca(l.ret, cx, yRua, r)) remover.add(l);
      // lotes da faixa oposta da mesma quadra também podem ser tocados
      for (const l of lotes) if (l.segmento === s && retanguloToca(l.ret, cx, yRua, r)) remover.add(l);
    });
  }
  if (baloes.length === 0) {
    limitacoes.push("Cul-de-sac: a poligonal não comporta baloes de retorno com estes parâmetros — o desenho ficou equivalente a ruas sem saída sem balão. Reduza a largura da via ou o comprimento da quadra.");
  } else if (semEspaco > 0) {
    limitacoes.push(`Cul-de-sac: ${semEspaco} rua(s) curta(s) ou no limite da poligonal ficaram sem balão de retorno.`);
  }
  limitacoes.push("Cul-de-sac simplificado: via-tronco e ruas sem saída com balão; a ligação com o sistema viário externo não é modelada.");
  return { lotes: lotes.filter((l) => !remover.has(l)), baloes, limitacoes, candidatos };
}

/** Área planar (shoelace) de um anel em metros — evita a esfericidade do turf.area. */
export function areaPlanar(anel: Position[]): number {
  let s = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    s += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  }
  return Math.abs(s / 2);
}

// ─── Validação de parâmetros ────────────────────────────────────────────────

/**
 * Valida os parâmetros do estudo de massa antes de rodar o motor generativo.
 * Retorna uma mensagem amigável (pt-BR) descrevendo o primeiro problema
 * encontrado, ou `null` quando os parâmetros são válidos.
 *
 * Importante: `testadaLoteM`, `profundidadeLoteM` e `comprimentoMaxQuadraM`
 * são usados como passo de incremento em laços `for` dentro de
 * `gerarLotesFrame`. Um valor zero ou negativo nesses campos trava o
 * navegador em loop infinito — por isso são validados aqui antes de
 * qualquer geração, em vez de deixar o motor falhar silenciosamente ou
 * travar a página.
 */
export function validarParametrosMassa(p: ParametrosMassa): string | null {
  if (!Number.isFinite(p.larguraViaM) || p.larguraViaM < 0) {
    return "Largura da via deve ser um número maior ou igual a 0.";
  }
  if (!Number.isFinite(p.testadaLoteM) || p.testadaLoteM <= 0) {
    return "Testada do lote deve ser um número maior que 0.";
  }
  if (!Number.isFinite(p.profundidadeLoteM) || p.profundidadeLoteM <= 0) {
    return "Profundidade do lote deve ser um número maior que 0.";
  }
  if (!Number.isFinite(p.loteMinimoM2) || p.loteMinimoM2 < 0) {
    return "Lote mínimo não pode ser negativo.";
  }
  if (!Number.isFinite(p.comprimentoMaxQuadraM) || p.comprimentoMaxQuadraM <= 0) {
    return "Comprimento máximo da quadra deve ser um número maior que 0.";
  }
  if (!Number.isFinite(p.percentInstitucional) || p.percentInstitucional < 0 || p.percentInstitucional >= 1) {
    return "% institucional deve ser um número entre 0 e 100%.";
  }
  if (!Number.isFinite(p.percentAreaVerde) || p.percentAreaVerde < 0 || p.percentAreaVerde >= 1) {
    return "% área verde deve ser um número entre 0 e 100%.";
  }
  if (p.percentInstitucional + p.percentAreaVerde >= 1) {
    return "A soma de % institucional e % área verde deve ser menor que 100%.";
  }
  if (!Number.isFinite(p.precoM2Lote) || p.precoM2Lote <= 0) {
    return "Preço do lote (R$/m²) deve ser um número maior que 0.";
  }
  if (p.tipologia !== undefined && !TIPOLOGIAS_MASSA.some((t) => t.value === p.tipologia)) {
    return "Tipologia do cenário inválida (use grid ou cul-de-sac).";
  }
  const restricoes: [keyof ParametrosMassa, string][] = [
    ["appM2", "APP"], ["supressaoVegetalM2", "Supressão vegetal"], ["faixaTransmissaoM2", "Faixa de transmissão"],
    ["faixaServidaoM2", "Faixa de servidão"], ["outrasNaoParcelaveisM2", "Outras não parceláveis"],
  ];
  for (const [k, rotulo] of restricoes) {
    const v = p[k];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
      return `${rotulo} (m²) não pode ser negativa.`;
    }
  }
  return null;
}

// ─── Fitness (aproximado) ────────────────────────────────────────────────────

function avaliarGenoma(
  anelMetros: Position[],
  g: Genoma,
  p: ParametrosMassa,
  areaGleba: number,
  naoParcelavel: number
): number {
  const frame = prepararFrame(anelMetros, g.angulo);
  const { lotes } = gerarLotesFrame(frame, g, p, false);
  const areaTotal = lotes.reduce((s, l) => s + l.area, 0);
  const areaParcelavel = Math.max(0, areaGleba - naoParcelavel);
  // parcela proporcional dos lotes que cai em área não parcelável + doações
  const fracaoParcelavel = areaGleba > 0 ? areaParcelavel / areaGleba : 0;
  const reservaPublica = (p.percentInstitucional + p.percentAreaVerde) * areaParcelavel;
  const areaVendavel = Math.max(0, areaTotal * fracaoParcelavel - reservaPublica);
  return areaVendavel * p.precoM2Lote; // fitness = VGV aproximado
}

// ─── Algoritmo genético ──────────────────────────────────────────────────────

function aleatorio(min: number, max: number, rnd: () => number): number {
  return min + (max - min) * rnd();
}

/** PRNG determinístico (mulberry32) para resultados reproduzíveis/testáveis. */
export function criarRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OpcoesGeracao {
  populacao?: number;
  geracoes?: number;
  seed?: number;
  nCenarios?: number;
}

/**
 * Roda o motor generativo completo e retorna os melhores cenários (com
 * geometria exata dos lotes em lng/lat, prontos para desenhar no mapa).
 */
export function gerarCenariosMassa(
  anelGeo: Position[],
  centro: [number, number],
  params: ParametrosMassa,
  opts: OpcoesGeracao = {}
): CenarioMassa[] {
  const pop = opts.populacao ?? 14;
  const gens = opts.geracoes ?? 12;
  const nCen = opts.nCenarios ?? 3;
  const rnd = criarRng(opts.seed ?? 42);

  const proj = criarProjecao(centro);
  const anelMetros = anelGeo.map((p) => proj.paraMetros(p));
  const areaGleba = areaPlanar(anelMetros);
  const restricoes = restricoesDosParametros(params);
  const naoParcelavel = Math.min(totalRestricoes(restricoes), areaGleba);
  const areaParcelavel = Math.max(0, areaGleba - naoParcelavel);

  const bounds = {
    angulo: [0, 180] as const,
    testada: [params.testadaLoteM, params.testadaLoteM * 2.2] as const,
    profundidade: [Math.max(20, params.profundidadeLoteM * 0.7), params.profundidadeLoteM * 1.4] as const,
    via: [params.larguraViaM, params.larguraViaM * 1.4] as const,
  };

  function genomaAleatorio(): Genoma {
    return {
      angulo: aleatorio(...bounds.angulo, rnd),
      testada: aleatorio(...bounds.testada, rnd),
      profundidade: aleatorio(...bounds.profundidade, rnd),
      via: aleatorio(...bounds.via, rnd),
    };
  }

  // População inicial + avaliação
  let populacao = Array.from({ length: pop }, () => {
    const g = genomaAleatorio();
    return { g, fit: avaliarGenoma(anelMetros, g, params, areaGleba, naoParcelavel) };
  });

  for (let gen = 0; gen < gens; gen++) {
    populacao.sort((a, b) => b.fit - a.fit);
    const elite = populacao.slice(0, Math.max(2, Math.floor(pop / 4)));
    const filhos: typeof populacao = [...elite];
    while (filhos.length < pop) {
      // torneio simples
      const pai = populacao[Math.floor(rnd() * pop / 2)].g;
      const mae = populacao[Math.floor(rnd() * pop / 2)].g;
      const mix = rnd();
      const filho: Genoma = {
        angulo: pai.angulo * mix + mae.angulo * (1 - mix),
        testada: pai.testada * mix + mae.testada * (1 - mix),
        profundidade: pai.profundidade * mix + mae.profundidade * (1 - mix),
        via: pai.via * mix + mae.via * (1 - mix),
      };
      // mutação gaussiana leve
      if (rnd() < 0.5) filho.angulo = clamp(filho.angulo + (rnd() - 0.5) * 40, ...bounds.angulo);
      if (rnd() < 0.3) filho.testada = clamp(filho.testada + (rnd() - 0.5) * 4, ...bounds.testada);
      if (rnd() < 0.3) filho.profundidade = clamp(filho.profundidade + (rnd() - 0.5) * 8, ...bounds.profundidade);
      filhos.push({ g: filho, fit: avaliarGenoma(anelMetros, filho, params, areaGleba, naoParcelavel) });
    }
    populacao = filhos;
  }

  populacao.sort((a, b) => b.fit - a.fit);

  // Seleciona os N melhores com ângulos suficientemente distintos
  const escolhidos: typeof populacao = [];
  for (const ind of populacao) {
    if (escolhidos.every((e) => Math.abs(e.g.angulo - ind.g.angulo) > 12)) {
      escolhidos.push(ind);
    }
    if (escolhidos.length === nCen) break;
  }
  while (escolhidos.length < Math.min(nCen, populacao.length)) {
    escolhidos.push(populacao[escolhidos.length]);
  }

  // Desenho exato dos vencedores
  return escolhidos.map((ind, idx) => {
    const frame = prepararFrame(anelMetros, ind.g.angulo);
    const { lotes: lotesFrame, baloes, limitacoes, candidatos } = gerarLotesFrame(frame, ind.g, params, true);
    const voltaGeo = (anel: Position[]) => anel.map((pt) => proj.paraGeo(rotacionar(pt, ind.g.angulo)));

    // Menores lotes primeiro: viram, nesta ordem, a parcela proporcional das
    // áreas não parceláveis, a área institucional e a área verde.
    const ordem = [...lotesFrame].sort((x, y) => x.area - y.area);
    const areaTodos = ordem.reduce((s, l) => s + l.area, 0);
    const reservaRestricao = areaGleba > 0 ? naoParcelavel * (areaTodos / areaGleba) : 0;
    const reservaInst = params.percentInstitucional * areaParcelavel;
    const reservaVerde = params.percentAreaVerde * areaParcelavel;
    let acR = 0, acI = 0, acV = 0;
    const classificados = ordem.map((l) => {
      let tipo: LoteGerado["tipo"] = "vendavel";
      let uso: LoteGerado["uso"];
      if (acR < reservaRestricao) { tipo = "nao_parcelavel"; acR += l.area; }
      else if (acI < reservaInst) { tipo = "area_publica"; uso = "institucional"; acI += l.area; }
      else if (acV < reservaVerde) { tipo = "area_publica"; uso = "verde"; acV += l.area; }
      return { l, tipo, uso };
    });

    // Numeração: quadra = (linha, trecho); lotes vendáveis numerados por faixa e posição.
    const vendaveisFrame = classificados.filter((c) => c.tipo === "vendavel");
    const chaves = Array.from(new Set(vendaveisFrame.map((c) => `${c.l.linha}:${c.l.segmento}`)))
      .sort((a, b) => { const [la, sa] = a.split(":").map(Number); const [lb, sb] = b.split(":").map(Number); return la - lb || sa - sb; });
    const numeracao = new Map<LoteFrame, { quadra: string; numero: string }>();
    chaves.forEach((chave, qi) => {
      const daQuadra = vendaveisFrame.filter((c) => `${c.l.linha}:${c.l.segmento}` === chave)
        .sort((a, b) => a.l.faixa - b.l.faixa || a.l.ret[0] - b.l.ret[0]);
      daQuadra.forEach((c, li) => numeracao.set(c.l, { quadra: String(qi + 1), numero: String(li + 1) }));
    });

    const lotes: LoteGerado[] = classificados.map(({ l, tipo, uso }) => ({
      anel: voltaGeo(l.anel),
      areaM2: Math.round(l.area),
      tipo,
      ...(uso ? { uso } : {}),
      ...(numeracao.get(l) ?? {}),
    }));

    const vendaveis = lotes.filter((l) => l.tipo === "vendavel");
    const publicos = lotes.filter((l) => l.tipo === "area_publica");
    const areaVendavelM2 = vendaveis.reduce((s, l) => s + l.areaM2, 0);
    const areaInstitucionalM2 = publicos.filter((l) => l.uso === "institucional").reduce((s, l) => s + l.areaM2, 0);
    const areaVerdeM2 = publicos.filter((l) => l.uso !== "institucional").reduce((s, l) => s + l.areaM2, 0);
    const quadroAreas = calcularQuadroAreasMassa({
      areaBrutaM2: areaGleba,
      restricoes,
      areaVendavelM2,
      nLotesVendaveis: vendaveis.length,
      areaInstitucionalM2,
      areaVerdeM2,
      precoM2Lote: params.precoM2Lote,
    });

    return {
      id: `cenario-${idx + 1}`,
      anguloVia: Math.round(ind.g.angulo),
      testadaLoteM: Math.round(ind.g.testada * 10) / 10,
      profundidadeLoteM: Math.round(ind.g.profundidade * 10) / 10,
      larguraViaM: Math.round(ind.g.via * 10) / 10,
      tipologia: params.tipologia ?? "grid",
      lotes,
      vias: baloes.map(voltaGeo),
      kpis: {
        lotesVendaveis: vendaveis.length,
        lotesPublicos: publicos.length,
        areaVendavelM2: Math.round(areaVendavelM2),
        areaPublicaM2: Math.round(areaInstitucionalM2 + areaVerdeM2),
        aproveitamento: areaGleba > 0 ? areaVendavelM2 / areaGleba : 0,
        vgv: Math.round(areaVendavelM2 * params.precoM2Lote),
      },
      quadroAreas,
      inviabilidade: motivoInviabilidade(vendaveis.length, candidatos, quadroAreas, ind.g, params),
      limitacoes,
    };
  });
}

/** Motivo de inviabilidade de um cenário (null quando há lote vendável). */
export function motivoInviabilidade(
  lotesVendaveis: number,
  candidatos: number,
  quadro: Pick<QuadroAreasMassa, "areaParcelavelM2">,
  g: { testada: number; profundidade: number; via: number },
  p: Pick<ParametrosMassa, "loteMinimoM2">
): string | null {
  if (lotesVendaveis > 0) return null;
  if (quadro.areaParcelavelM2 <= 0) return "Inviável: as áreas não parceláveis ocupam toda a gleba — não há área parcelável.";
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (candidatos === 0) {
    return `Inviável: nenhum lote de ${f(g.testada)} × ${f(g.profundidade)} m (mínimo ${f(p.loteMinimoM2)} m²) coube na poligonal com vias de ${f(g.via)} m. Reduza testada, profundidade, lote mínimo ou largura da via.`;
  }
  return "Inviável: todos os lotes gerados foram consumidos pelas doações (institucional e área verde) e pelas áreas não parceláveis.";
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// evita "unused" — turf.area fica disponível para futuras validações esféricas
export const _areaEsferica = area;
