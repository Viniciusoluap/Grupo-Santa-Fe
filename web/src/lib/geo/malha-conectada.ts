// Malha viária CONECTADA, recorte dos lotes pela divisa e destinação de TODAS as sobras
// (EPIC-023, etapa F — correções 8 e 10 do dono, 15/11/2026).
//
// Regras (valem para Grade, Cul-de-sac e Rua Simples; a destinação vale para todas as tipologias):
//  R1. A malha é traçada primeiro (faixas de via de divisa a divisa); os trechos recortados pela gleba
//      formam um grafo. Só o componente conexo que TOCA a divisa (acesso) é mantido — trecho isolado
//      ("loteamento morto") é descartado. Sem componente com acesso, o cenário é descartado.
//  R2. Lote vendável só é aceito com testada medida sobre uma via da malha mantida.
//  R3. Lotes da borda são RECORTADOS pela divisa (e pelos furos): aceitos com área ≥ mínima e
//      testada ≥ mínima. Tudo o que sobra (gleba − vias − lotes) recebe destino.
//  R4. Áreas verde/institucional (e a reserva das restrições informadas em m²) usam primeiro as sobras
//      e peças irregulares; só faltando área convertem lotes inteiros, contíguos entre si.
//
// Tudo é feito no FRAME rotacionado da malha (metros), puro e determinístico.

import { difference, featureCollection, intersect, polygon as turfPolygon, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import {
  areaPlanar, pontoDentro, pontoDentroIndice, recortarPorRetangulo, retAnel, retanguloDentro, rotacionar,
  type FrameAnel, type LoteFrame, type Ret,
} from "./geometria-parcelamento";

export type Geo = Feature<Polygon | MultiPolygon>;
/** Polígono como lista de anéis (o primeiro é o contorno; os demais, furos). */
export type Poli = Position[][];

/** Afastamento (m) usado para amostrar "o que há do outro lado" de uma aresta. */
const DELTA = 0.05;
/** Passo (m) das amostras ao longo das arestas na medição de testada. */
const PASSO_AMOSTRA = 0.5;
/** Peças menores que isto (m²) são ruído numérico do recorte — entram só na tolerância do fecho. */
export const AREA_RUIDO_M2 = 0.05;

function seguro<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }

export const poligonosDe = (g: Polygon | MultiPolygon): Poli[] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

export function areaPoli(p: Poli): number {
  let a = areaPlanar(p[0]);
  for (let i = 1; i < p.length; i++) a -= areaPlanar(p[i]);
  return Math.max(0, a);
}

export function bboxDe(aneis: Position[][]): Ret {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const anel of aneis) for (const [x, y] of anel) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
}

const sobrepoe = (a: Ret, b: Ret, tol = 0) => !(a[2] < b[0] - tol || b[2] < a[0] - tol || a[3] < b[1] - tol || b[3] < a[1] - tol);

/** Ponto dentro do polígono com furos (borda do contorno conta como dentro; borda do furo, como fora). */
export function dentroPoli(p: Poli, x: number, y: number): boolean {
  if (!pontoDentro(p[0], x, y)) return false;
  for (let i = 1; i < p.length; i++) if (pontoDentro(p[i], x, y)) return false;
  return true;
}

function areaAssinada(anel: Position[]): number {
  let s = 0;
  for (let i = 0; i < anel.length - 1; i++) s += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  return s / 2;
}

function distSegmento(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function distanciaAoAnel(anel: Position[], p: Position): number {
  let m = Infinity;
  for (let i = 0; i < anel.length - 1; i++) m = Math.min(m, distSegmento(p, anel[i], anel[i + 1]));
  return m;
}

// ─── Gleba no frame (com furos) ─────────────────────────────────────────────

export interface GlebaFrame {
  fr: FrameAnel;
  /** Furos (anéis internos) no frame, fechados. */
  furos: Position[][];
  furosBbox: Ret[];
  /** Gleba com furos, para os recortes do turf. */
  turf: Feature<Polygon>;
  /** Área líquida (contorno − furos). */
  area: number;
}

export function prepararGlebaFrame(fr: FrameAnel, furosMetros: Position[][] = []): GlebaFrame {
  const furos = furosMetros.map((f) => {
    const a = f.map((p) => rotacionar(p, -fr.angulo) as Position);
    a[a.length - 1] = a[0];
    return a;
  });
  const area = areaPlanar(fr.anel) - furos.reduce((s, f) => s + areaPlanar(f), 0);
  return { fr, furos, furosBbox: furos.map((f) => bboxDe([f])), turf: turfPolygon([fr.anel, ...furos]), area };
}

export function dentroGleba(gf: GlebaFrame, x: number, y: number): boolean {
  if (!pontoDentroIndice(gf.fr.ind, x, y)) return false;
  for (let i = 0; i < gf.furos.length; i++) {
    const b = gf.furosBbox[i];
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (pontoDentro(gf.furos[i], x, y)) return false;
  }
  return true;
}

function celulaLivreDeFuros(gf: GlebaFrame, r: Ret): boolean {
  return !gf.furosBbox.some((b) => sobrepoe(b, r));
}

/** Área de (retângulo ∩ gleba) — exata, sem turf (Sutherland–Hodgman com retângulo convexo). */
export function areaCelula(gf: GlebaFrame, r: Ret): number {
  const cheio = retanguloDentro(gf.fr.ind, r);
  let a = cheio ? (r[2] - r[0]) * (r[3] - r[1]) : areaPlanar(recortarPorRetangulo(gf.fr.anel, r));
  if (a <= 0) return 0;
  gf.furos.forEach((f, i) => { if (sobrepoe(gf.furosBbox[i], r)) a -= areaPlanar(recortarPorRetangulo(f, r)); });
  return Math.max(0, a);
}

/**
 * Quantas vezes o contorno cruza a borda do retângulo (−1 = caso degenerado: vértice sobre a borda).
 * Com exatamente 2 cruzamentos, o trecho da divisa dentro do retângulo é um arco só e a interseção é uma peça.
 */
function cruzamentosDaDivisa(anel: Position[], r: Ret): number {
  const [x0, y0, x1, y1] = r;
  const dentro = (p: Position) => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1;
  const naBorda = (p: Position) => p[0] >= x0 - 1e-9 && p[0] <= x1 + 1e-9 && p[1] >= y0 - 1e-9 && p[1] <= y1 + 1e-9 && !(p[0] > x0 + 1e-9 && p[0] < x1 - 1e-9 && p[1] > y0 + 1e-9 && p[1] < y1 - 1e-9);
  let n = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const a = anel[i], b = anel[i + 1];
    if (Math.max(a[0], b[0]) < x0 || Math.min(a[0], b[0]) > x1 || Math.max(a[1], b[1]) < y0 || Math.min(a[1], b[1]) > y1) continue;
    if (naBorda(a)) return -1;
    const da = dentro(a), db = dentro(b);
    if (da !== db) { n++; continue; }
    if (da) continue;
    // os dois extremos fora: atravessa o retângulo? (Liang–Barsky)
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let t0 = 0, t1 = 1, ok = true;
    for (const [pp, qq] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]] as [number, number][]) {
      if (pp === 0) { if (qq < 0) { ok = false; break; } continue; }
      const t = qq / pp;
      if (pp < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
    }
    if (ok && t1 - t0 > 1e-12) n += 2;
    else if (ok) return -1; // tangente a um canto
  }
  return n;
}

/** Peças de (retângulo ∩ gleba), como polígonos com furos. */
export function pecasCelula(gf: GlebaFrame, r: Ret): Poli[] {
  if (r[2] - r[0] <= 0 || r[3] - r[1] <= 0) return [];
  if (retanguloDentro(gf.fr.ind, r) && celulaLivreDeFuros(gf, r)) return [[retAnel(r)]];
  // atalho exato sem turf: a divisa entra e sai do retângulo uma única vez ⇒ a interseção é uma peça só
  if (celulaLivreDeFuros(gf, r) && cruzamentosDaDivisa(gf.fr.anel, r) === 2) {
    const anel = recortarPorRetangulo(gf.fr.anel, r);
    return anel.length >= 4 && areaPlanar(anel) > 1e-6 ? [[anel]] : [];
  }
  const x = seguro(() => intersect(featureCollection([turfPolygon([retAnel(r)]), gf.turf])));
  return x ? poligonosDe(x.geometry as Polygon | MultiPolygon).filter((p) => areaPoli(p) > 1e-6) : [];
}

