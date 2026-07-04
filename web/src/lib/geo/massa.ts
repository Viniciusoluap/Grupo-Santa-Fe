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

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ParametrosMassa {
  larguraViaM: number;        // largura das vias (m)
  testadaLoteM: number;       // frente do lote (m)
  profundidadeLoteM: number;  // fundo do lote (m)
  loteMinimoM2: number;       // área mínima legal do lote
  comprimentoMaxQuadraM: number; // comprimento máximo de quadra (m)
  percentInstitucional: number;  // 0..1
  percentAreaVerde: number;      // 0..1
  precoM2Lote: number;           // R$/m² para VGV
}

export interface LoteGerado {
  /** Anel do lote em [lng, lat] (fechado). */
  anel: Position[];
  areaM2: number;
  tipo: "vendavel" | "area_publica";
}

export interface CenarioMassa {
  id: string;
  anguloVia: number;
  testadaLoteM: number;
  profundidadeLoteM: number;
  larguraViaM: number;
  lotes: LoteGerado[];
  kpis: {
    lotesVendaveis: number;
    lotesPublicos: number;
    areaVendavelM2: number;
    areaPublicaM2: number;
    aproveitamento: number; // areaVendavel / areaGleba
    vgv: number;
  };
}

interface Genoma {
  angulo: number;       // 0..180 graus
  testada: number;      // m
  profundidade: number; // m
  via: number;          // m
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

/** Gera os retângulos de lote no frame rotacionado. exato=true faz clip geométrico. */
function gerarLotesFrame(
  frame: FramePoly,
  g: Genoma,
  p: ParametrosMassa,
  exato: boolean
): { retangulos: Position[][]; areas: number[] } {
  const [minX, minY, maxX, maxY] = frame.bbox;
  const quadraAltura = 2 * g.profundidade;
  const pitchY = quadraAltura + g.via;
  const pitchX = p.comprimentoMaxQuadraM + g.via;

  const retangulos: Position[][] = [];
  const areas: number[] = [];
  const areaLoteNominal = g.testada * g.profundidade;

  for (let y = minY + g.via; y + quadraAltura <= maxY + quadraAltura; y += pitchY) {
    for (let x0 = minX + g.via; x0 < maxX; x0 += pitchX) {
      const xFim = Math.min(x0 + p.comprimentoMaxQuadraM, maxX);
      // duas faixas de lotes por quadra (frente para cada via)
      for (const faixa of [0, 1]) {
        const yBase = y + faixa * g.profundidade;
        if (yBase + g.profundidade > maxY) continue;
        for (let x = x0; x + g.testada <= xFim; x += g.testada) {
          const rect: Position[] = [
            [x, yBase], [x + g.testada, yBase],
            [x + g.testada, yBase + g.profundidade], [x, yBase + g.profundidade],
            [x, yBase],
          ];
          if (exato) {
            const clipped = intersect(featureCollection([turfPolygon([rect]), frame.poly]));
            if (!clipped || clipped.geometry.type !== "Polygon") continue;
            const aM2 = areaPlanar(clipped.geometry.coordinates[0]);
            if (aM2 < Math.max(p.loteMinimoM2, 0.6 * areaLoteNominal)) continue;
            retangulos.push(clipped.geometry.coordinates[0]);
            areas.push(aM2);
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
              retangulos.push(rect);
              areas.push(areaLoteNominal);
            }
          }
        }
      }
    }
  }
  return { retangulos, areas };
}

/** Área planar (shoelace) de um anel em metros — evita a esfericidade do turf.area. */
export function areaPlanar(anel: Position[]): number {
  let s = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    s += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  }
  return Math.abs(s / 2);
}

// ─── Fitness (aproximado) ────────────────────────────────────────────────────

function avaliarGenoma(
  anelMetros: Position[],
  g: Genoma,
  p: ParametrosMassa,
  areaGleba: number
): number {
  const frame = prepararFrame(anelMetros, g.angulo);
  const { areas } = gerarLotesFrame(frame, g, p, false);
  const areaTotal = areas.reduce((s, a) => s + a, 0);
  const reservaPublica = (p.percentInstitucional + p.percentAreaVerde) * areaGleba;
  const areaVendavel = Math.max(0, areaTotal - reservaPublica);
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
    return { g, fit: avaliarGenoma(anelMetros, g, params, areaGleba) };
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
      filhos.push({ g: filho, fit: avaliarGenoma(anelMetros, filho, params, areaGleba) });
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
    const { retangulos, areas } = gerarLotesFrame(frame, ind.g, params, true);

    // Ordena por área (menores primeiro) para converter em área pública
    const ordem = retangulos
      .map((r, i) => ({ r, a: areas[i] }))
      .sort((x, y) => x.a - y.a);

    const reservaNecessaria = (params.percentInstitucional + params.percentAreaVerde) * areaGleba;
    let acumPublica = 0;
    const lotes: LoteGerado[] = ordem.map(({ r, a }) => {
      const tipo: LoteGerado["tipo"] = acumPublica < reservaNecessaria ? "area_publica" : "vendavel";
      if (tipo === "area_publica") acumPublica += a;
      // volta do frame rotacionado → metros → lng/lat
      const anel = r.map((pt) => proj.paraGeo(rotacionar(pt, ind.g.angulo)));
      return { anel, areaM2: Math.round(a), tipo };
    });

    const vendaveis = lotes.filter((l) => l.tipo === "vendavel");
    const publicos = lotes.filter((l) => l.tipo === "area_publica");
    const areaVendavelM2 = vendaveis.reduce((s, l) => s + l.areaM2, 0);
    const areaPublicaM2 = publicos.reduce((s, l) => s + l.areaM2, 0);

    return {
      id: `cenario-${idx + 1}`,
      anguloVia: Math.round(ind.g.angulo),
      testadaLoteM: Math.round(ind.g.testada * 10) / 10,
      profundidadeLoteM: Math.round(ind.g.profundidade * 10) / 10,
      larguraViaM: Math.round(ind.g.via * 10) / 10,
      lotes,
      kpis: {
        lotesVendaveis: vendaveis.length,
        lotesPublicos: publicos.length,
        areaVendavelM2: Math.round(areaVendavelM2),
        areaPublicaM2: Math.round(areaPublicaM2),
        aproveitamento: areaGleba > 0 ? areaVendavelM2 / areaGleba : 0,
        vgv: Math.round(areaVendavelM2 * params.precoM2Lote),
      },
    };
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// evita "unused" — turf.area fica disponível para futuras validações esféricas
export const _areaEsferica = area;
