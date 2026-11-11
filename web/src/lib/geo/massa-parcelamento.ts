// Estudo de massa — motor de parcelamento urbano DETERMINÍSTICO (v2).
//
// Pipeline: polígono da gleba (lng/lat) → projeção local em metros → implantação
// por tipologia (grade, cul-de-sac, rua simples) → lotes EXATOS (testada ×
// profundidade informadas, aceitos só se couberem inteiros na poligonal) → vias
// como corredores de largura informada → classificação (vendável / institucional /
// verde / não parcelável) → quadro de áreas e VGV.
//
// Mesma poligonal + mesmos parâmetros + mesma versão do algoritmo = mesmo resultado.
// Não há Math.random, semente variável nem dependência de relógio. A busca é uma
// varredura determinística de orientações e deslocamentos da malha; os parâmetros do
// usuário (testada, profundidade, largura da via, área mínima) NUNCA são alterados
// pelo motor — se a geometria não comportar o lote, o motivo é informado.
//
// Honestidade técnica: é um estudo de aproveitamento — não substitui projeto
// urbanístico aprovado nem levantamento técnico profissional.

import { featureCollection, intersect, polygon as turfPolygon, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { calcularQuadroAreasMassa, totalRestricoes, type QuadroAreasMassa, type RestricoesNaoParcelaveis } from "@/lib/incorporacao/massa-quadro-areas";
import {
  angulosDasArestas, areaPlanar, diferencaAngular, menorLarguraEnvelope, pontoDentro, prepararFrameAnel, retAnel,
  retanguloDentro, rotacionar, round2, validarPoligonal,
  type FrameAnel, type ImplantacaoFrame, type LoteFrame, type Ret,
} from "./geometria-parcelamento";
import { buscarRuaSimples, gerarRuaSimplesFrame, implantacaoDoCandidatoRua, type CandidatoRua } from "./rua-simples";
import { buscarViaDivisa, divisasOpostas } from "./rua-divisa";
import { buscarPorLados, LADOS_GLEBA, type LadoGleba } from "./lados-gleba";
import { buscarViasPublicas } from "./vias-publicas";

export { areaPlanar, rotacionar } from "./geometria-parcelamento";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Rótulo fixo exibido na tela e em todas as saídas do estudo de massa. */
export const ROTULO_ESTUDO_PRELIMINAR = "Estudo preliminar — não substitui projeto urbanístico";

/** Versão do algoritmo — entra na assinatura: mudou o algoritmo, mudou a versão. */
export const VERSAO_ALGORITMO_MASSA = "2.0.0";

export type TipologiaMassa = "grid" | "cul_de_sac" | "rua_simples" | "vias_publicas";

export const TIPOLOGIAS_MASSA: { value: TipologiaMassa; label: string }[] = [
  { value: "grid", label: "Grade (grid)" },
  { value: "cul_de_sac", label: "Cul-de-sac (ruas sem saída com balão)" },
  { value: "rua_simples", label: "Rua simples (via única de mão dupla)" },
  { value: "vias_publicas", label: "Vias públicas (divisas já voltadas para vias — 100% de aproveitamento)" },
];

export type ModoSistemaViario = "automatico" | "manual";

export interface ParametrosMassa {
  larguraViaM: number;        // largura das vias (m) — usada exatamente
  testadaLoteM: number;       // frente do lote (m) — usada exatamente
  profundidadeLoteM: number;  // fundo do lote (m) — usado exatamente
  loteMinimoM2: number;       // área mínima legal do lote
  comprimentoMaxQuadraM: number; // comprimento máximo de quadra (m) (grade e cul-de-sac)
  percentInstitucional: number;  // 0..1 (sobre a área parcelável)
  percentAreaVerde: number;      // 0..1 (sobre a área parcelável)
  precoM2Lote: number;           // R$/m² para VGV
  /** Tipologia viária do cenário (padrão: grid). */
  tipologia?: TipologiaMassa;
  /** Como a área do sistema viário é definida (padrão: automático = área geométrica das vias desenhadas). */
  modoSistemaViario?: ModoSistemaViario;
  /** Área do sistema viário informada (m²) — só vale no modo manual. */
  areaSistemaViarioM2?: number;
  /** Rua Simples: "retangular" (padrão, testada × profundidade exatas) ou "divisa" (lote acompanha a divisa). */
  formatoLote?: "retangular" | "divisa";
  /** Rua Simples: traçado "reta" (padrão) ou "divisa" (via acompanha a divisa, com curvas; lotes acompanham a divisa). */
  tracadoVia?: "reta" | "divisa";
  /** Legado: restringe os cenários à divisa oposta ao primeiro cenário automático (substituído por `ladosVia`). */
  inverterLadoVia?: boolean;
  /** Rua pela divisa: lados onde a via deve ficar (rua de cima/esquerda/direita/baixo). Vazio = automático. */
  ladosVia?: LadoGleba[];
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
  /** Formato "acompanha a divisa": testada real e profundidade média (área ÷ testada). */
  testadaM?: number;
  profundidadeMediaM?: number;
}

export type CriterioCenario = "maior_area_vendavel" | "melhor_eficiencia_viaria" | "alternativa_distinta";

export const ROTULO_CRITERIO: Record<CriterioCenario, string> = {
  maior_area_vendavel: "Maior área vendável válida",
  melhor_eficiencia_viaria: "Melhor eficiência do sistema viário",
  alternativa_distinta: "Alternativa de implantação distinta",
};

export interface SistemaViarioCenario {
  modo: ModoSistemaViario;
  larguraM: number;
  /** Área das vias DESENHADAS (união dos corredores + balões, recortada pela poligonal). */
  areaGeometricaM2: number;
  areaInformadaM2?: number;
  diferencaM2?: number;
}

export interface CenarioMassa {
  viaLadoOposto?: boolean;
  /** Lados escolhidos para a via (quando o usuário marcou rua de cima/esquerda/direita/baixo). */
  ladosVia?: LadoGleba[];
  id: string;
  anguloVia: number;
  testadaLoteM: number;
  profundidadeLoteM: number;
  larguraViaM: number;
  tipologia?: TipologiaMassa;
  lotes: LoteGerado[];
  /** Balões de retorno do cul-de-sac, [lng, lat]. */
  vias?: Position[][];
  /** Corredores viários desenhados (anéis em [lng, lat]) — uma única geometria para desenho, quadro e unidades. */
  ruas?: Position[][];
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
  /** Critério pelo qual este cenário foi escolhido (motor v2). */
  criterio?: CriterioCenario;
  criterioRotulo?: string;
  sistemaViario?: SistemaViarioCenario;
  versaoAlgoritmo?: string;
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

// ─── Validação de parâmetros ────────────────────────────────────────────────

/**
 * Valida os parâmetros do estudo de massa antes de rodar o motor.
 * Retorna uma mensagem amigável (pt-BR) descrevendo o primeiro problema
 * encontrado, ou `null` quando os parâmetros são válidos.
 *
 * `testadaLoteM`, `profundidadeLoteM` e `comprimentoMaxQuadraM` são passos de
 * incremento em laços — zero/negativo travaria o navegador, por isso são
 * validados aqui. Também valida a compatibilidade testada × profundidade × área
 * mínima (nada é "corrigido" em silêncio).
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
  // vias públicas: não há quadra nem via interna a desenhar — comprimento da quadra e largura da via não se aplicam
  if (p.tipologia !== "vias_publicas" && (!Number.isFinite(p.comprimentoMaxQuadraM) || p.comprimentoMaxQuadraM <= 0)) {
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
    return "Tipologia do cenário inválida (use grid, cul-de-sac, rua simples ou vias públicas).";
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
  const areaLote = p.testadaLoteM * p.profundidadeLoteM;
  if (p.inverterLadoVia !== undefined && typeof p.inverterLadoVia !== "boolean") {
    return "Seleção de lado da via inválida.";
  }
  if (p.ladosVia !== undefined && (!Array.isArray(p.ladosVia) || p.ladosVia.some((l) => !LADOS_GLEBA.includes(l)))) {
    return "Lado da via inválido (use rua de cima, da esquerda, da direita ou de baixo).";
  }
  if (p.tracadoVia !== undefined && p.tracadoVia !== "reta" && p.tracadoVia !== "divisa") {
    return "Traçado da via inválido (use reta ou acompanha a divisa).";
  }
  if (p.formatoLote !== undefined && p.formatoLote !== "retangular" && p.formatoLote !== "divisa") {
    return "Formato do lote inválido (use retangular ou acompanha a divisa).";
  }
  if (p.formatoLote !== "divisa" && !(p.tipologia === "rua_simples" && p.tracadoVia === "divisa") && areaLote + 1e-9 < p.loteMinimoM2) {
    const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    return `Testada × profundidade (${f(p.testadaLoteM)} × ${f(p.profundidadeLoteM)} m = ${f(areaLote)} m²) é menor que a área mínima do lote (${f(p.loteMinimoM2)} m²). Ajuste as dimensões ou a área mínima — o motor não altera as dimensões informadas.`;
  }
  if (p.tipologia === "rua_simples" && !(p.larguraViaM > 0)) {
    return "Rua simples exige largura da via maior que 0.";
  }
  if (p.modoSistemaViario !== undefined && p.modoSistemaViario !== "automatico" && p.modoSistemaViario !== "manual") {
    return "Modo do sistema viário inválido (use automático ou manual).";
  }
  if (p.modoSistemaViario === "manual") {
    const v = p.areaSistemaViarioM2;
    if (typeof v !== "number" || !Number.isFinite(v)) return "Informe a área do sistema viário (m²) para o modo manual.";
    if (v < 0) return "Área do sistema viário não pode ser negativa.";
  }
  return null;
}

/** Valida a área viária manual contra a gleba (precisa da área parcelável, que depende da poligonal). */
export function validarSistemaViarioManual(p: ParametrosMassa, areaParcelavelM2: number): string | null {
  if (p.modoSistemaViario !== "manual") return null;
  const v = p.areaSistemaViarioM2 ?? NaN;
  if (!Number.isFinite(v) || v < 0) return "Área do sistema viário inválida.";
  if (v > areaParcelavelM2 + 1e-6) {
    return `Área do sistema viário informada (${v.toLocaleString("pt-BR")} m²) é maior que a área disponível para parcelamento (${round2(areaParcelavelM2).toLocaleString("pt-BR")} m²).`;
  }
  return null;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

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

function retanguloToca(ret: Ret, cx: number, cy: number, r: number): boolean {
  const px = Math.max(ret[0], Math.min(cx, ret[2]));
  const py = Math.max(ret[1], Math.min(cy, ret[3]));
  return (px - cx) ** 2 + (py - cy) ** 2 < r * r;
}

/** PRNG determinístico (mulberry32) — mantido por compatibilidade; o motor v2 não o utiliza. */
export function criarRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dim { testada: number; profundidade: number; via: number }

// ─── Grade e cul-de-sac (motores originais, agora com lotes exatos) ─────────

interface SegQuadra { x0: number; x1: number; ladoBalao: -1 | 1; tronco?: number }

/** Trechos de quadra no eixo X do frame. Grid: quadras de comprimento máximo
 *  separadas por vias transversais. Cul-de-sac: módulos com uma via-tronco
 *  central e duas ruas sem saída (uma para cada lado) de comprimento máximo. */
function segmentosQuadra(minX: number, maxX: number, g: Dim, p: ParametrosMassa, ox: number): SegQuadra[] {
  const segs: SegQuadra[] = [];
  const comp = p.comprimentoMaxQuadraM;
  if (p.tipologia === "cul_de_sac") {
    const modulo = 2 * comp + g.via;
    for (let xs = minX + ox - modulo; xs < maxX; xs += modulo) {
      segs.push({ x0: xs, x1: xs + comp, ladoBalao: -1, tronco: xs + comp });
      const dir0 = xs + comp + g.via;
      segs.push({ x0: dir0, x1: dir0 + comp, ladoBalao: 1, tronco: xs + comp });
    }
    return segs;
  }
  for (let x0 = minX + g.via + ox - (comp + g.via); x0 < maxX; x0 += comp + g.via) {
    segs.push({ x0, x1: x0 + comp, ladoBalao: 1 });
  }
  return segs;
}

/** Passo da malha (m) nos eixos X e Y — define o espaço de fases a explorar. */
function passosMalha(g: Dim, p: ParametrosMassa): { px: number; py: number } {
  const comp = p.comprimentoMaxQuadraM;
  return { px: p.tipologia === "cul_de_sac" ? 2 * comp + g.via : comp + g.via, py: 2 * g.profundidade + g.via };
}

/** Chave da rua horizontal que dá frente ao lote (grade: por linha; cul-de-sac: por linha e trecho). */
function chaveRuaFrente(p: ParametrosMassa, linha: number, faixa: 0 | 1, segmento: number): string {
  const m = faixa === 0 ? linha : linha + 1;
  return p.tipologia === "cul_de_sac" ? `${m}:${segmento}` : `${m}`;
}

function gerarImplantacaoGrade(fr: FrameAnel, g: Dim, p: ParametrosMassa, ox: number, oy: number, comBaloes: boolean, ruasExcluidas?: Set<string>): ImplantacaoFrame {
  const [minX, minY, maxX, maxY] = fr.bbox;
  const { py: pitchY } = passosMalha(g, p);
  const segmentos = segmentosQuadra(minX, maxX, g, p, ox);
  const lotes: LoteFrame[] = [];
  let candidatos = 0;

  for (let k = -1; ; k++) {
    const y = minY + g.via + oy + k * pitchY;
    if (y > maxY) break;
    const linha = k + 1;
    segmentos.forEach((seg, segmento) => {
      const n = Math.floor((seg.x1 - seg.x0) / g.testada + 1e-9);
      for (const faixa of [0, 1] as const) {
        const yBase = y + faixa * g.profundidade;
        if (yBase + g.profundidade < minY || yBase > maxY) continue;
        if (ruasExcluidas?.has(chaveRuaFrente(p, linha, faixa, segmento))) continue; // rua suprimida no ajuste da malha
        for (let i = 0; i < n; i++) {
          // no cul-de-sac os lotes começam junto à via-tronco (lado oposto ao balão)
          const x = seg.ladoBalao === -1 ? seg.x1 - (i + 1) * g.testada : seg.x0 + i * g.testada;
          if (x + g.testada < minX || x > maxX) continue;
          const ret: Ret = [x, yBase, x + g.testada, yBase + g.profundidade];
          if (!retanguloDentro(fr.ind, ret)) continue;
          // acesso: o trecho de via em frente ao lote precisa estar dentro da gleba (sem lote "de frente para o nada")
          if (g.via > 0) {
            const frente: Ret = faixa === 0 ? [x, yBase - g.via, x + g.testada, yBase] : [x, yBase + g.profundidade, x + g.testada, yBase + g.profundidade + g.via];
            if (!retanguloDentro(fr.ind, frente)) continue;
          }
          candidatos++;
          lotes.push({ anel: retAnel(ret), area: g.testada * g.profundidade, ret, linha, faixa, segmento, ordem: x });
        }
      }
    });
  }

  const baloes: Position[][] = [];
  const limitacoes: string[] = [];
  let remanescentes = lotes;
  if (comBaloes && p.tipologia === "cul_de_sac" && lotes.length > 0) {
    // Cul-de-sac: um balão de retorno no fim de cada rua sem saída. A rua k fica
    // abaixo da linha de quadras k; é servida pela faixa 0 da linha k e pela faixa
    // 1 da linha k-1. O balão é centrado no eixo da rua, recuado de um raio a
    // partir do último lote, e os lotes que ele toca viram sistema viário.
    const r = raioBalaoM(g.via);
    const remover = new Set<LoteFrame>();
    let semEspaco = 0;
    const minLinha = Math.min(...lotes.map((l) => l.linha));
    const maxLinha = Math.max(...lotes.map((l) => l.linha)) + 1;
    const glebaTurf = turfPolygon([fr.anel]);
    for (let kRua = minLinha; kRua <= maxLinha; kRua++) {
      segmentos.forEach((seg, s) => {
        const frente = lotes.filter((l) => l.segmento === s && ((l.linha === kRua && l.faixa === 0) || (l.linha === kRua - 1 && l.faixa === 1)));
        if (frente.length === 0) return;
        const extremo = seg.ladoBalao === 1 ? Math.max(...frente.map((l) => l.ret[2])) : Math.min(...frente.map((l) => l.ret[0]));
        const inicio = seg.ladoBalao === 1 ? Math.min(...frente.map((l) => l.ret[0])) : Math.max(...frente.map((l) => l.ret[2]));
        if (Math.abs(extremo - inicio) < 3 * r) { semEspaco++; return; }
        const yRua = minY + g.via + oy + (kRua - 1) * pitchY - g.via / 2;
        const cx = extremo - seg.ladoBalao * r;
        if (!pontoDentro(fr.anel, cx, yRua)) { semEspaco++; return; }
        const circ = circulo(cx, yRua, r);
        if (retanguloDentro(fr.ind, [cx - r, yRua - r, cx + r, yRua + r])) {
          baloes.push(circ); // balão inteiro dentro da gleba: recorte desnecessário
        } else {
          const recortado = intersect(featureCollection([turfPolygon([circ]), glebaTurf]));
          if (!recortado || recortado.geometry.type !== "Polygon") { semEspaco++; return; }
          baloes.push(recortado.geometry.coordinates[0]);
        }
        for (const l of lotes) if (l.segmento === s && retanguloToca(l.ret, cx, yRua, r)) remover.add(l);
      });
    }
    if (baloes.length === 0) {
      limitacoes.push("Cul-de-sac: a poligonal não comporta baloes de retorno com estes parâmetros — o desenho ficou equivalente a ruas sem saída sem balão. Reduza a largura da via ou o comprimento da quadra.");
    } else if (semEspaco > 0) {
      limitacoes.push(`Cul-de-sac: ${semEspaco} rua(s) curta(s) ou no limite da poligonal ficaram sem balão de retorno.`);
    }
    limitacoes.push("Cul-de-sac simplificado: via-tronco e ruas sem saída com balão; a ligação com o sistema viário externo não é modelada.");
    remanescentes = lotes.filter((l) => !remover.has(l));
  } else if (p.tipologia === "cul_de_sac") {
    limitacoes.push("Cul-de-sac simplificado: via-tronco e ruas sem saída com balão; a ligação com o sistema viário externo não é modelada.");
  } else {
    limitacoes.push("Grade: a ligação do sistema viário com as vias externas à gleba não é modelada.");
  }
  // As ruas sem saída são derivadas dos lotes ANTES da remoção pelos balões: a rua chega até o
  // balão (que fica conectado a ela) e o espaço dos lotes removidos vira via, não vazio.
  return { lotes: remanescentes, corredores: corredoresGrade(baloes.length > 0 ? lotes : remanescentes, segmentos, g, p), baloes, limitacoes, candidatos };
}

/** Corredores viários (retângulos no frame) derivados dos lotes que servem. */
function corredoresGrade(lotes: LoteFrame[], segmentos: SegQuadra[], g: Dim, p: ParametrosMassa): Ret[] {
  const via = g.via;
  const out: Ret[] = [];
  if (lotes.length === 0 || via <= 0) return out;
  const cul = p.tipologia === "cul_de_sac";
  // ruas horizontais: rua m fica abaixo da linha m (faixa 0 da linha m e faixa 1 da linha m-1 a servem)
  const grupos = new Map<string, LoteFrame[]>();
  for (const l of lotes) {
    const m = l.faixa === 0 ? l.linha : l.linha + 1;
    const chave = cul ? `${m}:${l.segmento}` : `${m}`;
    const lista = grupos.get(chave);
    if (lista) lista.push(l); else grupos.set(chave, [l]);
  }
  for (const ls of Array.from(grupos.values())) {
    const yB = ls[0].faixa === 0 ? ls[0].ret[1] - via : ls[0].ret[3];
    if (cul) {
      const seg = segmentos[ls[0].segmento];
      if (seg.ladoBalao === -1) out.push([Math.min(...ls.map((l) => l.ret[0])), yB, seg.x1, yB + via]);
      else out.push([seg.x0, yB, Math.max(...ls.map((l) => l.ret[2])), yB + via]);
    } else {
      out.push([Math.min(...ls.map((l) => l.ret[0])) - via, yB, Math.max(...ls.map((l) => l.ret[2])), yB + via]);
    }
  }
  // ruas verticais
  if (cul) {
    const porTronco = new Map<number, LoteFrame[]>();
    for (const l of lotes) {
      const t = segmentos[l.segmento].tronco!;
      const lista = porTronco.get(t);
      if (lista) lista.push(l); else porTronco.set(t, [l]);
    }
    for (const [t, ls] of Array.from(porTronco.entries())) {
      out.push([t, Math.min(...ls.map((l) => l.ret[1])) - via, t + via, Math.max(...ls.map((l) => l.ret[3])) + via]);
    }
  } else {
    const porSeg = new Map<number, LoteFrame[]>();
    for (const l of lotes) {
      const lista = porSeg.get(l.segmento);
      if (lista) lista.push(l); else porSeg.set(l.segmento, [l]);
    }
    for (const [s, ls] of Array.from(porSeg.entries())) {
      const x0 = segmentos[s].x0;
      out.push([x0 - via, Math.min(...ls.map((l) => l.ret[1])) - via, x0, Math.max(...ls.map((l) => l.ret[3])) + via]);
    }
  }
  return out;
}

// ─── Geometria das vias (recorte + união) ───────────────────────────────────

type GeomArea = Polygon | MultiPolygon;

function areaGeomPlanar(g: GeomArea): number {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let a = 0;
  for (const rings of polys) {
    a += areaPlanar(rings[0]);
    for (let i = 1; i < rings.length; i++) a -= areaPlanar(rings[i]);
  }
  return a;
}

function aneisDe(g: GeomArea): Position[][] {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.map((r) => r[0]);
}

/** Recorta os corredores pela poligonal e devolve os anéis desenháveis + a área da UNIÃO (sem dupla contagem nos cruzamentos). */
function viasDaImplantacao(fr: FrameAnel, impl: ImplantacaoFrame): { aneis: Position[][]; areaM2: number } {
  const glebaTurf = turfPolygon([fr.anel]);
  const pecas: Feature<Polygon | MultiPolygon>[] = [];
  const aneis: Position[][] = [];
  for (const rect of impl.corredores) {
    if (rect[2] - rect[0] <= 0 || rect[3] - rect[1] <= 0) continue;
    if (retanguloDentro(fr.ind, rect)) {
      pecas.push(turfPolygon([retAnel(rect)]));
      aneis.push(retAnel(rect));
      continue;
    }
    const c = intersect(featureCollection([turfPolygon([retAnel(rect)]), glebaTurf]));
    if (c) { pecas.push(c as Feature<Polygon | MultiPolygon>); aneis.push(...aneisDe(c.geometry as GeomArea)); }
  }
  for (const b of impl.baloes) { pecas.push(turfPolygon([b])); aneis.push(b); }
  // traçado livre (via que acompanha a divisa): já recortado pela gleba
  for (const v of (impl as ImplantacaoFrame & { viasLivres?: Position[][] }).viasLivres ?? []) { pecas.push(turfPolygon([v])); aneis.push(v); }
  if (pecas.length === 0) return { aneis, areaM2: 0 };
  let areaM2: number;
  try {
    const u = pecas.length === 1 ? pecas[0] : union(featureCollection(pecas));
    areaM2 = u ? areaGeomPlanar(u.geometry as GeomArea) : pecas.reduce((s, f) => s + areaGeomPlanar(f.geometry as GeomArea), 0);
  } catch {
    areaM2 = pecas.reduce((s, f) => s + areaGeomPlanar(f.geometry as GeomArea), 0);
  }
  return { aneis, areaM2 };
}

// ─── Avaliação completa de um candidato ─────────────────────────────────────

interface Ctx {
  anelGeo: Position[];
  anelM: Position[];
  proj: ReturnType<typeof criarProjecao>;
  params: ParametrosMassa;
  g: Dim;
  areaGleba: number;
  naoParcelavel: number;
  areaParcelavel: number;
  restricoes: RestricoesNaoParcelaveis;
  tipologia: TipologiaMassa;
  manual: boolean;
}

interface Bruto {
  chave: string;
  angulo: number;
  fr: FrameAnel;
  impl: ImplantacaoFrame;
  classificados: { l: LoteFrame; idx: number; tipo: LoteGerado["tipo"]; uso?: LoteGerado["uso"] }[];
  vias: { aneis: Position[][]; areaM2: number };
  areaVendavel: number;
  nVendaveis: number;
  candidatos: number;
  divergenciaViaria: { informada: number; geometrica: number; maxPossivel?: number } | null;
  centroides: Set<string>;
}

function chaveCentroide(cx: number, cy: number, q: number): string {
  return `${Math.round(cx / q)},${Math.round(cy / q)}`;
}

function classificar(ctx: Ctx, impl: ImplantacaoFrame) {
  // Menores lotes primeiro (empate: os mais distantes do início da via/ordem de geração primeiro,
  // de forma determinística) viram, nesta ordem, a parcela proporcional das áreas não parceláveis,
  // a área institucional e a área verde.
  const ordem = impl.lotes.map((l, idx) => ({ l, idx })).sort((x, y) => x.l.area - y.l.area || y.idx - x.idx);
  const areaTodos = ordem.reduce((s, o) => s + o.l.area, 0);
  const reservaRestricao = ctx.areaGleba > 0 ? ctx.naoParcelavel * (areaTodos / ctx.areaGleba) : 0;
  const reservaInst = ctx.params.percentInstitucional * ctx.areaParcelavel;
  const reservaVerde = ctx.params.percentAreaVerde * ctx.areaParcelavel;
  let acR = 0, acI = 0, acV = 0;
  return ordem.map(({ l, idx }) => {
    let tipo: LoteGerado["tipo"] = "vendavel";
    let uso: LoteGerado["uso"];
    if (acR < reservaRestricao) { tipo = "nao_parcelavel"; acR += l.area; }
    else if (acI < reservaInst) { tipo = "area_publica"; uso = "institucional"; acI += l.area; }
    else if (acV < reservaVerde) { tipo = "area_publica"; uso = "verde"; acV += l.area; }
    return { l, idx, tipo, uso };
  });
}

function tolerClViaria(informada: number, passoM2: number): number {
  return Math.max(0.05 * informada, passoM2, 1);
}

function avaliarImplantacao(ctx: Ctx, chave: string, fr: FrameAnel, impl: ImplantacaoFrame, passoViarioM2: number, maxViaPossivelM2?: number): Bruto {
  const classificados = classificar(ctx, impl);
  const vias = viasDaImplantacao(fr, impl);
  const vend = classificados.filter((c) => c.tipo === "vendavel");
  const areaVendavel = vend.reduce((s, c) => s + c.l.area, 0);
  let divergenciaViaria: Bruto["divergenciaViaria"] = null;
  if (ctx.manual) {
    const informada = ctx.params.areaSistemaViarioM2 ?? 0;
    if (Math.abs(vias.areaM2 - informada) > tolerClViaria(informada, passoViarioM2)) {
      divergenciaViaria = { informada, geometrica: vias.areaM2, maxPossivel: maxViaPossivelM2 };
    }
  }
  const q = Math.max(1, Math.min(ctx.g.testada, ctx.g.profundidade) / 2);
  const centroides = new Set<string>();
  for (const c of vend) {
    const [mx, my] = rotacionar([(c.l.ret[0] + c.l.ret[2]) / 2, (c.l.ret[1] + c.l.ret[3]) / 2], fr.angulo);
    centroides.add(chaveCentroide(mx, my, q));
  }
  return { chave, angulo: fr.angulo, fr, impl, classificados, vias, areaVendavel, nVendaveis: vend.length, candidatos: impl.candidatos, divergenciaViaria, centroides };
}

function equivalentes(a: Bruto, b: Bruto): boolean {
  const dAng = diferencaAngular(a.angulo, b.angulo);
  const maxN = Math.max(a.nVendaveis, b.nVendaveis, 1);
  const maxV = Math.max(a.vias.areaM2, b.vias.areaM2, 1);
  if (dAng < 10 && Math.abs(a.nVendaveis - b.nVendaveis) <= Math.max(1, Math.floor(0.03 * maxN))
    && Math.abs(a.vias.areaM2 - b.vias.areaM2) / maxV <= 0.03) return true;
  let comum = 0;
  for (const k of Array.from(a.centroides)) if (b.centroides.has(k)) comum++;
  return comum / Math.max(a.centroides.size, b.centroides.size, 1) >= 0.9;
}

function compararPorVendavel(a: Bruto, b: Bruto): number {
  return b.areaVendavel - a.areaVendavel || a.vias.areaM2 - b.vias.areaM2 || a.angulo - b.angulo || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0);
}

function eficienciaViaria(c: Bruto): number {
  return c.vias.areaM2 > 0 ? c.areaVendavel / c.vias.areaM2 : c.areaVendavel > 0 ? Infinity : 0;
}

// ─── Montagem do cenário de saída ───────────────────────────────────────────

function montarCenario(ctx: Ctx, idx: number, b: Bruto, criterio: CriterioCenario): CenarioMassa {
  const { proj, params } = ctx;
  const voltaGeo = (anel: Position[]) => anel.map((pt) => proj.paraGeo(rotacionar(pt, b.angulo)));

  // Numeração: quadra = (linha, trecho); lotes vendáveis numerados por faixa e posição ao longo da via.
  const vendaveisFrame = b.classificados.filter((c) => c.tipo === "vendavel");
  const chaves = Array.from(new Set(vendaveisFrame.map((c) => `${c.l.linha}:${c.l.segmento}`)))
    .sort((x, y) => { const [la, sa] = x.split(":").map(Number); const [lb, sb] = y.split(":").map(Number); return la - lb || sa - sb; });
  const numeracao = new Map<LoteFrame, { quadra: string; numero: string }>();
  chaves.forEach((chave, qi) => {
    const daQuadra = vendaveisFrame.filter((c) => `${c.l.linha}:${c.l.segmento}` === chave)
      .sort((x, y) => x.l.faixa - y.l.faixa || x.l.ordem - y.l.ordem || x.idx - y.idx);
    daQuadra.forEach((c, li) => numeracao.set(c.l, { quadra: String(qi + 1), numero: String(li + 1) }));
  });

  const lotes: LoteGerado[] = b.classificados.map(({ l, tipo, uso }) => ({
    anel: voltaGeo(l.anel),
    areaM2: round2(l.area),
    tipo,
    ...(uso ? { uso } : {}),
    ...(numeracao.get(l) ?? {}),
    ...(l.testada !== undefined ? { testadaM: round2(l.testada), profundidadeMediaM: round2(l.profundidadeMedia ?? 0) } : {}),
  }));

  const vendaveis = lotes.filter((l) => l.tipo === "vendavel");
  const publicos = lotes.filter((l) => l.tipo === "area_publica");
  const areaVendavelM2 = round2(vendaveis.reduce((s, l) => s + l.areaM2, 0));
  const areaInstitucionalM2 = round2(publicos.filter((l) => l.uso === "institucional").reduce((s, l) => s + l.areaM2, 0));
  const areaVerdeM2 = round2(publicos.filter((l) => l.uso !== "institucional").reduce((s, l) => s + l.areaM2, 0));
  const areaViariaGeo = round2(b.vias.areaM2);
  const informada = ctx.manual ? params.areaSistemaViarioM2 : undefined;
  const quadroAreas = calcularQuadroAreasMassa({
    areaBrutaM2: ctx.areaGleba,
    restricoes: ctx.restricoes,
    areaVendavelM2,
    nLotesVendaveis: vendaveis.length,
    areaInstitucionalM2,
    areaVerdeM2,
    precoM2Lote: params.precoM2Lote,
    sistemaViarioM2: areaViariaGeo,
    modoSistemaViario: ctx.manual ? "manual" : "automatico",
    ...(informada !== undefined ? { sistemaViarioInformadoM2: informada } : {}),
  });

  return {
    id: `cenario-${idx + 1}`,
    anguloVia: Math.round(b.angulo * 10) / 10,
    // Parâmetros EFETIVOS = exatamente os informados (o motor não os altera).
    testadaLoteM: ctx.g.testada,
    profundidadeLoteM: ctx.g.profundidade,
    larguraViaM: ctx.g.via,
    tipologia: ctx.tipologia,
    lotes,
    vias: b.impl.baloes.map(voltaGeo),
    ruas: b.vias.aneis.map(voltaGeo),
    kpis: {
      lotesVendaveis: vendaveis.length,
      lotesPublicos: publicos.length,
      areaVendavelM2,
      areaPublicaM2: round2(areaInstitucionalM2 + areaVerdeM2),
      aproveitamento: ctx.areaGleba > 0 ? areaVendavelM2 / ctx.areaGleba : 0,
      vgv: Math.round(areaVendavelM2 * params.precoM2Lote),
    },
    quadroAreas,
    inviabilidade: motivoInviabilidade(vendaveis.length, b.candidatos, quadroAreas, ctx.g, params),
    limitacoes: b.impl.limitacoes,
    criterio,
    criterioRotulo: ROTULO_CRITERIO[criterio],
    sistemaViario: {
      modo: ctx.manual ? "manual" : "automatico",
      larguraM: ctx.g.via,
      areaGeometricaM2: areaViariaGeo,
      ...(informada !== undefined ? { areaInformadaM2: informada, diferencaM2: round2(areaViariaGeo - informada) } : {}),
    },
    versaoAlgoritmo: VERSAO_ALGORITMO_MASSA,
  };
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

// ─── Diagnóstico verificável de inviabilidade ───────────────────────────────

/** Causas verificáveis (com números) de a poligonal não comportar o parcelamento solicitado. */
export function diagnosticarInviabilidade(anelM: Position[], params: ParametrosMassa, areaParcelavelM2: number): string[] {
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const causas: string[] = [];
  const t = params.testadaLoteM, p = params.profundidadeLoteM, w = params.larguraViaM;
  const tip = params.tipologia ?? "grid";
  const area = areaPlanar(anelM);
  if (areaParcelavelM2 <= 0) {
    causas.push("Restrição ambiental/legal: as áreas não parceláveis informadas ocupam toda a gleba.");
    return causas;
  }
  if (area < t * p) {
    causas.push(`Área insuficiente: a gleba tem ${f(area)} m² e um lote de ${f(t)} × ${f(p)} m exige ${f(t * p)} m².`);
  }
  const env = menorLarguraEnvelope(anelM);
  const maiorLado = Math.max(t, p), menorLado = Math.min(t, p);
  if (env.larguraM < menorLado) {
    causas.push(`Largura insuficiente: a menor dimensão da gleba (envelope girado a ${f(env.anguloGraus)}°) é ${f(env.larguraM)} m, menor que o menor lado do lote (${f(menorLado)} m).`);
  } else if (env.larguraM < maiorLado && env.comprimentoM < maiorLado) {
    causas.push(`Geometria: nenhuma dimensão da gleba (${f(env.larguraM)} × ${f(env.comprimentoM)} m) comporta o maior lado do lote (${f(maiorLado)} m).`);
  }
  // lote isolado cabe em alguma orientação?
  const celula = Math.max(t, p) * 2;
  let cabeIsolado = false;
  const angs = new Set<number>(angulosDasArestas(anelM, 20));
  for (let a = 0; a < 180; a += 5) angs.add(a);
  outer: for (const ang of Array.from(angs).sort((x, y) => x - y)) {
    const fr = prepararFrameAnel(anelM, ang, celula);
    const passo = Math.max(1, Math.min(t, p) / 2);
    for (let y = fr.bbox[1]; y + p <= fr.bbox[3] + 1e-9; y += passo) {
      for (let x = fr.bbox[0]; x + t <= fr.bbox[2] + 1e-9; x += passo) {
        if (retanguloDentro(fr.ind, [x, y, x + t, y + p])) { cabeIsolado = true; break outer; }
      }
    }
  }
  if (!cabeIsolado) {
    causas.push(`Profundidade/testada: nenhum retângulo de ${f(t)} × ${f(p)} m cabe inteiro na poligonal em nenhuma das orientações testadas (varredura a cada 5° e pelas arestas), mesmo sem vias.`);
  } else {
    causas.push(`O lote de ${f(t)} × ${f(p)} m cabe isoladamente, mas não com a via de ${f(w)} m: ${tip === "rua_simples" ? "a via (corredor reto) com lotes de um ou dos dois lados" : "a malha (via + quadra de 2 × profundidade)"} não encontrou posição que comporte nenhum lote completo.`);
    if (tip === "rua_simples") causas.push("Acesso/geometria: a via precisa começar no limite da gleba e correr dentro dela por ao menos uma testada com o corredor inteiro dentro da poligonal.");
    else causas.push(`Via inviável: a faixa mínima "via + 2 lotes" exige ${f(w + 2 * p)} m de largura livre; a menor dimensão da gleba é ${f(env.larguraM)} m.`);
  }
  if (params.modoSistemaViario === "manual") {
    causas.push(`Área viária manual (${f(params.areaSistemaViarioM2 ?? 0)} m²) pode ser incompatível com a geometria — teste o modo automático para comparar.`);
  }
  return causas;
}

// ─── Assinatura das entradas (cache / auditoria) ────────────────────────────

function fnv1a(texto: string, semente: number): string {
  let h = semente >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Assinatura estável de poligonal + parâmetros + versão do algoritmo. Igual ⇒ resultado igual. */
export function assinaturaEntradas(anelGeo: Position[], params: ParametrosMassa): string {
  const coords = anelGeo.map((p) => `${p[0].toFixed(9)},${p[1].toFixed(9)}`).join(";");
  const chaves = Object.keys(params).sort() as (keyof ParametrosMassa)[];
  const ps = chaves.filter((k) => params[k] !== undefined).map((k) => `${k}=${String(params[k])}`).join("|");
  const base = `${VERSAO_ALGORITMO_MASSA}#${ps}#${coords}`;
  return `${fnv1a(base, 2166136261)}${fnv1a(base, 0x9e3779b1)}`;
}

// ─── Orquestrador ───────────────────────────────────────────────────────────

export interface OpcoesGeracao {
  /** Quantidade máxima de cenários (padrão 3). */
  nCenarios?: number;
  /** Legados do algoritmo genético — IGNORADOS (o motor v2 é determinístico). */
  populacao?: number;
  geracoes?: number;
  seed?: number;
  /** Progresso real (0..1) e etapa corrente — usado pelo indicador de processamento. */
  onProgress?: (fracao: number, etapa: string) => void;
}

export interface EstudoMassaGerado {
  versaoAlgoritmo: string;
  assinatura: string;
  cenarios: CenarioMassa[];
  /** Preenchido quando nenhum cenário válido existe: motivo + causas verificáveis. */
  inviabilidade: { motivo: string; causas: string[] } | null;
  avisos: string[];
  candidatosAvaliados: number;
  tipologia: TipologiaMassa;
}

function vazio(tipologia: TipologiaMassa, assinatura: string, motivo: string, causas: string[] = []): EstudoMassaGerado {
  return { versaoAlgoritmo: VERSAO_ALGORITMO_MASSA, assinatura, cenarios: [], inviabilidade: { motivo, causas }, avisos: [], candidatosAvaliados: 0, tipologia };
}

/**
 * Motor completo: devolve até 3 cenários DISTINTOS e geometricamente válidos
 * (nunca preenche cartões com resultados inventados) ou o motivo verificável de
 * não haver nenhum.
 */
export function gerarEstudoMassa(
  anelGeo: Position[],
  centro: [number, number],
  params: ParametrosMassa,
  opts: OpcoesGeracao = {}
): EstudoMassaGerado {
  const tipologia: TipologiaMassa = params.tipologia ?? "grid";
  const assinatura = assinaturaEntradas(anelGeo, params);
  const progresso = (f: number, etapa: string) => opts.onProgress?.(f, etapa);
  const nCen = Math.max(1, Math.min(3, opts.nCenarios ?? 3));

  const erroParams = validarParametrosMassa({ ...params, tipologia });
  if (erroParams) return vazio(tipologia, assinatura, erroParams);
  const erroPoligonal = validarPoligonal(anelGeo);
  if (erroPoligonal) return vazio(tipologia, assinatura, erroPoligonal);

  progresso(0.02, "Projetando a poligonal");
  const proj = criarProjecao(centro);
  const anelM = anelGeo.map((p) => proj.paraMetros(p));
  anelM[anelM.length - 1] = anelM[0];
  const areaGleba = areaPlanar(anelM);
  const restricoes = restricoesDosParametros(params);
  const naoParcelavel = Math.min(totalRestricoes(restricoes), areaGleba);
  const areaParcelavel = Math.max(0, areaGleba - naoParcelavel);
  const manual = params.modoSistemaViario === "manual";
  const erroViario = validarSistemaViarioManual(params, areaParcelavel);
  if (erroViario) return vazio(tipologia, assinatura, erroViario);

  const g: Dim = { testada: params.testadaLoteM, profundidade: params.profundidadeLoteM, via: params.larguraViaM };
  const ctx: Ctx = { anelGeo, anelM, proj, params: { ...params, tipologia }, g, areaGleba, naoParcelavel, areaParcelavel, restricoes, tipologia, manual };

  if (areaParcelavel <= 0) {
    return vazio(tipologia, assinatura, "Inviável: as áreas não parceláveis ocupam toda a gleba — não há área parcelável.", diagnosticarInviabilidade(anelM, ctx.params, areaParcelavel));
  }

  let brutos: Bruto[] = [];
  let avaliados = 0;
  const avisos: string[] = [];
  // ordem canônica dos lados (a assinatura e os cartões não dependem da ordem dos cliques)
  const ladosVia = tipologia === "rua_simples" && params.tracadoVia === "divisa" && (params.ladosVia?.length ?? 0) > 0
    ? LADOS_GLEBA.filter((l) => params.ladosVia!.includes(l)) : null;
  const inverterVia = !ladosVia && tipologia === "rua_simples" && params.tracadoVia === "divisa" && params.inverterLadoVia === true;
  const arestasPorImplantacao = new Map<string, number[]>();
  const limiteCandidatosVia = 12;

  if (tipologia === "vias_publicas") {
    progresso(0.1, "Desmembrando os lotes com frente para as vias públicas");
    const impls = buscarViasPublicas(anelM, { testada: g.testada, profundidade: g.profundidade, loteMinimoM2: params.loteMinimoM2 }, 4,
      (f) => progresso(0.1 + 0.8 * f, "Desmembrando os lotes com frente para as vias públicas"));
    avaliados = impls.length;
    const fr0 = prepararFrameAnel(anelM, 0, Math.max(g.testada, g.profundidade) * 2);
    impls.forEach((impl) => brutos.push(avaliarImplantacao(ctx, impl.chave, fr0, impl, 1)));
    if (impls.length === 0) {
      return { ...vazio(tipologia, assinatura, "Nenhum lote viável com frente para as vias públicas existentes.",
        ["Confira a testada, a profundidade e a área mínima do lote frente ao tamanho das divisas da gleba."]), candidatosAvaliados: 0 };
    }
  } else if (ladosVia) {
    progresso(0.1, "Traçando a via nos lados escolhidos");
    const impls = buscarPorLados(anelM, ladosVia, { testada: g.testada, profundidade: g.profundidade, via: g.via, loteMinimoM2: params.loteMinimoM2 }, 6,
      (f) => progresso(0.1 + 0.5 * f, "Implantando os lotes com frente exata e fundo variável"));
    avaliados = impls.length;
    const fr0 = prepararFrameAnel(anelM, 0, Math.max(g.testada, g.profundidade, g.via) * 2);
    impls.forEach((impl, i) => {
      brutos.push(avaliarImplantacao(ctx, impl.chave, fr0, impl, Math.max(g.via * g.testada, 1)));
      progresso(0.6 + 0.3 * ((i + 1) / impls.length), "Avaliando implantações candidatas");
    });
    if (impls.length === 0) {
      return { ...vazio(tipologia, assinatura, "Nenhum lote viável com a via somente nos lados escolhidos.",
        ["Confira a largura da via, a testada e a área mínima, ou marque outro lado para a rua."]), candidatosAvaliados: 0 };
    }
  } else if (tipologia === "rua_simples" && params.tracadoVia === "divisa") {
    progresso(0.1, "Traçando a via pela divisa");
    const lim = manual ? (params.areaSistemaViarioM2 ?? 0) / Math.max(g.via, 1e-9) : undefined;
    const impls = buscarViaDivisa(anelM, { testada: g.testada, profundidade: g.profundidade, via: g.via, loteMinimoM2: params.loteMinimoM2, limiteComprimentoM: lim }, inverterVia ? Infinity : limiteCandidatosVia,
      (f) => progresso(0.1 + 0.5 * f, "Traçando a via pela divisa e implantando os lotes"));
    avaliados = impls.length;
    const fr0 = prepararFrameAnel(anelM, 0, Math.max(g.testada, g.profundidade, g.via) * 2);
    impls.forEach((impl, i) => {
      arestasPorImplantacao.set(impl.chave, impl.arestasDivisa);
      brutos.push(avaliarImplantacao(ctx, impl.chave, fr0, impl, Math.max(g.via * g.testada, 1)));
      progresso(0.6 + 0.3 * ((i + 1) / impls.length), "Avaliando implantações candidatas");
    });
  } else if (tipologia === "rua_simples") {
    const passoPeca = g.via * g.testada;
    const limitePecas = manual ? Math.max(1, Math.round((params.areaSistemaViarioM2 ?? 0) / Math.max(passoPeca, 1e-9))) : undefined;
    const formatoRua = params.formatoLote === "divisa" ? { formato: "divisa" as const, loteMinimoM2: params.loteMinimoM2 } : {};
    const opcoesRua = manual ? { limitePecas, aparar: false, ...formatoRua } : formatoRua;
    progresso(0.1, "Varrendo orientações e posições da via");
    const cands: CandidatoRua[] = buscarRuaSimples(anelM, g, opcoesRua, 24);
    avaliados = cands.length;
    progresso(0.6, "Avaliando implantações candidatas");
    cands.forEach((cand, i) => {
      const { fr, impl } = implantacaoDoCandidatoRua(anelM, cand, g, opcoesRua);
      const maxVia = impl.pecasPossiveis * passoPeca;
      brutos.push(avaliarImplantacao(ctx, `${cand.angulo}|${cand.c}|${cand.fase}|${cand.ancora}|${cand.intervalo[0].toFixed(3)}`, fr, impl, passoPeca / 2, maxVia));
      progresso(0.6 + 0.3 * ((i + 1) / cands.length), "Avaliando implantações candidatas");
    });
  } else {
    // AJUSTE DA MALHA (modo manual da área viária): além do comprimento máximo informado, testa
    // quadras mais curtas (mais ruas transversais → mais via) e, se ainda sobrar via, suprime ruas
    // horizontais de menor aproveitamento (menos via). Nunca passa do comprimento máximo informado.
    const nMax = Math.max(1, Math.floor(params.comprimentoMaxQuadraM / g.testada + 1e-9));
    const variantesN = manual
      ? Array.from(new Set([nMax, Math.round(nMax * 0.75), Math.round(nMax / 2), Math.round(nMax / 3), Math.round(nMax / 4), 2]))
        .filter((n) => n >= 1 && n <= nMax).sort((a, b) => b - a)
      : [nMax];
    const alvo = params.areaSistemaViarioM2 ?? 0;
    const tolV = tolerClViaria(alvo, Math.max(g.via * g.testada, 1));
    variantesN.forEach((nLotesQuadra, vi) => {
      const compVar = nLotesQuadra === nMax ? params.comprimentoMaxQuadraM : nLotesQuadra * g.testada + 1e-6;
      const pz: ParametrosMassa = { ...ctx.params, comprimentoMaxQuadraM: compVar };
      const base = vi / variantesN.length, faixaP = 1 / variantesN.length;
      const prog = (f: number, etapa: string) => progresso(base + faixaP * f * 0.9, etapa);
      const celula = Math.max(g.testada, g.profundidade, g.via, compVar / 4) * 2;
      const frames = new Map<number, FrameAnel>();
      const frameDe = (ang: number) => { let f = frames.get(ang); if (!f) { f = prepararFrameAnel(anelM, ang, celula); frames.set(ang, f); } return f; };
      const { px, py } = passosMalha(g, pz);
      interface Av { ang: number; ox: number; oy: number; n: number }
      const avs: Av[] = [];
      const vistos = new Set<string>();
      const avaliar = (ang: number, ox: number, oy: number) => {
        const chave = `${ang}|${ox.toFixed(4)}|${oy.toFixed(4)}`;
        if (vistos.has(chave)) return;
        vistos.add(chave);
        const impl = gerarImplantacaoGrade(frameDe(ang), g, pz, ox, oy, false);
        avaliados++;
        if (impl.lotes.length > 0) avs.push({ ang, ox, oy, n: impl.lotes.length });
      };
      const set = new Set<number>(angulosDasArestas(anelM, 8));
      for (let a = 0; a < 180; a += 10) set.add(a);
      const grossos = Array.from(set).sort((a, b) => a - b);
      grossos.forEach((a, i) => { avaliar(a, 0, 0); prog(0.08 + 0.2 * ((i + 1) / grossos.length), "Varredura de orientações da malha"); });
      const ordenar = (a: Av, b: Av) => b.n - a.n || a.ang - b.ang || a.ox - b.ox || a.oy - b.oy;
      const melhores: number[] = [];
      for (const a of [...avs].sort(ordenar)) { if (!melhores.includes(a.ang)) melhores.push(a.ang); if (melhores.length >= (manual ? 3 : 6)) break; }
      const fases = [0, 1 / 3, 2 / 3];
      melhores.forEach((baseAng, bi) => {
        for (const da of [-5, -2.5, -1, 0, 1, 2.5, 5]) {
          const ang = Math.round((((baseAng + da) % 180) + 180) % 180 * 1000) / 1000;
          for (const fx of fases) for (const fy of fases) avaliar(ang, fx * px, fy * py);
        }
        prog(0.28 + 0.3 * ((bi + 1) / melhores.length), "Refinando posição da malha");
      });
      // no máximo 2 variações por orientação, 24 candidatos (8 por variante no ajuste) para avaliação completa
      const porAngulo = new Map<number, number>();
      const finalistas: Av[] = [];
      for (const a of [...avs].sort(ordenar)) {
        const n = porAngulo.get(a.ang) ?? 0;
        if (n >= 2) continue;
        porAngulo.set(a.ang, n + 1);
        finalistas.push(a);
        if (finalistas.length >= (manual ? 8 : 24)) break;
      }
      finalistas.forEach((a, i) => {
        const fr = frameDe(a.ang);
        const chaveBase = `${a.ang}|${a.ox.toFixed(4)}|${a.oy.toFixed(4)}|q${nLotesQuadra}`;
        let impl = gerarImplantacaoGrade(fr, g, pz, a.ox, a.oy, true);
        let bruto = avaliarImplantacao(ctx, chaveBase, fr, impl, Math.max(g.via * g.testada, 1));
        const ajustes: string[] = [];
        if (compVar !== params.comprimentoMaxQuadraM) ajustes.push(`quadras de até ${(nLotesQuadra * g.testada).toLocaleString("pt-BR")} m (máximo informado: ${params.comprimentoMaxQuadraM.toLocaleString("pt-BR")} m)`);
        if (manual && bruto.vias.areaM2 > alvo + tolV) {
          // suprime ruas horizontais de menor aproveitamento até a via desenhada caber no valor informado
          const excluidas = new Set<string>();
          for (let iter = 0; iter < 60 && bruto.vias.areaM2 > alvo + tolV && bruto.nVendaveis > 0; iter++) {
            const cont = new Map<string, number>();
            for (const l of impl.lotes) { const k = chaveRuaFrente(pz, l.linha, l.faixa, l.segmento); cont.set(k, (cont.get(k) ?? 0) + 1); }
            const pior = Array.from(cont.entries()).sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : 1))[0];
            if (!pior) break;
            excluidas.add(pior[0]);
            const implNovo = gerarImplantacaoGrade(fr, g, pz, a.ox, a.oy, true, excluidas);
            const brutoNovo = avaliarImplantacao(ctx, `${chaveBase}|x${excluidas.size}`, fr, implNovo, Math.max(g.via * g.testada, 1));
            // nunca aceita um passo que elimine todos os lotes: o valor informado fica como divergência técnica
            if (brutoNovo.nVendaveis === 0) { excluidas.delete(pior[0]); break; }
            impl = implNovo;
            bruto = brutoNovo;
          }
          if (excluidas.size > 0) ajustes.push(`${excluidas.size} rua(s) suprimida(s) para a via desenhada se aproximar da área informada`);
        }
        if (ajustes.length > 0) bruto.impl = { ...bruto.impl, limitacoes: [`Malha ajustada automaticamente: ${ajustes.join("; ")}.`, ...bruto.impl.limitacoes] };
        brutos.push(bruto);
        prog(0.6 + 0.4 * ((i + 1) / finalistas.length), "Desenhando vias e balões");
      });
    });
  }

  progresso(0.92, "Selecionando cenários");
  const comLotes = brutos.filter((b) => b.nVendaveis > 0);
  let validos = comLotes.filter((b) => !b.divergenciaViaria);
  if (inverterVia) {
    const automatico = brutos.slice(0, limiteCandidatosVia)
      .filter((b) => b.nVendaveis > 0 && !b.divergenciaViaria).sort(compararPorVendavel)[0];
    if (automatico) {
      const referencia = arestasPorImplantacao.get(automatico.chave)!;
      validos = validos.filter((b) => divisasOpostas(anelM, referencia, arestasPorImplantacao.get(b.chave)!));
    }
    if (!automatico || validos.length === 0) {
      return {
        ...vazio(tipologia, assinatura, "Nenhum cenário válido com a via na divisa oposta para esses parâmetros.",
          ["Confira a largura da via, a testada, a área mínima dos lotes e, no modo manual, a área viária informada."]),
        candidatosAvaliados: avaliados,
      };
    }
  }
  if (validos.length === 0) {
    const sorted = [...comLotes].sort(compararPorVendavel);
    if (manual && sorted.length > 0) {
      const informada = params.areaSistemaViarioM2 ?? 0;
      const geos = sorted.map((b) => b.vias.areaM2);
      const minG = Math.min(...geos), maxG = Math.max(...geos);
      const maxPossivel = Math.max(...sorted.map((b) => b.divergenciaViaria?.maxPossivel ?? 0));
      const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      return {
        ...vazio(tipologia, assinatura,
          `Divergência técnica: a área viária informada (${f(informada)} m²) é incompatível com a geometria desenhada — as implantações viáveis têm entre ${f(minG)} e ${f(maxG)} m² de via com largura de ${f(g.via)} m.`,
          [
            tipologia === "rua_simples" && maxPossivel > 0 && informada > maxPossivel
              ? `A poligonal comporta no máximo ${f(maxPossivel)} m² de via (largura ${f(g.via)} m) neste traçado; a área informada exige mais.`
              : `Tolerância aceita: ±${f(tolerClViaria(informada, Math.max(g.via * g.testada, 1)))} m². Ajuste a área viária informada, a largura da via ou use o modo automático.`,
            "Nenhuma implantação fictícia foi produzida para ajustar o valor.",
          ]),
        candidatosAvaliados: avaliados,
      };
    }
    const causas = diagnosticarInviabilidade(anelM, ctx.params, areaParcelavel);
    const motivo = comLotes.length === 0
      ? motivoInviabilidade(0, 0, { areaParcelavelM2: areaParcelavel }, g, params)!
      : "Inviável: todos os lotes gerados foram consumidos pelas doações (institucional e área verde) e pelas áreas não parceláveis.";
    return { ...vazio(tipologia, assinatura, motivo, causas), candidatosAvaliados: avaliados };
  }

  // Seleção por critérios transparentes (ver ROTULO_CRITERIO).
  const escolhidos: { b: Bruto; criterio: CriterioCenario }[] = [];
  const porVendavel = [...validos].sort(compararPorVendavel);
  const melhor = porVendavel[0];
  escolhidos.push({ b: melhor, criterio: "maior_area_vendavel" });
  const distintoDosEscolhidos = (b: Bruto) => escolhidos.every((e) => !equivalentes(e.b, b));
  if (nCen >= 2) {
    // Eficiência viária: vendável por m² de via — entre alternativas que preservam ao menos 75% da melhor área vendável.
    const efic = porVendavel
      .filter((b) => b !== melhor && b.areaVendavel >= 0.75 * melhor.areaVendavel && distintoDosEscolhidos(b))
      .sort((a, b) => eficienciaViaria(b) - eficienciaViaria(a) || compararPorVendavel(a, b));
    if (efic[0]) escolhidos.push({ b: efic[0], criterio: "melhor_eficiencia_viaria" });
  }
  if (nCen >= 3) {
    const alt = porVendavel.find((b) => !escolhidos.some((e) => e.b === b) && distintoDosEscolhidos(b));
    if (alt) escolhidos.push({ b: alt, criterio: "alternativa_distinta" });
  }
  if (nCen >= 2 && escolhidos.length === 1) {
    // sem alternativa de eficiência: tenta a distinta como 2º cenário
    const alt = porVendavel.find((b) => b !== melhor && distintoDosEscolhidos(b));
    if (alt) escolhidos.push({ b: alt, criterio: "alternativa_distinta" });
  }

  const cenarios = escolhidos.map((e, i) => ({
    ...montarCenario(ctx, i, e.b, e.criterio),
    ...(inverterVia ? { viaLadoOposto: true } : {}),
    ...(ladosVia ? { ladosVia } : {}),
  }));
  if (cenarios.length < 3) avisos.push(`Foram encontradas ${cenarios.length} alternativa(s) geometricamente válida(s) e distinta(s) — nenhum cartão foi preenchido artificialmente.`);
  progresso(1, "Concluído");
  return { versaoAlgoritmo: VERSAO_ALGORITMO_MASSA, assinatura, cenarios, inviabilidade: null, avisos, candidatosAvaliados: avaliados, tipologia };
}

/**
 * Compatibilidade: devolve os cenários válidos do `gerarEstudoMassa`. Quando não há
 * nenhum, devolve UM cenário vazio carregando o motivo em `inviabilidade` (sem lotes) —
 * a interface nova usa `gerarEstudoMassa` e mostra o motivo, sem cartões.
 */
export function gerarCenariosMassa(
  anelGeo: Position[],
  centro: [number, number],
  params: ParametrosMassa,
  opts: OpcoesGeracao = {}
): CenarioMassa[] {
  const r = gerarEstudoMassa(anelGeo, centro, params, opts);
  if (r.cenarios.length > 0) return r.cenarios;
  const proj = criarProjecao(centro);
  const areaGleba = (() => { try { return areaPlanar(anelGeo.map((p) => proj.paraMetros(p))); } catch { return 0; } })();
  const quadro = calcularQuadroAreasMassa({
    areaBrutaM2: areaGleba, restricoes: restricoesDosParametros(params), areaVendavelM2: 0, nLotesVendaveis: 0,
    areaInstitucionalM2: 0, areaVerdeM2: 0, precoM2Lote: params.precoM2Lote,
  });
  return [{
    id: "cenario-1", anguloVia: 0, testadaLoteM: params.testadaLoteM, profundidadeLoteM: params.profundidadeLoteM,
    larguraViaM: params.larguraViaM, tipologia: params.tipologia ?? "grid", lotes: [], vias: [], ruas: [],
    kpis: { lotesVendaveis: 0, lotesPublicos: 0, areaVendavelM2: 0, areaPublicaM2: 0, aproveitamento: 0, vgv: 0 },
    quadroAreas: quadro, inviabilidade: r.inviabilidade?.motivo ?? "Inviável: nenhum lote coube na poligonal.",
    limitacoes: r.inviabilidade?.causas ?? [], versaoAlgoritmo: VERSAO_ALGORITMO_MASSA,
  }];
}

// reexporta utilitários usados por testes/UI
export { gerarRuaSimplesFrame };