export function circulo(cx: number, cy: number, r: number, n = 24): Position[] {
  const anel: Position[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    anel.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  anel.push(anel[0]);
  return anel;
}

// ─── Entrada da malha ───────────────────────────────────────────────────────

export interface ViaMalha {
  ret: Ret;
  /** Chave da rua (usada no ajuste manual da área viária). */
  chave?: string;
}

export interface BalaoMalha { cx: number; cy: number; r: number; /** índice da via (rua sem saída) onde nasce */ via: number }

export interface CelulaLote {
  ret: Ret;
  /** Lado do retângulo que é a frente (S = y mínimo, N = y máximo, W = x mínimo, E = x máximo). */
  frente: "S" | "N" | "W" | "E";
  /** Vias (índices) em que a frente pode estar — a busca rápida só confere estas. */
  viasFrente: number[];
  linha: number;
  faixa: 0 | 1;
  segmento: number;
  ordem: number;
}

export interface OpcoesMalha {
  loteMinimoM2: number;
  /** Testada mínima sobre a via para aceitar um lote recortado (m). */
  frenteMinimaM: number;
  /** Largura da via (0 = sem via: a frente não é exigida). */
  larguraViaM: number;
}

/** Testada mínima de um lote recortado: 5 m (Lei 6.766/79, art. 4º, II) e nunca menos que metade da testada informada. */
export function frenteMinimaPara(testadaM: number): number {
  return Math.min(testadaM, Math.max(5, testadaM / 2));
}

/** Comprimento do contorno do lote que fica SOBRE a linha da frente da célula (a testada real do lote recortado). */
function frenteNaLinha(anel: Position[], c: CelulaLote): number {
  const { a, b } = ladoFrente(c);
  const horizontal = Math.abs(b[1] - a[1]) < 1e-9;
  let f = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const p = anel[i], q = anel[i + 1];
    const sobre = horizontal ? Math.abs(p[1] - a[1]) < 1e-6 && Math.abs(q[1] - a[1]) < 1e-6 : Math.abs(p[0] - a[0]) < 1e-6 && Math.abs(q[0] - a[0]) < 1e-6;
    if (sobre) f += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return f;
}

function ladoFrente(c: CelulaLote): { a: Position; b: Position; fora: [number, number] } {
  const [x0, y0, x1, y1] = c.ret;
  switch (c.frente) {
    case "S": return { a: [x0, y0], b: [x1, y0], fora: [0, -1] };
    case "N": return { a: [x0, y1], b: [x1, y1], fora: [0, 1] };
    case "W": return { a: [x0, y0], b: [x0, y1], fora: [-1, 0] };
    default: return { a: [x1, y0], b: [x1, y1], fora: [1, 0] };
  }
}

const dentroRet = (r: Ret, x: number, y: number) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

/** Testada estimada (busca rápida): amostra a frente — lado do lote dentro da gleba e lado da via dentro de uma das vias. */
function frenteRapida(gf: GlebaFrame, c: CelulaLote, vias: ViaMalha[], larguraVia: number): number {
  const { a, b, fora } = ladoFrente(c);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = 8;
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]);
    const vx = x + fora[0] * DELTA, vy = y + fora[1] * DELTA;
    if (!c.viasFrente.some((v) => vias[v] && dentroRet(vias[v].ret, vx, vy))) continue;
    // a via em frente precisa ter a largura cheia dentro da gleba (sem "meia rua" na divisa)
    const lx = x + fora[0] * Math.max(DELTA, larguraVia - DELTA), ly = y + fora[1] * Math.max(DELTA, larguraVia - DELTA);
    if (dentroGleba(gf, vx, vy) && dentroGleba(gf, lx, ly) && dentroGleba(gf, x - fora[0] * DELTA, y - fora[1] * DELTA)) ok++;
  }
  return (ok / n) * L;
}

/** Atalho: lote e faixa de via em frente (largura cheia) inteiramente dentro da gleba e dentro da via de frente. */
function frenteCheia(gf: GlebaFrame, c: CelulaLote, vias: ViaMalha[], larguraVia: number): boolean {
  const [x0, y0, x1, y1] = c.ret;
  const faixa: Ret = c.frente === "S" ? [x0, y0 - larguraVia, x1, y0] : c.frente === "N" ? [x0, y1, x1, y1 + larguraVia]
    : c.frente === "W" ? [x0 - larguraVia, y0, x0, y1] : [x1, y0, x1 + larguraVia, y1];
  if (!c.viasFrente.some((v) => vias[v] && vias[v].ret[0] <= faixa[0] + 1e-9 && vias[v].ret[1] <= faixa[1] + 1e-9 && vias[v].ret[2] >= faixa[2] - 1e-9 && vias[v].ret[3] >= faixa[3] - 1e-9)) return false;
  const tudo: Ret = [Math.min(faixa[0], x0), Math.min(faixa[1], y0), Math.max(faixa[2], x1), Math.max(faixa[3], y1)];
  return retanguloDentro(gf.fr.ind, tudo) && celulaLivreDeFuros(gf, tudo);
}

/** Avaliação rápida (busca de orientação/posição): nº e área dos lotes que seriam aceitos. Sem turf. */
export function avaliarMalhaRapida(gf: GlebaFrame, vias: ViaMalha[], celulas: CelulaLote[], o: OpcoesMalha): { n: number; area: number } {
  const aceitos: { a: number; via: number }[] = [];
  for (const c of celulas) {
    const a = areaCelula(gf, c.ret);
    if (a + 1e-9 < o.loteMinimoM2 || a <= 1e-6) continue;
    if (o.larguraViaM > 0 && !frenteCheia(gf, c, vias, o.larguraViaM) && frenteRapida(gf, c, vias, o.larguraViaM) + 1e-9 < o.frenteMinimaM) continue;
    aceitos.push({ a, via: c.viasFrente[0] ?? -1 });
  }
  if (o.larguraViaM <= 0 || vias.length <= 1) return { n: aceitos.length, area: aceitos.reduce((s, x) => s + x.a, 0) };
  // conectividade aproximada (por faixa de via): só contam os lotes servidos pelo componente principal com acesso (R1)
  const comp = componentesRapidos(gf, vias);
  const porComp = new Map<number, { n: number; area: number }>();
  for (const x of aceitos) {
    const k = x.via >= 0 ? comp.raiz[x.via] : -1;
    if (k < 0 || !comp.toca.has(k)) continue;
    const c = porComp.get(k) ?? { n: 0, area: 0 };
    c.n++; c.area += x.a;
    porComp.set(k, c);
  }
  let melhor = { n: 0, area: 0 };
  for (const c of Array.from(porComp.values())) if (c.area > melhor.area + 1e-9) melhor = c;
  return melhor;
}

