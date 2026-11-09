// Primitivas geométricas planares (metros) do motor de parcelamento.
//
// Tudo aqui é PURO e DETERMINÍSTICO (sem Math.random, sem Date, sem I/O).
// O teste "retângulo cabe na poligonal" é EXATO — o mesmo teste é usado na busca
// e no desenho final, de modo que a contagem de lotes avaliada é exatamente a
// contagem desenhada (antes a busca usava amostragem de 5 pontos e o desenho
// usava recorte, o que gerava lotes irregulares e números divergentes).

import type { Position } from "geojson";

/** Retângulo [x0, y0, x1, y1] no frame (x0 < x1, y0 < y1). */
export type Ret = [number, number, number, number];

/** Tolerância geométrica (m) — 1 µm: ruído de ponto flutuante, não folga de projeto. */
export const EPS_GEO = 1e-6;
/** Tolerância numérica documentada para comparar resultados entre execuções (m²). */
export const TOLERANCIA_AREA_M2 = 0.01;

export interface LoteFrame {
  anel: Position[];
  area: number;
  /** Retângulo exato do lote no frame. */
  ret: Ret;
  linha: number;
  faixa: 0 | 1;
  segmento: number;
  /** Ordem de numeração dentro da quadra (posição ao longo da via). */
  ordem: number;
  /** Só no formato "acompanha a divisa": testada real (múltiplo da informada) e profundidade média (área ÷ testada). */
  testada?: number;
  profundidadeMedia?: number;
}

export interface ImplantacaoFrame {
  lotes: LoteFrame[];
  /** Corredores viários (retângulos no frame, ainda sem recorte pela poligonal). */
  corredores: Ret[];
  /** Balões de retorno (anéis no frame, já recortados). */
  baloes: Position[][];
  limitacoes: string[];
  /** Retângulos candidatos que couberam na poligonal. */
  candidatos: number;
}

export function retAnel(r: Ret): Position[] {
  return [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]], [r[0], r[1]]];
}

/** Área planar (shoelace) de um anel em metros. */
export function areaPlanar(anel: Position[]): number {
  let s = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    s += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  }
  return Math.abs(s / 2);
}

export function rotacionar(p: Position, anguloGraus: number): [number, number] {
  const a = (anguloGraus * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos];
}

// ─── Índice espacial de arestas ──────────────────────────────────────────────

export interface IndiceAnel {
  /** Anel fechado (último = primeiro). */
  anel: Position[];
  bbox: [number, number, number, number];
  cel: number;
  nx: number;
  ny: number;
  celulas: Map<number, number[]>;
  visto: Int32Array;
  carimbo: number;
}

export function criarIndiceAnel(anel: Position[], tamanhoCelula: number): IndiceAnel {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of anel) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const cel = Math.max(1, tamanhoCelula);
  const nx = Math.max(1, Math.ceil((maxX - minX) / cel));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cel));
  const celulas = new Map<number, number[]>();
  const nArestas = anel.length - 1;
  for (let i = 0; i < nArestas; i++) {
    const [ax, ay] = anel[i], [bx, by] = anel[i + 1];
    const cl = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
    const c0 = cl(Math.floor((Math.min(ax, bx) - minX) / cel), nx);
    const c1 = cl(Math.floor((Math.max(ax, bx) - minX) / cel), nx);
    const r0 = cl(Math.floor((Math.min(ay, by) - minY) / cel), ny);
    const r1 = cl(Math.floor((Math.max(ay, by) - minY) / cel), ny);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const k = r * nx + c;
        const lista = celulas.get(k);
        if (lista) lista.push(i); else celulas.set(k, [i]);
      }
    }
  }
  return { anel, bbox: [minX, minY, maxX, maxY], cel, nx, ny, celulas, visto: new Int32Array(nArestas), carimbo: 0 };
}

/** Ponto dentro do anel (ray casting; ponto sobre a borda conta como dentro). */
export function pontoDentro(anel: Position[], px: number, py: number): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 2; i < anel.length - 1; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    // sobre a aresta?
    const cruz = (px - xi) * (yj - yi) - (py - yi) * (xj - xi);
    if (Math.abs(cruz) < 1e-9 && px >= Math.min(xi, xj) - EPS_GEO && px <= Math.max(xi, xj) + EPS_GEO
      && py >= Math.min(yi, yj) - EPS_GEO && py <= Math.max(yi, yj) + EPS_GEO) return true;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** O segmento A→B atravessa o INTERIOR aberto do retângulo? (Liang–Barsky, retângulo encolhido de EPS_GEO.) */
function segmentoCruzaInterior(ax: number, ay: number, bx: number, by: number, xmin: number, ymin: number, xmax: number, ymax: number): boolean {
  if (xmin >= xmax || ymin >= ymax) return false;
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - xmin, xmax - ax, ay - ymin, ymax - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return t0 <= t1;
}