/** Componentes das faixas de via (sem turf): faixas que se encostam num ponto dentro da gleba ficam ligadas. */
function componentesRapidos(gf: GlebaFrame, vias: ViaMalha[]): { raiz: number[]; toca: Set<number> } {
  const uf = new UniaoBusca(vias.length);
  const amostrasEixo = (r: Ret): Position[] => {
    const w = r[2] - r[0], h = r[3] - r[1];
    const n = Math.max(3, Math.ceil(Math.max(w, h) / 4));
    return Array.from({ length: n }, (_, k) => (w >= h ? [r[0] + ((k + 0.5) / n) * w, (r[1] + r[3]) / 2] : [(r[0] + r[2]) / 2, r[1] + ((k + 0.5) / n) * h]));
  };
  const existe = vias.map((v) => amostrasEixo(v.ret).some((p) => dentroGleba(gf, p[0], p[1])));
  for (let i = 0; i < vias.length; i++) {
    if (!existe[i]) continue;
    for (let j = i + 1; j < vias.length; j++) {
      if (!existe[j]) continue;
      const A = vias[i].ret, B = vias[j].ret;
      const ox0 = Math.max(A[0], B[0]), ox1 = Math.min(A[2], B[2]), oy0 = Math.max(A[1], B[1]), oy1 = Math.min(A[3], B[3]);
      if (ox1 < ox0 - 1e-6 || oy1 < oy0 - 1e-6) continue;
      const r: Ret = [ox0, oy0, Math.max(ox0, ox1), Math.max(oy0, oy1)];
      if (amostrasEixo(r).some((p) => dentroGleba(gf, p[0], p[1]))) uf.unir(i, j);
    }
  }
  const toca = new Set<number>();
  vias.forEach((v, i) => { if (existe[i] && !retanguloDentro(gf.fr.ind, v.ret)) toca.add(uf.raiz(i)); });
  return { raiz: vias.map((_, i) => uf.raiz(i)), toca };
}

// ─── Processamento completo ─────────────────────────────────────────────────

interface No {
  poli: Poli; area: number; bbox: Ret; via: number; balao: number; tocaDivisa: boolean; acesso: Position | null;
  /** Forma usada para descontar a peça da gleba na destinação: o retângulo/círculo inteiro quando a peça é toda a
   *  interseção dele com a gleba (passa da divisa e evita lascas numéricas ao longo dela). */
  cobertura: Position[];
}

export interface ResultadoMalha {
  lotes: LoteFrame[];
  /** Peças viárias mantidas (polígonos no frame). */
  vias: Poli[];
  /** Balões mantidos (anéis no frame). */
  baloes: Position[][];
  /** Formas para descontar as vias mantidas da gleba na destinação (ver `No.cobertura`). */
  coberturaVias: Position[][];
  /** Pontos (frame) onde a malha mantida toca a divisa — os acessos. */
  acessos: Position[];
  candidatos: number;
  /** Há um componente conexo com acesso pela divisa (R1). */
  conexa: boolean;
  /** Trechos de via descartados por não se ligarem à malha principal (ou por não servirem a nenhum lote). */
  trechosDescartados: number;
  /** Número de componentes conexos ANTES do descarte (diagnóstico). */
  componentes: number;
}

class UniaoBusca {
  pai: number[];
  constructor(n: number) { this.pai = Array.from({ length: n }, (_, i) => i); }
  raiz(i: number): number { while (this.pai[i] !== i) { this.pai[i] = this.pai[this.pai[i]]; i = this.pai[i]; } return i; }
  unir(a: number, b: number) { const ra = this.raiz(a), rb = this.raiz(b); if (ra !== rb) this.pai[Math.max(ra, rb)] = Math.min(ra, rb); }
}

/**
 * Testada medida: comprimento do contorno do lote cujo lado de fora (a 5 cm) cai numa via mantida e, a uma
 * largura de via de distância, ainda está dentro de uma via (a rua em frente tem a largura cheia — sem
 * "meia rua" espremida na divisa).
 */
export function medirFrente(anel: Position[], vias: { poli: Poli; bbox: Ret }[], servidas?: Set<number>, larguraVia = 0): number {
  const dentroDeAlguma = (x: number, y: number) => vias.some((v) => dentroRet(v.bbox, x, y) && dentroPoli(v.poli, x, y));
  const s = areaAssinada(anel) >= 0 ? 1 : -1;
  let f = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const [ax, ay] = anel[i], [bx, by] = anel[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-9) continue;
    const nx = (s * (by - ay)) / L, ny = (-s * (bx - ax)) / L; // normal para fora
    const n = Math.max(1, Math.ceil(L / PASSO_AMOSTRA));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const qx = ax + t * (bx - ax) + nx * DELTA, qy = ay + t * (by - ay) + ny * DELTA;
      for (let v = 0; v < vias.length; v++) {
        if (!dentroRet(vias[v].bbox, qx, qy)) continue;
        if (!dentroPoli(vias[v].poli, qx, qy)) continue;
        if (larguraVia > 0) {
          const d = Math.max(DELTA, larguraVia - DELTA);
          const px = ax + t * (bx - ax) + nx * d, py = ay + t * (by - ay) + ny * d;
          if (!dentroDeAlguma(px, py)) break;
        }
        f += L / n; servidas?.add(v); break;
      }
    }
  }
  return f;
}

function tocaAnel(anel: Position[], poli: Poli): Position | null {
  const pts: Position[] = [];
  for (const p of poli[0]) if (distanciaAoAnel(anel, p) < 1e-4) pts.push(p);
  if (pts.length === 0) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/**
 * Processa a malha traçada: recorta vias e lotes pela gleba, monta o grafo das vias, mantém só o componente
 * conexo com acesso pela divisa (R1), aceita os lotes com área e testada mínimas sobre essa malha (R2/R3) e
 * descarta trechos de via que não servem a nenhum lote nem são necessários à ligação.
 */
export function processarMalha(gf: GlebaFrame, vias: ViaMalha[], baloes: BalaoMalha[], celulas: CelulaLote[], o: OpcoesMalha): ResultadoMalha {
  const nos: No[] = [];
  const porVia: number[][] = vias.map(() => []);
  vias.forEach((v, i) => {
    for (const p of pecasCelula(gf, v.ret)) {
      porVia[i].push(nos.length);
      nos.push({ poli: p, area: areaPoli(p), bbox: bboxDe([p[0]]), via: i, balao: -1, tocaDivisa: false, acesso: null, cobertura: p[0] });
    }
  });
  const uf0: [number, number][] = [];
  // balões: recortados pela gleba; ligados à peça da rua sem saída que contém o centro
  baloes.forEach((b, j) => {
    if (!dentroGleba(gf, b.cx, b.cy)) return;
    const circ = circulo(b.cx, b.cy, b.r);
    const ret: Ret = [b.cx - b.r, b.cy - b.r, b.cx + b.r, b.cy + b.r];
    let poli: Poli | null = null;
    let unica = true;
    if (retanguloDentro(gf.fr.ind, ret) && celulaLivreDeFuros(gf, ret)) poli = [circ];
    else {
      const x = seguro(() => intersect(featureCollection([turfPolygon([circ]), gf.turf])));
      const ps = x ? poligonosDe(x.geometry as Polygon | MultiPolygon) : [];
      unica = ps.length === 1 && ps[0].length === 1;
      poli = ps.find((p) => dentroPoli(p, b.cx, b.cy)) ?? null;
    }
    if (!poli) return;
    const pai = (porVia[b.via] ?? []).find((k) => dentroPoli(nos[k].poli, b.cx, b.cy));
    if (pai === undefined) return;
    const id = nos.length;
    nos.push({ poli, area: areaPoli(poli), bbox: bboxDe([poli[0]]), via: -1, balao: j, tocaDivisa: false, acesso: null, cobertura: unica ? circ : poli[0] });
    uf0.push([pai, id]);
  });

  // adjacência entre peças de vias diferentes (encostadas ou sobrepostas)
  const arestas: [number, number][] = [...uf0];
  for (let i = 0; i < vias.length; i++) {
    for (let j = i + 1; j < vias.length; j++) {
      const A = vias[i].ret, B = vias[j].ret;
      const ox0 = Math.max(A[0], B[0]), ox1 = Math.min(A[2], B[2]), oy0 = Math.max(A[1], B[1]), oy1 = Math.min(A[3], B[3]);
      if (ox1 < ox0 - 1e-6 || oy1 < oy0 - 1e-6) continue;
      if (porVia[i].length === 0 || porVia[j].length === 0) continue;
      const w = Math.max(0, ox1 - ox0), h = Math.max(0, oy1 - oy0);
      const amostras: { pa: Position; pb: Position }[] = [];
      const desloca = (ret: Ret, p: Position): Position => {
        const cx = (ret[0] + ret[2]) / 2, cy = (ret[1] + ret[3]) / 2;
        return [w < 1e-3 ? p[0] + Math.sign(cx - p[0]) * 1e-4 : p[0], h < 1e-3 ? p[1] + Math.sign(cy - p[1]) * 1e-4 : p[1]];
      };
      if (w >= h) {
        const n = Math.max(3, Math.ceil(w / PASSO_AMOSTRA));
        for (let k = 0; k < n; k++) { const p: Position = [ox0 + ((k + 0.5) / n) * w, (oy0 + oy1) / 2]; amostras.push({ pa: desloca(A, p), pb: desloca(B, p) }); }
      } else {
        const n = Math.max(3, Math.ceil(h / PASSO_AMOSTRA));
        for (let k = 0; k < n; k++) { const p: Position = [(ox0 + ox1) / 2, oy0 + ((k + 0.5) / n) * h]; amostras.push({ pa: desloca(A, p), pb: desloca(B, p) }); }
      }
      const vistos = new Set<string>();
      for (const { pa, pb } of amostras) {
        const na = porVia[i].find((k) => dentroRet(nos[k].bbox, pa[0], pa[1]) && dentroPoli(nos[k].poli, pa[0], pa[1]));
        if (na === undefined) continue;
        const nb = porVia[j].find((k) => dentroRet(nos[k].bbox, pb[0], pb[1]) && dentroPoli(nos[k].poli, pb[0], pb[1]));
        if (nb === undefined) continue;
        const ch = `${na}|${nb}`;
        if (vistos.has(ch)) continue;
        vistos.add(ch);
        arestas.push([na, nb]);
      }
    }
  }
  // acesso: peça cujo contorno encosta na divisa externa
  for (const no of nos) {
    if (retanguloDentro(gf.fr.ind, [no.bbox[0] - 1e-3, no.bbox[1] - 1e-3, no.bbox[2] + 1e-3, no.bbox[3] + 1e-3])) continue;
    const ac = tocaAnel(gf.fr.anel, no.poli);
    if (ac) { no.tocaDivisa = true; no.acesso = ac; }
  }
  const uf = new UniaoBusca(nos.length);
  for (const [a, b] of arestas) uf.unir(a, b);
  const comp = new Map<number, { area: number; toca: boolean }>();
  nos.forEach((no, i) => {
    const r = uf.raiz(i);
    const c = comp.get(r) ?? { area: 0, toca: false };
    c.area += no.area;
    c.toca = c.toca || no.tocaDivisa;
    comp.set(r, c);
  });
  let principal = -1, melhor = -1;
  for (const [r, c] of Array.from(comp.entries()).sort((a, b) => a[0] - b[0])) {
    if (c.toca && c.area > melhor + 1e-9) { principal = r; melhor = c.area; }
  }
  const semVia = o.larguraViaM <= 0 || vias.length === 0;
  const conexa = semVia || principal >= 0;
  const mantido = nos.map((_, i) => principal >= 0 && uf.raiz(i) === principal);

  // lotes
  const lotes: LoteFrame[] = [];
  const servidas = new Map<number, number>();
  const nosMantidos = nos.map((no, i) => ({ i, no })).filter((x) => mantido[x.i]);
  const baloesMantidos = nosMantidos.filter((x) => x.no.balao >= 0);
  let candidatos = 0;
  if (conexa) {
    for (const c of celulas) {
      let pecas = pecasCelula(gf, c.ret);
      if (pecas.length === 0) continue;
      const cheia = pecas.length === 1 && pecas[0].length === 1 && Math.abs(areaPoli(pecas[0]) - (c.ret[2] - c.ret[0]) * (c.ret[3] - c.ret[1])) < 1e-6;
      let recortado = !cheia;
      let cobertura: Position[] | null = pecas.length === 1 && pecas[0].length === 1 ? retAnel(c.ret) : null;
      // balão mantido que invade a célula: o lote é recortado por ele (a curva do balão vira frente)
      for (const b of baloesMantidos) {
        if (!sobrepoe(b.no.bbox, c.ret, -1e-6)) continue;
        const novo: Poli[] = [];
        for (const p of pecas) {
          const d = seguro(() => difference(featureCollection([turfPolygon(p), turfPolygon(b.no.poli)])));
          if (d) novo.push(...poligonosDe(d.geometry as Polygon | MultiPolygon));
          else if (d === null) { /* sem sobra */ }
        }
        pecas = novo.filter((p) => areaPoli(p) > 1e-6);
        recortado = true;
        cobertura = null;
      }
      if (pecas.length === 0) continue;
      const peca = pecas.reduce((m, p) => (areaPoli(p) > areaPoli(m) ? p : m), pecas[0]);
      if (peca.length > 1) continue; // lote com furo dentro: fica para a destinação (área pública)
      const area = areaPoli(peca);
      if (area + 1e-9 < o.loteMinimoM2) continue;
      let frente = Infinity;
      const serv = new Set<number>();
      if (!semVia) {
        frente = medirFrente(peca[0], nosMantidos.map((x) => x.no), serv, o.larguraViaM);
        if (frente + 1e-9 < o.frenteMinimaM) continue;
      }
      candidatos++;
      for (const s of Array.from(serv)) { const id = nosMantidos[s].i; servidas.set(id, (servidas.get(id) ?? 0) + 1); }
      const lote: LoteFrame = { anel: peca[0], area, ret: c.ret, linha: c.linha, faixa: c.faixa, segmento: c.segmento, ordem: c.ordem };
      if (cobertura) lote.cobertura = cobertura;
      lote.eixoTestada = c.frente === "S" || c.frente === "N" ? "x" : "y";
      if (recortado) {
        // testada mostrada = trecho REAL do lado da frente (sobre a linha da frente da célula); fundo médio = área ÷ testada
        const largura = c.frente === "S" || c.frente === "N" ? c.ret[2] - c.ret[0] : c.ret[3] - c.ret[1];
        // + a curva do balão, quando o balão cortou a frente do lote
        const naLinha = Math.min(largura, frenteNaLinha(peca[0], c)) + (baloesMantidos.length > 0 ? medirFrente(peca[0], baloesMantidos.map((x) => x.no)) : 0);
        const t = naLinha + 1e-9 >= o.frenteMinimaM ? naLinha : Number.isFinite(frente) ? frente : Math.min(c.ret[2] - c.ret[0], c.ret[3] - c.ret[1]);
        lote.testada = t;
        lote.profundidadeMedia = area / Math.max(t, 1e-9);
        (lote as LoteFrame & { recortado?: boolean }).recortado = true;
      }
      lotes.push(lote);
    }
  }

  // descarta trechos (folhas) que não servem a nenhum lote, preservando ao menos um acesso
  let descartados = nos.filter((_, i) => principal >= 0 && !mantido[i]).length;
  if (conexa && !semVia) {
    const grau = new Map<number, Set<number>>();
    for (const [a, b] of arestas) {
      if (!mantido[a] || !mantido[b] || a === b) continue;
      if (!grau.has(a)) grau.set(a, new Set());
      if (!grau.has(b)) grau.set(b, new Set());
      grau.get(a)!.add(b); grau.get(b)!.add(a);
    }
    let mudou = true;
    while (mudou) {
      mudou = false;
      const acessos = nos.filter((no, i) => mantido[i] && no.tocaDivisa).length;
      for (let i = 0; i < nos.length; i++) {
        // o balão de retorno nunca é descartado: é o retorno obrigatório da rua sem saída, sirva ou não a um lote
        if (!mantido[i] || nos[i].balao >= 0 || (servidas.get(i) ?? 0) > 0) continue;
        const viz = grau.get(i) ?? new Set<number>();
        if (viz.size > 1) continue;
        if (nos[i].tocaDivisa && acessos <= 1) continue;
        if (viz.size === 0 && nosMantidos.length > 0 && Array.from(mantido).filter(Boolean).length === 1) continue;
        mantido[i] = false;
        for (const v of Array.from(viz)) grau.get(v)?.delete(i);
        descartados++;
        mudou = true;
        break;
      }
    }
  }
  const viasOut: Poli[] = [];
  const baloesOut: Position[][] = [];
  const acessos: Position[] = [];
  const coberturaVias: Position[][] = [];
  nos.forEach((no, i) => {
    if (!mantido[i]) return;
    if (no.balao >= 0) baloesOut.push(no.poli[0]); else viasOut.push(no.poli);
    if (no.tocaDivisa && no.acesso) acessos.push(no.acesso);
    // via: o retângulo inteiro só quando todas as peças dele ficaram e a peça não tem furo
    const todas = no.via >= 0 && porVia[no.via].every((k) => mantido[k]) && no.poli.length === 1;
    if (todas && porVia[no.via][0] === i) coberturaVias.push(retAnel(vias[no.via].ret));
    else if (!todas || no.balao >= 0) coberturaVias.push(no.cobertura);
  });
  return { lotes, vias: viasOut, baloes: baloesOut, coberturaVias, acessos, candidatos, conexa, trechosDescartados: descartados, componentes: comp.size };
}

// ─── Conectividade (verificação independente, usada também nos testes) ─────

function segmentosCruzam(a: Position, b: Position, c: Position, d: Position): boolean {
  const o = (p: Position, q: Position, r: Position) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return ((o1 > 0) !== (o2 > 0)) && ((o3 > 0) !== (o4 > 0));
}

/**
 * Componentes conexos de um conjunto de anéis de via: dois anéis estão ligados quando se sobrepõem ou se encostam
 * (vértice de um sobre a borda/dentro do outro, a menos de `tol` metros, ou arestas que se cruzam). Sem turf — robusto
 * ao ruído de ida e volta lng/lat ↔ metros.
 */
export function componentesDasVias(aneis: Position[][], tol = 0.01): number {
  if (aneis.length === 0) return 0;
  const bb = aneis.map((a) => bboxDe([a]));
  const uf = new UniaoBusca(aneis.length);
  const encosta = (A: Position[], B: Position[]) => A.some((p) => pontoDentro(B, p[0], p[1]) || distanciaAoAnel(B, p) <= tol);
  for (let i = 0; i < aneis.length; i++) {
    for (let j = i + 1; j < aneis.length; j++) {
      if (!sobrepoe(bb[i], bb[j], tol)) continue;
      const A = aneis[i], B = aneis[j];
      let ligado = encosta(A, B) || encosta(B, A);
      for (let k = 0; !ligado && k < A.length - 1; k++) for (let m = 0; m < B.length - 1; m++) if (segmentosCruzam(A[k], A[k + 1], B[m], B[m + 1])) { ligado = true; break; }
      if (ligado) uf.unir(i, j);
    }
  }
  return new Set(aneis.map((_, i) => uf.raiz(i))).size;
}

// ─── Destinação de todas as sobras (R3/R4) ──────────────────────────────────

export interface AlvosDestinacao { institucional: number; verde: number; naoParcelavel: number }

export interface PecaDestinada {
  anel: Position[];
  /** Furos da peça (quando a sobra contorna um furo da gleba). */
  furos?: Position[][];
  area: number;
  tipo: "area_publica" | "nao_parcelavel";
  uso?: "institucional" | "verde";
  /** "sobra" = peça irregular/remanescente; "lote" = lote inteiro convertido. */
  origem: "sobra" | "lote";
  linha?: number;
  segmento?: number;
}

export type LoteDestinado = LoteFrame & { ampliado?: boolean; recortado?: boolean; novo?: boolean };

export interface EntradaDestinacao {
  gf: GlebaFrame;
  /** Todas as vias desenhadas (peças, balões, traçados livres) no frame. */
  vias: Poli[];
  /** Formas para descontar as vias da gleba (retângulos inteiros que passam da divisa); ausente = as próprias vias. */
  coberturaVias?: Position[][];
  lotes: LoteFrame[];
  alvos: AlvosDestinacao;
  areaNominalLote: number;
  loteMinimoM2: number;
  frenteMinimaM: number;
  /** Largura da via (para exigir a rua com largura cheia na frente de um lote novo). */
  larguraViaM?: number;
  /** Profundidade informada do lote (critério de forma do lote ampliado). */
  profundidadeNominalM?: number;
  /** Migalha pública encostada na via pode virar leito da via (falso no modo manual da área viária: o valor informado manda). */
  incorporarNaVia?: boolean;
}

export interface ResultadoDestinacao {
  lotes: LoteDestinado[];
  pecas: PecaDestinada[];
  /** Área da gleba que ficou sem destino (só ruído numérico; o teste exige ≤ 0,5% ou 1 m²). */
  semDestinoM2: number;
  /** Área da união das vias (para o fecho). */
  areaViasM2: number;
  /** Avisos da destinação (ex.: peças públicas minúsculas que ficaram isoladas). */
  avisos: string[];
  /** Migalhas entre a ponta de uma via e a divisa incorporadas ao leito da via. */
  viasExtras: Poli[];
}

/** Peça de área pública menor que isto (m²) não serve como área pública: é incorporada ao vizinho sempre que possível. */
export const AREA_PUBLICA_MINIMA_M2 = 120;

function centroideArea(anel: Position[]): Position {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const [x0, y0] = anel[i], [x1, y1] = anel[i + 1];
    const k = x0 * y1 - x1 * y0;
    a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
  }
  return Math.abs(a) < 1e-9 ? centro(anel) : [cx / (3 * a), cy / (3 * a)];
}