/**
 * O retângulo está TOTALMENTE dentro da poligonal (côncava ou não)?
 * Dentro ⇔ nenhuma aresta atravessa o interior do retângulo E o centro está dentro.
 * (Com a poligonal simples e sem furos, se nenhuma aresta cruza o interior, o
 * interior inteiro do retângulo está de um só lado da fronteira.)
 */
export function retanguloDentro(ind: IndiceAnel, r: Ret): boolean {
  const [x0, y0, x1, y1] = r;
  const [bx0, by0, bx1, by1] = ind.bbox;
  if (x0 < bx0 - EPS_GEO || y0 < by0 - EPS_GEO || x1 > bx1 + EPS_GEO || y1 > by1 + EPS_GEO) return false;
  const xmin = x0 + EPS_GEO, ymin = y0 + EPS_GEO, xmax = x1 - EPS_GEO, ymax = y1 - EPS_GEO;
  const c0 = Math.min(ind.nx - 1, Math.max(0, Math.floor((x0 - bx0) / ind.cel)));
  const c1 = Math.min(ind.nx - 1, Math.max(0, Math.floor((x1 - bx0) / ind.cel)));
  const r0 = Math.min(ind.ny - 1, Math.max(0, Math.floor((y0 - by0) / ind.cel)));
  const r1 = Math.min(ind.ny - 1, Math.max(0, Math.floor((y1 - by0) / ind.cel)));
  const carimbo = ++ind.carimbo;
  for (let rr = r0; rr <= r1; rr++) {
    for (let cc = c0; cc <= c1; cc++) {
      const lista = ind.celulas.get(rr * ind.nx + cc);
      if (!lista) continue;
      for (const i of lista) {
        if (ind.visto[i] === carimbo) continue;
        ind.visto[i] = carimbo;
        const [ax, ay] = ind.anel[i], [bx, by] = ind.anel[i + 1];
        if (segmentoCruzaInterior(ax, ay, bx, by, xmin, ymin, xmax, ymax)) return false;
      }
    }
  }
  return pontoDentroIndice(ind, (x0 + x1) / 2, (y0 + y1) / 2);
}

/**
 * Ponto dentro usando o índice: o raio horizontal para a direita só cruza arestas
 * presentes nas células da mesma linha, da coluna do ponto em diante. Mesmo resultado
 * de `pontoDentro`, custo proporcional às arestas daquela faixa.
 */