/** Retângulo de menor área que contém o anel (orientado pelas arestas do fecho convexo). */
export function caixaMinima(anel: Position[]): { comprimento: number; largura: number; area: number } {
  const pts = anel.slice(0, -1).map((p) => [p[0], p[1]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return { comprimento: 0, largura: 0, area: 0 };
  const cruz = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inf: [number, number][] = [], sup: [number, number][] = [];
  for (const p of pts) { while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], p) <= 0) inf.pop(); inf.push(p); }
  for (const p of [...pts].reverse()) { while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], p) <= 0) sup.pop(); sup.push(p); }
  const fecho = [...inf.slice(0, -1), ...sup.slice(0, -1)];
  let melhor = { comprimento: 0, largura: 0, area: Infinity };
  for (let i = 0; i < fecho.length; i++) {
    const a = fecho[i], b = fecho[(i + 1) % fecho.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-9) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of fecho) { const u = x * ux + y * uy, v = -x * uy + y * ux; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    const w = u1 - u0, h = v1 - v0;
    if (w * h < melhor.area) melhor = { comprimento: Math.max(w, h), largura: Math.min(w, h), area: w * h };
  }
  return Number.isFinite(melhor.area) ? melhor : { comprimento: 0, largura: 0, area: 0 };
}

/**
 * Critério de forma de lote vendável ampliado/novo (sem "pente" nem "L" fino): área ≤ 1,6 × a área nominal;
 * na caixa orientada mínima, lado maior ≤ 2,2 × a profundidade informada e área do lote ≥ 60% da área da caixa.
 */
export function formaAceitavel(anel: Position[], area: number, areaNominal: number, loteMinimo: number, profundidadeNominal: number): boolean {
  if (area > 1.6 * Math.max(areaNominal, loteMinimo) + 1e-6) return false;
  const c = caixaMinima(anel);
  if (c.comprimento > 2.2 * profundidadeNominal + 1e-6 || area < 0.6 * c.area - 1e-6) return false;
  // sem "faixa": a proporção da caixa não passa do dobro da proporção do lote informado (ex.: 12 × 25 → até 4,2 : 1)
  const testadaNominal = areaNominal / Math.max(profundidadeNominal, 1e-9);
  const proporcao = Math.max(profundidadeNominal / testadaNominal, testadaNominal / profundidadeNominal);
  return c.largura > 1e-9 && c.comprimento / c.largura <= 2 * proporcao * (1 + 1e-3); // 0,1%: ruído de ida e volta lng/lat
}

function cortarPorArea(p: Poli, alvo: number): { a: Poli[]; b: Poli[] } | null {
  const bb = bboxDe([p[0]]);
  const eixoX = bb[2] - bb[0] >= bb[3] - bb[1];
  const areaAte = (v: number) => {
    const r: Ret = eixoX ? [bb[0] - 1, bb[1] - 1, v, bb[3] + 1] : [bb[0] - 1, bb[1] - 1, bb[2] + 1, v];
    let a = areaPlanar(recortarPorRetangulo(p[0], r));
    for (let i = 1; i < p.length; i++) a -= areaPlanar(recortarPorRetangulo(p[i], r));
    return a;
  };
  let lo = eixoX ? bb[0] : bb[1], hi = eixoX ? bb[2] : bb[3];
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (areaAte(m) < alvo) lo = m; else hi = m; }
  const corte = hi;
  const rA: Ret = eixoX ? [bb[0] - 1, bb[1] - 1, corte, bb[3] + 1] : [bb[0] - 1, bb[1] - 1, bb[2] + 1, corte];
  const rB: Ret = eixoX ? [corte, bb[1] - 1, bb[2] + 1, bb[3] + 1] : [bb[0] - 1, corte, bb[2] + 1, bb[3] + 1];
  const pa = seguro(() => intersect(featureCollection([turfPolygon(p), turfPolygon([retAnel(rA)])])));
  const pb = seguro(() => intersect(featureCollection([turfPolygon(p), turfPolygon([retAnel(rB)])])));
  if (!pa || !pb) return null;
  return {
    a: poligonosDe(pa.geometry as Polygon | MultiPolygon).filter((q) => areaPoli(q) > AREA_RUIDO_M2),
    b: poligonosDe(pb.geometry as Polygon | MultiPolygon).filter((q) => areaPoli(q) > AREA_RUIDO_M2),
  };
}

/**
 * Normaliza uma peça de sobra: arredonda a 1 µm e refaz a união dela consigo mesma. Lascas de largura numérica
 * (ex.: o lado de um lote que coincide com a divisa a menos de 1e-12 m) viram costuras de largura zero e a peça se
 * separa nas partes reais — sem isso o anel "toca a si mesmo" e quebra recortes posteriores.
 */