export function pontoDentroIndice(ind: IndiceAnel, px: number, py: number): boolean {
  const [bx0, by0, bx1, by1] = ind.bbox;
  if (px < bx0 - EPS_GEO || px > bx1 + EPS_GEO || py < by0 - EPS_GEO || py > by1 + EPS_GEO) return false;
  const r = Math.min(ind.ny - 1, Math.max(0, Math.floor((py - by0) / ind.cel)));
  const c0 = Math.min(ind.nx - 1, Math.max(0, Math.floor((px - bx0) / ind.cel)));
  const carimbo = ++ind.carimbo;
  let dentro = false;
  for (let c = c0; c < ind.nx; c++) {
    const lista = ind.celulas.get(r * ind.nx + c);
    if (!lista) continue;
    for (const i of lista) {
      if (ind.visto[i] === carimbo) continue;
      ind.visto[i] = carimbo;
      const [xi, yi] = ind.anel[i], [xj, yj] = ind.anel[i + 1];
      const cruz = (px - xi) * (yj - yi) - (py - yi) * (xj - xi);
      if (Math.abs(cruz) < 1e-9 && px >= Math.min(xi, xj) - EPS_GEO && px <= Math.max(xi, xj) + EPS_GEO
        && py >= Math.min(yi, yj) - EPS_GEO && py <= Math.max(yi, yj) + EPS_GEO) return true;
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

// ─── Validação da poligonal ──────────────────────────────────────────────────

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentosSeCruzam(a: Position, b: Position, c: Position, d: Position): boolean {
  const o1 = orient(a[0], a[1], b[0], b[1], c[0], c[1]);
  const o2 = orient(a[0], a[1], b[0], b[1], d[0], d[1]);
  const o3 = orient(c[0], c[1], d[0], d[1], a[0], a[1]);
  const o4 = orient(c[0], c[1], d[0], d[1], b[0], b[1]);
  return ((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0)) && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

/**
 * Valida a poligonal da gleba (anel [x,y] qualquer sistema planar ou lng/lat).
 * Retorna mensagem técnica ou null quando válida.
 */
export function validarPoligonal(anel: Position[] | null | undefined): string | null {
  if (!anel || anel.length < 4) return "Poligonal inválida: são necessários ao menos 3 vértices distintos (anel fechado).";
  for (const p of anel) {
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      return "Poligonal inválida: há coordenadas ausentes ou não numéricas.";
    }
  }
  const [f, l] = [anel[0], anel[anel.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) return "Poligonal inválida: o anel não está fechado (primeiro e último vértice diferem).";
  const n = anel.length - 1;
  if (n <= 2000) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // arestas adjacentes pelo fechamento
        if (segmentosSeCruzam(anel[i], anel[i + 1], anel[j], anel[j + 1])) {
          return `Poligonal inválida: as arestas ${i + 1} e ${j + 1} se cruzam (auto-interseção). Corrija o traçado no KML.`;
        }
      }
    }
  }
  if (areaPlanar(anel) <= 0) return "Poligonal inválida: área nula (vértices colineares ou repetidos).";
  return null;
}

/** Azimutes (graus, 0..180) das arestas, mais longas primeiro, sem duplicatas (0,5°). Determinístico. */
export function angulosDasArestas(anel: Position[], max = 12): number[] {
  const itens: { ang: number; len: number }[] = [];
  for (let i = 0; i < anel.length - 1; i++) {
    const dx = anel[i + 1][0] - anel[i][0], dy = anel[i + 1][1] - anel[i][1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    ang = ((ang % 180) + 180) % 180;
    itens.push({ ang: Math.round(ang * 2) / 2, len });
  }
  itens.sort((a, b) => b.len - a.len || a.ang - b.ang);
  const out: number[] = [];
  for (const it of itens) {
    if (!out.includes(it.ang)) out.push(it.ang);
    if (out.length >= max) break;
  }
  return out;
}

/** Diferença angular mínima entre duas orientações de eixo (mod 180°). */
export function diferencaAngular(a: number, b: number): number {
  const d = Math.abs(((a - b) % 180 + 180) % 180);
  return Math.min(d, 180 - d);
}

/** Menor largura do envelope retangular girado da poligonal (m) e o ângulo. Varre as orientações das arestas e a cada 5°. */
export function menorLarguraEnvelope(anel: Position[]): { larguraM: number; anguloGraus: number; comprimentoM: number } {
  const angulos = [...angulosDasArestas(anel, 40)];
  for (let a = 0; a < 180; a += 5) angulos.push(a);
  let melhor = { larguraM: Infinity, anguloGraus: 0, comprimentoM: 0 };
  for (const a of angulos) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of anel) {
      const [x, y] = rotacionar(p, -a);
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    const w = Math.min(maxX - minX, maxY - minY), h = Math.max(maxX - minX, maxY - minY);
    if (w < melhor.larguraM - 1e-9) melhor = { larguraM: w, anguloGraus: a, comprimentoM: h };
  }
  return melhor;
}

// ─── Frame rotacionado ───────────────────────────────────────────────────────

export interface FrameAnel {
  angulo: number;
  /** Anel da gleba no frame rotacionado (metros), fechado. */
  anel: Position[];
  bbox: [number, number, number, number];
  ind: IndiceAnel;
}

/** Gira o anel (metros) de −ângulo: a malha do frame fica alinhada aos eixos X/Y. */
export function prepararFrameAnel(anelMetros: Position[], angulo: number, tamanhoCelula: number): FrameAnel {
  const anel = anelMetros.map((p) => rotacionar(p, -angulo));
  anel[anel.length - 1] = anel[0]; // fechamento exato
  const ind = criarIndiceAnel(anel, tamanhoCelula);
  return { angulo, anel, bbox: ind.bbox, ind };
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}


/** Sutherland–Hodgman: recorta o anel (côncavo ou não) pelo retângulo. Área do resultado = área da interseção. */
export function recortarPorRetangulo(anel: Position[], r: Ret): Position[] {
  let pts: Position[] = anel.slice(0, -1);
  const lados: [(p: Position) => boolean, (a: Position, b: Position) => Position][] = [
    [(p) => p[0] >= r[0], (a, b) => { const t = (r[0] - a[0]) / (b[0] - a[0]); return [r[0], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= r[2], (a, b) => { const t = (r[2] - a[0]) / (b[0] - a[0]); return [r[2], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= r[1], (a, b) => { const t = (r[1] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r[1]]; }],
    [(p) => p[1] <= r[3], (a, b) => { const t = (r[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), r[3]]; }],
  ];
  for (const [dentro, cortar] of lados) {
    if (pts.length === 0) break;
    const saida: Position[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const da = dentro(a), db = dentro(b);
      if (da) saida.push(a);
      if (da !== db) saida.push(cortar(a, b));
    }
    pts = saida;
  }
  if (pts.length < 3) return [];
  return [...pts, pts[0]];
}

/** Distância, a partir de (x, y0) no sentido `sentido` (+1 = y crescente), até a primeira divisa da poligonal. */
export function distanciaAteDivisa(anel: Position[], x: number, y0: number, sentido: 1 | -1): number {
  let melhor = Infinity;
  for (let i = 0; i < anel.length - 1; i++) {
    const [ax, ay] = anel[i], [bx, by] = anel[i + 1];
    if ((ax <= x) === (bx <= x)) continue;
    const y = ay + ((x - ax) * (by - ay)) / (bx - ax);
    const d = (y - y0) * sentido;
    if (d > EPS_GEO && d < melhor) melhor = d;
  }
  return melhor;
}