function normalizarPeca(p: Poli): Poli[] {
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  const aneis = p.map((anel) => {
    const out: Position[] = [];
    for (const q of anel) {
      const pt: Position = [r(q[0]), r(q[1])];
      const u = out[out.length - 1];
      if (!u || u[0] !== pt[0] || u[1] !== pt[1]) out.push(pt);
    }
    if (out.length > 1 && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
    return out;
  });
  if (aneis[0].length < 4) return [];
  const limpo = aneis.filter((a) => a.length >= 4);
  const u = seguro(() => union(featureCollection([turfPolygon(limpo), turfPolygon(limpo)])));
  if (!u) return [p];
  return poligonosDe(u.geometry as Polygon | MultiPolygon);
}

/** Anel arredondado a 1 µm (sem vértices repetidos) — para uniões entre peças vindas de recortes diferentes. */
function arred(anel: Position[]): Position[] {
  const out: Position[] = [];
  for (const q of anel) {
    const pt: Position = [Math.round(q[0] * 1e6) / 1e6, Math.round(q[1] * 1e6) / 1e6];
    const u = out[out.length - 1];
    if (!u || u[0] !== pt[0] || u[1] !== pt[1]) out.push(pt);
  }
  if (out.length > 1 && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out;
}

const aneisPeca =(p: Poli): { anel: Position[]; furos?: Position[][] } => (p.length > 1 ? { anel: p[0], furos: p.slice(1) } : { anel: p[0] });

function encostam(a: Ret, b: Ret): boolean {
  const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return (Math.abs(ox) < 1e-3 && oy > 0.5) || (Math.abs(oy) < 1e-3 && ox > 0.5) || (ox > 0.5 && oy > 0.5);
}

function centro(anel: Position[]): Position {
  const n = Math.max(1, anel.length - 1);
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += anel[i][0]; y += anel[i][1]; }
  return [x / n, y / n];
}

/**
 * Dá destino a TODA a gleba: o que não é via nem lote (sobras da borda, pontas de quadra, trechos de via
 * descartados, fundos sem acesso) vira, nesta ordem: área institucional e área verde até os percentuais
 * (e a reserva das restrições informadas em m²), com as maiores peças primeiro e cortadas na medida; o que
 * ainda faltar sai de lotes inteiros contíguos; o que sobrar vira lote (se tiver área e testada), é anexado
 * ao lote vizinho (até 2 × o lote padrão) ou fica como área verde.
 */
export function destinarSobras(e: EntradaDestinacao): ResultadoDestinacao {
  const { gf } = e;
  const viasF = e.vias.filter((p) => p[0].length >= 4).map((p) => turfPolygon(p) as Geo);
  const uniaoVias = viasF.length === 0 ? null : viasF.length === 1 ? viasF[0] : seguro(() => union(featureCollection(viasF)) as Geo | null);
  const areaVias = uniaoVias ? poligonosDe(uniaoVias.geometry as Polygon | MultiPolygon).reduce((s, p) => s + areaPoli(p), 0) : 0;
  const lotes: LoteDestinado[] = e.lotes.map((l) => ({ ...l }));
  // sobra = gleba − vias − lotes
  let sobra: Geo | null = gf.turf as Geo;
  const descontar = (fs: Geo[]) => {
    if (!sobra || fs.length === 0) return;
    const u = fs.length === 1 ? fs[0] : (seguro(() => union(featureCollection(fs))) as Geo | null);
    if (!u) { for (const f of fs) descontar([f]); return; }
    const d = seguro(() => difference(featureCollection([sobra as Geo, u])) as Geo | null);
    if (d === null && fs.length > 1) { for (const f of fs) descontar([f]); return; }
    sobra = d;
  };
  // desconta formas que PASSAM da divisa (retângulo/círculo inteiro) quando a peça é toda a interseção com a gleba:
  // assim a sobra não ganha lascas de largura numérica ao longo da divisa
  const cobVias = e.coberturaVias ? e.coberturaVias.map((a) => turfPolygon([a]) as Geo) : (uniaoVias ? [uniaoVias] : []);
  for (let i = 0; i < cobVias.length && sobra; i += 64) descontar(cobVias.slice(i, i + 64));
  const lotesF = lotes.map((l) => turfPolygon([l.cobertura ?? l.anel]) as Geo);
  for (let i = 0; i < lotesF.length && sobra; i += 64) descontar(lotesF.slice(i, i + 64));
  const sobraFinal = sobra as Geo | null;
  let pool: Poli[] = sobraFinal ? poligonosDe(sobraFinal.geometry as Polygon | MultiPolygon).flatMap(normalizarPeca).filter((p) => areaPoli(p) > AREA_RUIDO_M2) : [];
  const pecas: PecaDestinada[] = [];
  const viasNos = e.vias.map((p) => ({ poli: p, bbox: bboxDe([p[0]]) }));
  const forma = (anel: Position[], area: number) => formaAceitavel(anel, area, e.areaNominalLote, e.loteMinimoM2, e.profundidadeNominalM ?? Math.sqrt(e.areaNominalLote));

  /** Atualiza o lote com o novo anel: testada MEDIDA sobre a via e profundidade média = área ÷ testada. */
  const ampliar = (i: number, anel: Position[], area: number) => {
    const l = lotes[i];
    // a sobra entra pela frente/fundo: a testada continua a do lote (inteiro: largura da célula); fundo médio = área ÷ testada
    const t = l.testada ?? (l.eixoTestada === "y" ? l.ret[3] - l.ret[1] : l.ret[2] - l.ret[0]);
    lotes[i] = { ...l, anel, area, testada: t, profundidadeMedia: area / Math.max(t, 1e-9), ampliado: true };
  };

  /** União da peça com o lote: um polígono só, sem furo, e com forma de lote (critério de forma). */
  const tentarAnexo = (i: number, p: Poli): { anel: Position[]; area: number } | null => {
    if (p.length > 1) return null;
    const l = lotes[i];
    const bp = bboxDe([p[0]]);
    if (!sobrepoe(bboxDe([l.anel]), bp, 0.01)) return null;
    // lote da malha: a sobra só entra pela frente/fundo, dentro da faixa das divisas laterais prolongadas (sem "L" de lado)
    if (l.eixoTestada) {
      const tol = 0.25 * (l.eixoTestada === "x" ? l.ret[2] - l.ret[0] : l.ret[3] - l.ret[1]);
      const [a0, a1, b0, b1] = l.eixoTestada === "x" ? [bp[0], bp[2], l.ret[0], l.ret[2]] : [bp[1], bp[3], l.ret[1], l.ret[3]];
      if (a0 < b0 - tol || a1 > b1 + tol) return null;
    }
    // arredonda a 1 µm: o lado comum (S-H do lote × recorte do turf na sobra) difere em ~1e-12 m
    const u = seguro(() => union(featureCollection([turfPolygon([arred(l.anel)]), turfPolygon(p.map(arred))])));
    if (!u || u.geometry.type !== "Polygon" || u.geometry.coordinates.length > 1) return null;
    const anel = u.geometry.coordinates[0];
    const area = areaPlanar(anel);
    return forma(anel, area) ? { anel, area } : null;
  };

  /** Anexa a peça inteira ao lote vizinho que continuar com forma de lote (o menor deles). */
  const anexar = (p: Poli): boolean => {
    let melhor: { i: number; anel: Position[]; area: number } | null = null;
    lotes.forEach((l, i) => {
      const r = tentarAnexo(i, p);
      if (r && (!melhor || l.area < lotes[melhor.i].area)) melhor = { i, ...r };
    });
    const m = melhor as { i: number; anel: Position[]; area: number } | null;
    if (!m) return false;
    ampliar(m.i, m.anel, m.area);
    return true;
  };

  /**
   * Sobra que encosta em VÁRIOS lotes: é repartida prolongando as divisas laterais de cada lote até a divisa da gleba —
   * cada lote ganha só o trecho que fica na sua frente/fundo (o lote "vai até a divisa"), se continuar com forma de lote.
   * O que não couber em nenhum lote volta como sobra (para as doações ou área verde).
   */
  const repartir = (p: Poli): Poli[] => {
    if (p.length > 1) return [p];
    const bp = bboxDe([p[0]]);
    const vizinhos = lotes.map((l, i) => ({ l, i })).filter(({ l }) => l.eixoTestada && sobrepoe(bboxDe([l.anel]), bp, 0.01));
    if (vizinhos.length === 0) return anexar(p) ? [] : [p];
    const xs = new Set<number>(), ys = new Set<number>();
    for (const { l } of vizinhos) {
      if (l.eixoTestada === "x") { xs.add(l.ret[0]); xs.add(l.ret[2]); } else { ys.add(l.ret[1]); ys.add(l.ret[3]); }
    }
    let partes: Poli[] = [p];
    const cortar = (eixo: "x" | "y", v: number) => {
      partes = partes.flatMap((q) => {
        const b = bboxDe([q[0]]);
        if (eixo === "x" ? v <= b[0] + 1e-6 || v >= b[2] - 1e-6 : v <= b[1] + 1e-6 || v >= b[3] - 1e-6) return [q];
        const r1: Ret = eixo === "x" ? [b[0] - 1, b[1] - 1, v, b[3] + 1] : [b[0] - 1, b[1] - 1, b[2] + 1, v];
        const r2: Ret = eixo === "x" ? [v, b[1] - 1, b[2] + 1, b[3] + 1] : [b[0] - 1, v, b[2] + 1, b[3] + 1];
        const out: Poli[] = [];
        for (const r of [r1, r2]) {
          const x = seguro(() => intersect(featureCollection([turfPolygon(q), turfPolygon([retAnel(r)])])));
          if (x) out.push(...poligonosDe(x.geometry as Polygon | MultiPolygon).filter((z) => areaPoli(z) > AREA_RUIDO_M2));
        }
        return out.length > 0 ? out : [q];
      });
    };
    Array.from(xs).sort((a, b) => a - b).forEach((v) => cortar("x", v));
    Array.from(ys).sort((a, b) => a - b).forEach((v) => cortar("y", v));
    const restos: Poli[] = [];
    for (const q of partes) {
      const c = centroideArea(q[0]);
      // o lote "dono" do trecho: aquele cuja faixa lateral (prolongada) contém o trecho e que encosta nele
      const donos = vizinhos.filter(({ l }) => (l.eixoTestada === "x" ? c[0] >= l.ret[0] - 1e-6 && c[0] <= l.ret[2] + 1e-6 : c[1] >= l.ret[1] - 1e-6 && c[1] <= l.ret[3] + 1e-6));
      let feito = false;
      for (const { i } of donos) {
        const r = tentarAnexo(i, q);
        if (r) { ampliar(i, r.anel, r.area); feito = true; break; }
      }
      if (!feito) restos.push(q);
    }
    if (restos.length <= 1) return restos;
    // trechos que sobraram e se encostam voltam a ser uma peça só
    const u = seguro(() => union(featureCollection(restos.map((q) => turfPolygon(q)))));
    return u ? poligonosDe(u.geometry as Polygon | MultiPolygon).filter((z) => areaPoli(z) > AREA_RUIDO_M2) : restos;
  };

  // 1) cada sobra que encosta em lotes é repartida entre eles (prolongando as divisas laterais até a divisa)
  pool = pool.flatMap(repartir);
  // peças menores que a área pública mínima não servem de doação: vão inteiras para o lote vizinho que as comporte
  pool = pool.filter((p) => !(areaPoli(p) < AREA_PUBLICA_MINIMA_M2 && anexar(p)));
  const migalha = 0.5 * e.loteMinimoM2;

  // 2) doações e restrições: maiores peças primeiro, cortadas na medida
  const ordenar = () => pool.sort((a, b) => areaPoli(b) - areaPoli(a));
  const metas: { tipo: PecaDestinada["tipo"]; uso?: PecaDestinada["uso"]; alvo: number }[] = [
    { tipo: "area_publica", uso: "institucional", alvo: e.alvos.institucional },
    { tipo: "area_publica", uso: "verde", alvo: e.alvos.verde },
    { tipo: "nao_parcelavel", alvo: e.alvos.naoParcelavel },
  ];
  const falta: number[] = [];
  for (const meta of metas) {
    let resta = meta.alvo;
    ordenar();
    while (resta > 0.5 && pool.length > 0) {
      // peça menor que a área pública mínima não serve de doação: o que faltar sai de lotes contíguos (passo 3)
      if (areaPoli(pool[0]) < AREA_PUBLICA_MINIMA_M2) break;
      const p = pool.shift()!;
      const a = areaPoli(p);
      if (a <= resta + Math.max(1, 0.02 * resta) || a - Math.max(resta, AREA_PUBLICA_MINIMA_M2) < migalha) {
        pecas.push({ ...aneisPeca(p), area: a, tipo: meta.tipo, ...(meta.uso ? { uso: meta.uso } : {}), origem: "sobra" });
        resta -= a;
        continue;
      }
      const corte = cortarPorArea(p, Math.max(resta, AREA_PUBLICA_MINIMA_M2));
      if (!corte || corte.a.length === 0) {
        pecas.push({ ...aneisPeca(p), area: a, tipo: meta.tipo, ...(meta.uso ? { uso: meta.uso } : {}), origem: "sobra" });
        resta -= a;
        continue;
      }
      for (const q of corte.a) { const aq = areaPoli(q); pecas.push({ ...aneisPeca(q), area: aq, tipo: meta.tipo, ...(meta.uso ? { uso: meta.uso } : {}), origem: "sobra" }); resta -= aq; }
      pool.push(...corte.b);
      ordenar();
    }
    falta.push(Math.max(0, resta));
  }

  // 3) o que faltar sai de lotes inteiros contíguos (começando pelo vizinho de uma peça do mesmo uso)
  metas.forEach((meta, mi) => {
    let resta = falta[mi];
    if (resta <= 0.5) return;
    const doUso = pecas.filter((p) => p.tipo === meta.tipo && p.uso === meta.uso).map((p) => bboxDe([p.anel]));
    while (resta > 0.5 && lotes.length > 0) {
      let semente = lotes.findIndex((l) => doUso.some((b) => sobrepoe(b, bboxDe([l.anel]), 0.01)));
      if (semente < 0) {
        semente = 0;
        lotes.forEach((l, i) => { if (l.area < lotes[semente].area - 1e-9) semente = i; });
      }
      const fila = [semente];
      const visto = new Set<number>([semente]);
      const tomados: number[] = [];
      while (fila.length > 0 && resta > 0.5) {
        const i = fila.shift()!;
        tomados.push(i);
        resta -= lotes[i].area;
        const ri = lotes[i].ret;
        lotes.forEach((l, j) => { if (!visto.has(j) && encostam(ri, l.ret)) { visto.add(j); fila.push(j); } });
      }
      for (const i of tomados) {
        const l = lotes[i];
        pecas.push({ anel: l.anel, area: l.area, tipo: meta.tipo, ...(meta.uso ? { uso: meta.uso } : {}), origem: "lote", linha: l.linha, segmento: l.segmento });
        doUso.push(bboxDe([l.anel]));
      }
      const fora = new Set(tomados);
      const restantes = lotes.filter((_, i) => !fora.has(i));
      lotes.length = 0;
      lotes.push(...restantes);
    }
  });

  // 4) o restante: lote próprio (área, testada e forma de lote), anexo ao vizinho (com forma de lote) ou área verde
  ordenar();
  for (const p of pool) {
    const a = areaPoli(p);
    if (p.length === 1 && a + 1e-9 >= e.loteMinimoM2 && forma(p[0], a)) {
      const frente = viasNos.length > 0 ? medirFrente(p[0], viasNos, undefined, e.larguraViaM ?? 0) : 0;
      // lote novo com a frente no lado CURTO (frente comprida e fundo raso = faixa ao longo da rua, não lote)
      if (frente + 1e-9 >= e.frenteMinimaM && frente <= 1.5 * caixaMinima(p[0]).largura + 1e-6) {
        const c = centro(p[0]);
        let viz: LoteDestinado | null = null, dist = Infinity;
        for (const l of lotes) { const cl = centro(l.anel); const d = Math.hypot(cl[0] - c[0], cl[1] - c[1]); if (d < dist) { dist = d; viz = l; } }
        lotes.push({
          anel: p[0], area: a, ret: bboxDe([p[0]]), linha: viz?.linha ?? 0, faixa: viz?.faixa ?? 0, segmento: viz?.segmento ?? 0,
          ordem: c[0], testada: frente, profundidadeMedia: a / frente, novo: true, recortado: true,
        });
        continue;
      }
    }
    if (anexar(p)) continue;
    pecas.push({ ...aneisPeca(p), area: a, tipo: "area_publica", uso: "verde", origem: "sobra" });
  }

  // 5) peças públicas minúsculas: para o lote vizinho (se continuar com forma de lote e o mínimo do uso se mantiver)
  //    ou para a peça pública vizinha; 6) peças contíguas do mesmo uso viram uma só (praça, não lotes verdes)
  const totalUso = (tipo: PecaDestinada["tipo"], uso?: PecaDestinada["uso"]) => pecas.filter((x) => x.tipo === tipo && x.uso === uso).reduce((s, x) => s + x.area, 0);
  const alvoUso = (tipo: PecaDestinada["tipo"], uso?: PecaDestinada["uso"]) => (tipo === "nao_parcelavel" ? e.alvos.naoParcelavel : uso === "institucional" ? e.alvos.institucional : e.alvos.verde);
  for (let k = 0; k < pecas.length; k++) {
    const p = pecas[k];
    if (p.area >= AREA_PUBLICA_MINIMA_M2 || p.furos?.length) continue;
    if (totalUso(p.tipo, p.uso) - p.area + 0.5 < alvoUso(p.tipo, p.uso)) continue;
    if (anexar([p.anel])) { pecas.splice(k, 1); k--; continue; }
  }
  const unirPecas = (pred: (a: PecaDestinada, b: PecaDestinada) => boolean) => {
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (let i = 0; i < pecas.length && !mudou; i++) {
        for (let j = 0; j < pecas.length && !mudou; j++) {
          if (i === j || !pred(pecas[i], pecas[j])) continue;
          const a = pecas[i], b = pecas[j];
          if (!sobrepoe(bboxDe([a.anel]), bboxDe([b.anel]), 0.01)) continue;
          const u = seguro(() => union(featureCollection([turfPolygon([a.anel, ...(a.furos ?? [])].map(arred)), turfPolygon([b.anel, ...(b.furos ?? [])].map(arred))])));
          if (!u || u.geometry.type !== "Polygon") continue;
          const rs = u.geometry.coordinates;
          const novo: PecaDestinada = {
            anel: rs[0], ...(rs.length > 1 ? { furos: rs.slice(1) } : {}), area: a.area + b.area, tipo: a.tipo, ...(a.uso ? { uso: a.uso } : {}),
            origem: a.origem === "sobra" || b.origem === "sobra" ? "sobra" : "lote",
          };
          pecas.splice(Math.max(i, j), 1);
          pecas.splice(Math.min(i, j), 1, novo);
          mudou = true;
        }
      }
    }
  };
  // minúscula encostada numa peça pública maior: incorpora-se a ela (fica com o uso da maior)
  unirPecas((a, b) => b.area < AREA_PUBLICA_MINIMA_M2 && a.area >= b.area && a.tipo === b.tipo
    && (a.uso === b.uso || totalUso(b.tipo, b.uso) - b.area + 0.5 >= alvoUso(b.tipo, b.uso)));
  unirPecas((a, b) => a.tipo === b.tipo && a.uso === b.uso);
  // migalha pública encostada numa via (entre a ponta da rua e a divisa) passa a ser leito da via
  const viasExtras: Poli[] = [];
  for (let k = 0; k < pecas.length; k++) {
    const p = pecas[k];
    if (e.incorporarNaVia === false || p.area >= AREA_PUBLICA_MINIMA_M2 || p.furos?.length || p.tipo !== "area_publica") continue;
    if (totalUso(p.tipo, p.uso) - p.area + 0.5 < alvoUso(p.tipo, p.uso)) continue;
    const bp = bboxDe([p.anel]);
    const encosta = viasNos.some((v) => {
      if (!sobrepoe(v.bbox, bp, 0.01)) return false;
      const u = seguro(() => union(featureCollection([turfPolygon(v.poli.map(arred)), turfPolygon([arred(p.anel)])])));
      return !!u && u.geometry.type === "Polygon";
    });
    if (!encosta) continue;
    viasExtras.push([p.anel]);
    pecas.splice(k, 1);
    k--;
  }
  const areaViasExtras = viasExtras.reduce((s, v) => s + areaPoli(v), 0);
  const isoladas = pecas.filter((p) => p.area < AREA_PUBLICA_MINIMA_M2).length;
  const avisos = isoladas > 0
    ? [`${isoladas} peça(s) de área pública com menos de ${AREA_PUBLICA_MINIMA_M2} m² ficaram isoladas (sem lote nem área pública vizinha que as absorva).`]
    : [];

  const soma = lotes.reduce((s, l) => s + l.area, 0) + pecas.reduce((s, p) => s + p.area, 0) + areaVias + areaViasExtras;
  return { lotes, pecas, viasExtras, semDestinoM2: gf.area - soma, areaViasM2: areaVias + areaViasExtras, avisos };
}
