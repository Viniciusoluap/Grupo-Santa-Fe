// Vias públicas — desmembramento "em faixas", como no projeto aprovado do Lote 01 Qd O
// (SEPLU, processo 1769/2026, memorial descritivo de 60 lotes):
//
// 1. Uma via é a REFERÊNCIA (no aprovado, a Rua das Andorinhas com a rotatória). Os lotes dela
//    têm fundo fixo P = metade da largura entre as duas divisas retas paralelas mais longas
//    (lotes de costas: 33,62 ÷ 2 = 16,81 m) e frente = área mínima ÷ P (125 ÷ 16,81 = 7,44 m).
//    Onde a frente mínima manda (leque da rotatória), a frente fica na mínima e o fundo encolhe
//    até fechar a área (13,5–13,8 m no aprovado). O lote de esquina leva a cunha da esquina obtusa.
// 2. FAIXA DE PONTA (Av. dos Marrecos, lotes 30–35 do aprovado): lotes de frente para a via que cruza
//    a ponta da referência, divididos a partir da esquina com a referência — primeiro os de fundo
//    inteiro (até os fundos da referência: o triangular e o vizinho), depois os de fundo `Pe`; o da
//    esquina com a via de trás fica com o resto. `Pe` é o menor fundo que rende o máximo de lotes.
// 3. VIA DE TRÁS (Rua dos Uirapurus): lotes de costas para os da referência, com as laterais
//    perpendiculares à própria via (em leque nas curvas); junto da faixa de ponta, paralelas à via
//    da ponta (lotes 23–29). A frente de cada um é a que fecha a área mínima, nunca abaixo da testada.
//    Onde as vias são paralelas, as laterais continuam as da referência (lotes 2–12 ↔ 50–60).
// 4. Cada zona é dividida das duas pontas para o meio com lotes de área exata; a sobra fica nos
//    lotes do meio (curva) e nas esquinas. Nada sobra: 100% de aproveitamento.
// Determinístico (sem Math.random, sem Date). A via de referência e as faixas de ponta são escolhidas
// pela busca: mais lotes; no empate, o fundo da regra, nenhum lote muito acima da mínima e mais lotes regulares.

import { difference, featureCollection, intersect, polygon as turfPolygon, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { areaPlanar, type LoteFrame, type Ret } from "./geometria-parcelamento";

export interface OpcoesFaixas { testada: number; profundidade: number; loteMinimoM2: number }

type P2 = [number, number];
interface Amostra { u: number; s: number; p: P2; th: number }
type Geo = Feature<Polygon | MultiPolygon>;

const EPS = 1e-9;
/**
 * Folgas numéricas: o corte mira a área mínima exata (lotes de 125,00 m²) e a frente mínima + FOLGA; a sobra que
 * fecha uma zona pode ficar TOL abaixo (ruído do recorte) — encaixe exato (ex.: retângulo múltiplo do lote) não perde lote.
 */
const FOLGA_AREA = 0, TOL_AREA = 1e-5, FOLGA_FRENTE = 0.001, TOL_FRENTE = 0.002, RUIDO_AREA = 1e-6;
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: P2, b: P2): P2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: P2, k: number): P2 => [a[0] * k, a[1] * k];
const cruz = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];
const dist = (a: Position, b: Position) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const dir = (th: number): P2 => [Math.cos(th), Math.sin(th)];
const bbox = (a: Position[]): Ret => {
  const xs = a.map((p) => p[0]), ys = a.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
function seguro<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }

function areaAssinada(pts: P2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

/** Recorta o polígono (qualquer) pelo quadrilátero convexo anti-horário (Sutherland–Hodgman): devolve a área. */
function areaRecortada(sujeito: P2[], clip: P2[]): number {
  let saida = sujeito;
  for (let i = 0; i < clip.length && saida.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], ab = sub(b, a);
    const dentro = (p: P2) => cruz(ab, sub(p, a)) >= -1e-12;
    const entrada = saida; saida = [];
    for (let k = 0; k < entrada.length; k++) {
      const p = entrada[k], q = entrada[(k + 1) % entrada.length];
      const dp = dentro(p), dq = dentro(q);
      if (dp) saida.push(p);
      if (dp !== dq) {
        const pq = sub(q, p), den = cruz(ab, pq);
        if (Math.abs(den) > EPS) saida.push(add(p, mul(pq, cruz(ab, sub(a, p)) / den)));
      }
    }
  }
  return saida.length >= 3 ? Math.abs(areaAssinada(saida)) : 0;
}

/** Distância do ponto, na direção `u`, até cruzar o contorno (∞ se não cruza). */
function atravessar(anel: P2[], o: P2, u: P2): number {
  let m = Infinity;
  for (let i = 0; i < anel.length; i++) {
    const a = anel[i], b = anel[(i + 1) % anel.length], ab = sub(b, a);
    const den = cruz(u, ab);
    if (Math.abs(den) < EPS) continue;
    const ao = sub(a, o), t = cruz(ao, ab) / den, w = cruz(ao, u) / den;
    if (t > 1e-6 && w >= -1e-9 && w <= 1 + 1e-9) m = Math.min(m, t);
  }
  return m;
}

/**
 * Largura de referência: distância entre as duas divisas retas paralelas mais longas que se encaram
 * por dentro do terreno (lotes de costas). Sem par paralelo: null.
 */
export function larguraReferencia(anel: P2[], minimo: number): { w: number; arestas: [number, number] } | null {
  const n = anel.length;
  let melhor: { w: number; peso: number; arestas: [number, number] } | null = null;
  for (let i = 0; i < n; i++) {
    const a = anel[i], b = anel[(i + 1) % n], li = dist(a, b);
    if (li < minimo) continue;
    const ti = mul(sub(b, a), 1 / li), ni: P2 = [-ti[1], ti[0]];
    const meio = mul(add(a, b), 0.5);
    const w = atravessar(anel, add(meio, mul(ni, 1e-4)), ni);
    if (!Number.isFinite(w)) continue;
    const alvo = add(meio, mul(ni, w));
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const c = anel[j], d = anel[(j + 1) % n], lj = dist(c, d);
      if (lj < minimo) continue;
      const tj = mul(sub(d, c), 1 / lj);
      if (ti[0] * tj[0] + ti[1] * tj[1] > -Math.cos((3 * Math.PI) / 180)) continue; // opostas (±3°)
      const cd = sub(d, c), k = Math.max(0, Math.min(1, ((alvo[0] - c[0]) * cd[0] + (alvo[1] - c[1]) * cd[1]) / (lj * lj)));
      if (dist(add(c, mul(cd, k)), alvo) > 0.05) continue; // o raio do meio de i encontra j
      const peso = Math.min(li, lj);
      if (!melhor || peso > melhor.peso) melhor = { w: w + 1e-4, peso, arestas: [i, j] }; // + o recuo do ponto de partida
    }
  }
  return melhor ? { w: melhor.w, arestas: melhor.arestas } : null;
}

/**
 * Amostras ao longo da via de referência (arestas consecutivas do anel anti-horário), com extensão
 * `E` além das pontas. `s` = comprimento real ao longo da via; `u` = parâmetro de corte (cresce também
 * nos leques dos vértices côncavos, para que o leque possa ser dividido entre lotes). `th` é o ângulo
 * da normal para dentro; em cantos convexos a normal gira devagar o bastante para as laterais não se
 * cruzarem até `L` metros (ajuste do lado mais curto do canto).
 */
function amostrar(anel: P2[], arestas: number[], ds: number, L: number | ((s: number) => number), E: number, kappa: number, thAresta?: (i: number, th: number) => number): Amostra[] {
  const n = anel.length;
  const cru: { s: number; p: P2; th: number }[] = [];
  let s = 0, phiAnt: number | null = null;
  const angs: number[] = [];
  for (const i of arestas) {
    const a = anel[i], b = anel[(i + 1) % n];
    let phi = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (phiAnt !== null) { let d = phi - phiAnt; d = Math.atan2(Math.sin(d), Math.cos(d)); phi = phiAnt + d; }
    phiAnt = phi; angs.push(phi);
  }
  const thDe = (k: number) => (thAresta ? thAresta(arestas[k], angs[k] + Math.PI / 2) : angs[k] + Math.PI / 2);
  const e0 = anel[arestas[0]], th0 = thDe(0), t0 = dir(angs[0]);
  for (let k = Math.ceil(E / ds); k >= 1; k--) cru.push({ s: -k * ds, p: sub(e0 as P2, mul(t0, k * ds)), th: th0 });
  arestas.forEach((i, k) => {
    const a = anel[i], b = anel[(i + 1) % n], len = dist(a, b), th = thDe(k), t = dir(angs[k]);
    const passos = Math.max(1, Math.ceil(len / ds));
    for (let j = 0; j <= passos; j++) cru.push({ s: s + (len * j) / passos, p: add(a, mul(t, (len * j) / passos)), th });
    s += len;
  });
  const ult = arestas[arestas.length - 1], eF = anel[(ult + 1) % n], thF = thDe(angs.length - 1), tF = dir(angs[angs.length - 1]);
  for (let k = 1; k <= Math.ceil(E / ds); k++) cru.push({ s: s + k * ds, p: add(eF, mul(tF, k * ds)), th: thF });
  // normais que convergem (canto convexo) não podem girar mais que Δs ÷ L (σ = ∫ ds ÷ L)
  const N = cru.length, sig = new Array<number>(N).fill(0);
  for (let k = 1; k < N; k++) sig[k] = sig[k - 1] + (cru[k].s - cru[k - 1].s) / (typeof L === "number" ? L : Math.max(L((cru[k].s + cru[k - 1].s) / 2), EPS));
  const g = cru.map((a, k) => a.th - sig[k]);
  const baixo = new Array<number>(N), alto = new Array<number>(N);
  for (let k = 0, m = Infinity; k < N; k++) { m = Math.min(m, g[k]); baixo[k] = m + sig[k]; }
  for (let k = N - 1, m = -Infinity; k >= 0; k--) { m = Math.max(m, g[k]); alto[k] = m + sig[k]; }
  const th = cru.map((a) => a.th);
  if (typeof L !== "number") {
    // alcance variável (zonas): o giro é repartido por igual entre os dois lados de cada canto
    for (let i = 0; i < N; i++) th[i] = (baixo[i] + alto[i]) / 2;
  } else for (let i = 0; i < N; i++) {
    if (!(baixo[i] < cru[i].th - 1e-9) || (i > 0 && baixo[i - 1] < cru[i - 1].th - 1e-9)) continue;
    let j = i; while (j + 1 < N && baixo[j + 1] < cru[j + 1].th - 1e-9) j++;
    let h = i - 1; while (h >= 0 && alto[h] > cru[h].th + 1e-9) h--;
    const lenBaixo = cru[j].s - cru[i].s, lenAlto = i - 1 > h ? cru[i - 1].s - cru[h + 1].s : Infinity;
    if (lenAlto < lenBaixo) for (let k = h + 1; k <= i - 1; k++) th[k] = alto[k];
    else for (let k = i; k <= j; k++) th[k] = baixo[k];
  }
  // leques (rotação para fora): sub-amostras a cada 2° e parâmetro u crescendo κ por radiano
  const out: Amostra[] = [];
  let u = 0;
  for (let k = 0; k < N; k++) {
    if (k > 0) {
      const ds_ = cru[k].s - cru[k - 1].s, dth = th[k] - th[k - 1];
      if (ds_ < EPS && dth < -1e-9) {
        const passos = Math.ceil(-dth / ((2 * Math.PI) / 180));
        for (let j = 1; j < passos; j++) { u += (kappa * -dth) / passos; out.push({ u, s: cru[k].s, p: cru[k].p, th: th[k - 1] + (dth * j) / passos }); }
        u += (kappa * -dth) / passos;
      } else u += ds_ + (dth < 0 ? kappa * -dth : 0);
    }
    out.push({ u, s: cru[k].s, p: cru[k].p, th: th[k] });
  }
  return out;
}

/** Ponto e normal no parâmetro `u` (interpolação linear entre amostras). */
function emU(am: Amostra[], u: number): Amostra {
  if (u <= am[0].u) return am[0];
  if (u >= am[am.length - 1].u) return am[am.length - 1];
  let lo = 0, hi = am.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (am[m].u <= u) lo = m; else hi = m; }
  const a = am[lo], b = am[hi], f = b.u - a.u > EPS ? (u - a.u) / (b.u - a.u) : 1;
  return { u, s: a.s + (b.s - a.s) * f, p: add(a.p, mul(sub(b.p, a.p), f)), th: a.th + (b.th - a.th) * f };
}
/** Menor u com s(u) ≥ alvo. */
function uDeS(am: Amostra[], alvo: number): number {
  let lo = 0, hi = am.length - 1;
  if (am[hi].s < alvo) return am[hi].u;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (am[m].s >= alvo) hi = m; else lo = m; }
  const a = am[lo], b = am[hi];
  if (a.s >= alvo) return a.u;
  return a.u + (b.u - a.u) * ((alvo - a.s) / Math.max(b.s - a.s, EPS));
}

/** Amostras do intervalo [u0, u1] (com as pontas exatas). */
function trecho(am: Amostra[], u0: number, u1: number): Amostra[] {
  const out: Amostra[] = [emU(am, u0)];
  let lo = 0, hi = am.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (am[m].u <= u0 + EPS) lo = m + 1; else hi = m; }
  for (let k = lo; k < am.length && am[k].u < u1 - EPS; k++) out.push(am[k]);
  out.push(emU(am, u1));
  return out;
}

const topo = (a: Amostra, d: number): P2 => add(a.p, mul(dir(a.th), d));
const quad = (a: Amostra, b: Amostra, d: number): P2[] => [a.p, b.p, topo(b, d), topo(a, d)];

/** Polígono entre u0 e u1, da profundidade `d0(a)` até `d1(a)` (base na via de referência). */
function faixa(am: Amostra[], u0: number, u1: number, d0: (u: number, lado: -1 | 1) => number, d1: number, quebras: number[] = []): P2[] {
  const t = trecho(am, u0, u1);
  // nas quebras de fundo (divisa entre lotes da referência) entram dois pontos: fundo de cada lado
  const base: P2[] = [];
  for (const q of quebras) if (q > u0 + EPS && q < u1 - EPS && !t.some((a) => Math.abs(a.u - q) < EPS)) t.push(emU(am, q));
  t.sort((x, y) => x.u - y.u);
  for (const a of t) {
    const e = d0(a.u, -1), d = d0(a.u, 1);
    base.push(topo(a, e));
    if (Math.abs(e - d) > 1e-9) base.push(topo(a, d));
  }
  const pts: P2[] = [...base, ...[...t].reverse().map((a) => topo(a, d1))];
  const limpo: P2[] = [];
  for (const p of pts) if (!limpo.length || dist(limpo[limpo.length - 1], p) > 1e-7) limpo.push(p);
  if (limpo.length > 1 && dist(limpo[0], limpo[limpo.length - 1]) < 1e-7) limpo.pop();
  return limpo;
}


interface LoteRef { u0: number; u1: number; d: number }
/** Polígono já ocupado por um lote (sem o ponto de fecho) e o seu retângulo envolvente. */
interface Ocup { pts: P2[]; bb: Ret }
/** Célula de uma zona: fatia entre duas amostras vizinhas da via, com a área livre e a frente própria. */
interface Cel { a: Amostra; b: Amostra; D: number; area: number; frente: number }
/** Zona de lotes de frente para uma via: amostras, comprimento da via e alcance (fundo livre) em cada amostra. */
interface Zona { am: Amostra[]; comp: number; alc: number[]; alcMeio: number[] }
type Completar = (gleba: Position[], lotes: LoteFrame[], o: OpcoesFaixas) => LoteFrame[];

const semFecho = (r: Position[]) => r.slice(0, -1).map((p) => [p[0], p[1]] as P2);
const ocupar = (pts: P2[]): Ocup => ({ pts, bb: bbox(pts) });

function poligonoGeo(pts: P2[]): Geo | null {
  if (pts.length < 3) return null;
  const anel = areaAssinada(pts) < 0 ? [...pts].reverse() : pts;
  return seguro(() => turfPolygon([[...anel, anel[0]]]));
}
function pecas(g: Geo | null): Position[][] {
  if (!g) return [];
  const gm = g.geometry;
  return (gm.type === "Polygon" ? [gm.coordinates] : gm.coordinates).map((r) => r[0]).filter((r) => areaPlanar(r) > 1e-4);
}
function pontoDentro(pg: P2[], q: P2): boolean {
  let dentro = false;
  for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) {
    const a = pg[i], b = pg[j];
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro;
  }
  return dentro;
}
function distAnel(anel: P2[], p: Position): number {
  let m = Infinity;
  for (let i = 0; i < anel.length; i++) {
    const a = anel[i], b = anel[(i + 1) % anel.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const f = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    m = Math.min(m, Math.hypot(p[0] - (a[0] + f * dx), p[1] - (a[1] + f * dy)));
  }
  return m;
}
/** Frente real: comprimento do contorno do lote que está sobre a divisa da gleba. */
function frenteReal(anel: P2[], lote: Position[]): number {
  let f = 0;
  for (let i = 0; i + 1 < lote.length; i++) {
    const a = lote[i], b = lote[i + 1];
    if (distAnel(anel, a) < 0.02 && distAnel(anel, b) < 0.02 && distAnel(anel, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) < 0.02) f += dist(a, b);
  }
  return f;
}

/** Menor x em [lo, hi] com f(x) ≥ alvo (f não decrescente); null se nem f(hi) chega. */
function busca(f: (x: number) => number, alvo: number, lo: number, hi: number, voltas = 34): number | null {
  if (hi < lo || f(hi) < alvo) return null;
  for (let it = 0; it < voltas; it++) { const m = (lo + hi) / 2; if (f(m) >= alvo) hi = m; else lo = m; }
  return hi;
}

/** Soma acumulada das células de uma zona (área livre e frente), com corte em qualquer ponto `u`. */
class Faixa1D {
  readonly ini: number; readonly fim: number;
  private acA: number[] = [0]; private acF: number[] = [0];
  /** `parcial(c, u)`: área livre exata da célula `c` do início até o corte `u` (sem ela, proporcional). */
  constructor(readonly cel: Cel[], private parcial?: (c: Cel, u: number) => number) {
    for (const c of cel) { this.acA.push(this.acA[this.acA.length - 1] + c.area); this.acF.push(this.acF[this.acF.length - 1] + c.frente); }
    // a zona vai da primeira à última célula com área livre
    let i = 0, j = cel.length - 1;
    while (i < j && cel[i].area <= 1e-9) i++;
    while (j > i && cel[j].area <= 1e-9) j--;
    this.ini = cel.length ? cel[i].a.u : 0; this.fim = cel.length ? cel[j].b.u : 0;
  }
  private idx(u: number) { let lo = 0, hi = this.cel.length; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cel[m].a.u <= u) lo = m; else hi = m; } return lo; }
  private ate(ac: number[], campo: "area" | "frente", u: number) {
    if (!this.cel.length) return 0;
    const i = this.idx(u), c = this.cel[i], f = Math.max(0, Math.min(1, (u - c.a.u) / (c.b.u - c.a.u)));
    if (campo === "area" && this.parcial && f > 1e-9 && f < 1 - 1e-9 && c.area > 1e-9) return ac[i] + Math.min(c.area, this.parcial(c, u));
    return ac[i] + c[campo] * f;
  }
  area(u0: number, u1: number) { return u1 > u0 ? this.ate(this.acA, "area", u1) - this.ate(this.acA, "area", u0) : 0; }
  frente(u0: number, u1: number) { return u1 > u0 ? this.ate(this.acF, "frente", u1) - this.ate(this.acF, "frente", u0) : 0; }
  /** Menor u com acumulado ≥ valor (sentido +) ou maior u com acumulado ≤ valor (sentido −). */
  private onde(ac: number[], campo: "area" | "frente", valor: number, sentido: 1 | -1): number {
    const u = this.ondeLinear(ac, campo, valor, sentido);
    if (campo !== "area" || !this.parcial) return u;
    const i = this.idx(u), c = this.cel[i];
    if (u <= c.a.u + EPS || u >= c.b.u - EPS || c.area <= 1e-9) return u;
    // dentro da célula a área não cresce por igual (degraus dos fundos, esquinas): acerta o corte no polígono
    let lo = c.a.u, hi = c.b.u;
    for (let it = 0; it < 34; it++) { const m = (lo + hi) / 2; if (ac[i] + this.parcial(c, m) >= valor) hi = m; else lo = m; }
    return sentido > 0 ? hi : lo;
  }
  private ondeLinear(ac: number[], campo: "area" | "frente", valor: number, sentido: 1 | -1): number {
    const n = this.cel.length;
    if (sentido > 0) {
      let lo = 0, hi = n; // menor i com ac[i] ≥ valor
      while (lo < hi) { const m = (lo + hi) >> 1; if (ac[m] >= valor - 1e-12) hi = m; else lo = m + 1; }
      if (lo === 0) return this.cel[0].a.u;
      const c = this.cel[lo - 1];
      return c.a.u + (c.b.u - c.a.u) * Math.max(0, Math.min(1, (valor - ac[lo - 1]) / Math.max(c[campo], EPS)));
    }
    let lo = 0, hi = n; // maior i com ac[i] ≤ valor
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ac[m] <= valor + 1e-12) lo = m; else hi = m - 1; }
    if (lo === n) return this.cel[n - 1].b.u;
    const c = this.cel[lo];
    return c.a.u + (c.b.u - c.a.u) * Math.max(0, Math.min(1, (valor - ac[lo]) / Math.max(c[campo], EPS)));
  }
  /** A partir de `de`, o corte mais próximo que fecha a área e a frente pedidas; null se passar de `lim`. */
  passo(de: number, area: number, frente: number, sentido: 1 | -1, lim: number): number | null {
    const xa = this.onde(this.acA, "area", this.ate(this.acA, "area", de) + sentido * area, sentido);
    const xf = this.onde(this.acF, "frente", this.ate(this.acF, "frente", de) + sentido * frente, sentido);
    const x = sentido > 0 ? Math.max(xa, xf) : Math.min(xa, xf);
    const [a, b] = sentido > 0 ? [de, x] : [x, de];
    if (sentido > 0 ? x > lim + EPS : x < lim - EPS) return null;
    if (this.area(a, b) < area - 1e-6 || this.frente(a, b) < frente - 1e-6) return null;
    return x;
  }
}

/** Ocupados cujo retângulo envolvente toca o retângulo dado. */
const perto = (ocup: Ocup[], bb: Ret) => ocup.filter((oc) => !(oc.bb[2] < bb[0] || bb[2] < oc.bb[0] || oc.bb[3] < bb[1] || bb[3] < oc.bb[1]));

/** Fundo livre a partir do ponto `q` (já dentro da gleba), na direção `u`: 0 se o ponto já é de outro lote. */
function fundoLivre(anel: P2[], ocup: Ocup[], q: P2, u: P2): number {
  if (!pontoDentro(anel, q)) return 0;
  for (const oc of ocup) if (q[0] >= oc.bb[0] && q[0] <= oc.bb[2] && q[1] >= oc.bb[1] && q[1] <= oc.bb[3] && pontoDentro(oc.pts, q)) return 0;
  let m = atravessar(anel, q, u);
  for (const oc of ocup) m = Math.min(m, atravessar(oc.pts, q, u));
  return m;
}
/** Fundo livre a partir do ponto da via, na direção da lateral: 0 se a frente já é de outro lote. */
function alcance(anel: P2[], ocup: Ocup[], a: Amostra): number {
  const u = dir(a.th);
  const m = fundoLivre(anel, ocup, add(a.p, mul(u, 0.02)), u);
  return m > 0 ? m + 0.02 : 0;
}
/**
 * Além da ponta da via (prolongamento reto): só conta a cunha de esquina obtusa — a lateral entra na gleba
 * pela aresta vizinha da ponta. Devolve a distância até o fim do terreno livre (0 se não há cunha).
 */
function alcanceCunha(anel: P2[], ocup: Ocup[], a: Amostra, vizinha: number): number {
  const u = dir(a.th), c = anel[vizinha], d = anel[(vizinha + 1) % anel.length], cd = sub(d, c);
  const den = cruz(u, cd);
  if (Math.abs(den) < EPS) return 0;
  const ca = sub(c, a.p), t1 = cruz(ca, cd) / den, w = cruz(ca, u) / den;
  if (t1 <= 0 || w < -1e-9 || w > 1 + 1e-9) return 0;
  const m = fundoLivre(anel, ocup, add(a.p, mul(u, t1 + 0.02)), u);
  return m > 0 ? t1 + 0.02 + m : 0;
}

/** Amostra a via da zona e mede o alcance de cada amostra (com um corte exato onde a frente livre começa/acaba). */
function prepararZona(anel: P2[], arestas: number[], ocup: Ocup[], L: number | ((s: number) => number), E: number, thAresta?: (i: number, th: number) => number): Zona {
  const comp = arestas.reduce((s, i) => s + dist(anel[i], anel[(i + 1) % anel.length]), 0);
  const base = amostrar(anel, arestas, 0.5, L, E, 1, thAresta);
  const naVia = (a: Amostra) => a.s >= -EPS && a.s <= comp + EPS;
  const am: Amostra[] = [];
  for (let k = 0; k < base.length; k++) {
    const a = base[k];
    if (k > 0) {
      const p = base[k - 1];
      if (naVia(p) && naVia(a) && a.u - p.u > 1e-6 && (alcance(anel, ocup, p) > 0) !== (alcance(anel, ocup, a) > 0)) {
        const livreP = alcance(anel, ocup, p) > 0;
        let lo = p.u, hi = a.u;
        for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if ((alcance(anel, ocup, emU(base, m)) > 0) === livreP) lo = m; else hi = m; }
        if (lo - p.u > 1e-4 && a.u - hi > 1e-4) am.push(emU(base, (lo + hi) / 2));
      }
    }
    am.push(a);
  }
  const n = anel.length, antes = (arestas[0] - 1 + n) % n, depois = (arestas[arestas.length - 1] + 1) % n;
  const mede = (a: Amostra) => (naVia(a) ? alcance(anel, ocup, a) : alcanceCunha(anel, ocup, a, a.s < 0 ? antes : depois));
  const alc = am.map(mede);
  const alcMeio = am.map((a, k) => (k + 1 < am.length ? mede(emU(am, (a.u + am[k + 1].u) / 2)) : 0));
  return { am, comp, alc, alcMeio };
}

/** Área livre do quadrilátero: dentro da gleba, menos o que já é de outros lotes. */
function areaLivre(anel: P2[], ocup: Ocup[], q: P2[]): number {
  let area = areaRecortada(anel, q);
  if (area > 1e-9) for (const oc of perto(ocup, bbox(q))) area -= areaRecortada(oc.pts, q);
  return Math.max(0, area);
}
/** Faixa acumulada de uma zona, com o corte dentro da célula medido no polígono. */
const faixaExata = (anel: P2[], z: Zona, ocup: Ocup[], cel: Cel[]) => new Faixa1D(cel, (c, u) => areaLivre(anel, ocup, quad(c.a, emU(z.am, u), c.D)));

/** Células da zona com fundo limitado a `teto` (∞ = até onde houver terreno livre). */
function celulas(anel: P2[], z: Zona, ocup: Ocup[], teto: number): Cel[] {
  const cel: Cel[] = [];
  for (let k = 0; k + 1 < z.am.length; k++) {
    const a = z.am[k], b = z.am[k + 1];
    if (b.u - a.u <= EPS) continue;
    const livre = z.alcMeio[k] > 0;
    const D = livre ? Math.min(teto, Math.max(z.alc[k], z.alc[k + 1], z.alcMeio[k]) + 1) : 0;
    const area = D > 1e-6 ? areaLivre(anel, ocup, quad(a, b, D)) : 0;
    // a frente é só a da própria via (o prolongamento além das pontas não tem frente)
    cel.push({ a, b, D, area, frente: livre ? Math.max(0, Math.min(z.comp, b.s) - Math.max(0, a.s)) : 0 });
  }
  return cel;
}

/** Contorno do lote entre os cortes u0 e u1 da zona (antes do recorte pela gleba e pelos ocupados). */
function contorno(z: Zona, cel: Cel[], u0: number, u1: number): P2[] {
  const base: P2[] = [], fundo: P2[] = [];
  for (const c of cel) {
    if (c.b.u <= u0 + EPS || c.a.u >= u1 - EPS) continue;
    const a = c.a.u < u0 ? emU(z.am, u0) : c.a, b = c.b.u > u1 ? emU(z.am, u1) : c.b, D = Math.max(c.D, 0.01);
    base.push(a.p, b.p); fundo.push(topo(a, D), topo(b, D));
  }
  const limpo: P2[] = [];
  for (const p of [...base, ...fundo.reverse()]) if (!limpo.length || dist(limpo[limpo.length - 1], p) > 1e-7) limpo.push(p);
  if (limpo.length > 1 && dist(limpo[0], limpo[limpo.length - 1]) < 1e-7) limpo.pop();
  return limpo;
}

/**
 * Divide a zona das duas pontas para o meio: cada lote com a área mínima (ou mais, onde a frente mínima manda).
 * A sobra fica nos lotes do meio, repartida por quantos forem precisos para nenhum passar muito da mínima.
 */
function dividirPontas(f: Faixa1D, A: number, t: number, encaixes: number[] = [], folga = 0): number[] | null {
  const U0 = f.ini, U1 = f.fim, alvo = A + FOLGA_AREA, tA = t + FOLGA_FRENTE, Am = A - TOL_AREA, tm = t - TOL_FRENTE;
  if (f.area(U0, U1) < Am || f.frente(U0, U1) < tm) return null;
  const esq = [U0], drt = [U1];
  let L = U0, R = U1;
  for (let lado = 0; ; lado++) {
    if (f.area(L, R) < 3 * A - TOL_AREA || f.frente(L, R) < 3 * t - TOL_FRENTE) break;
    const x0 = lado % 2 === 0 ? f.passo(L, alvo, tA, 1, R) : f.passo(R, alvo, tA, -1, L);
    if (x0 === null) break;
    // encaixe: o corte vai para a lateral do lote de costas (a mais próxima) se a área não passar da folga
    let x = x0;
    if (encaixes.length) {
      let melhor: number | null = null;
      for (const xs of encaixes) {
        const [p, q] = lado % 2 === 0 ? [L, xs] : [xs, R];
        if (q <= p + EPS || xs <= L + EPS || xs >= R - EPS || (melhor !== null && Math.abs(xs - x0) >= Math.abs(melhor - x0))) continue;
        const ar = f.area(p, q);
        if (ar >= Am && ar <= alvo * (1 + folga) && f.frente(p, q) >= tm) melhor = xs;
      }
      if (melhor !== null) x = melhor;
    }
    const [a, b] = lado % 2 === 0 ? [x, R] : [L, x];
    if (f.area(a, b) < 2 * A - TOL_AREA || f.frente(a, b) < 2 * t - TOL_FRENTE) break;
    if (lado % 2 === 0) { L = x; esq.push(x); } else { R = x; drt.push(x); }
  }
  /** Reparte [a, b] em m lotes em sequência: cada um leva a sua parte da área que resta, com a frente mínima. */
  const repartir = (a: number, b: number, m: number): number[] | null => {
    const c = [a];
    for (let k = 0; k < m - 1; k++) {
      const x = f.passo(c[k], Math.max(alvo, f.area(c[k], b) / (m - k)), tA, 1, b);
      if (x === null) return null;
      c.push(x);
    }
    c.push(b);
    return f.area(c[m - 1], b) >= Am && f.frente(c[m - 1], b) >= tm ? c : null;
  };
  let meio: number[] | null = null;
  for (let m = Math.min(Math.floor((f.area(L, R) + TOL_AREA) / A), Math.floor((f.frente(L, R) + TOL_FRENTE) / t)); m >= 1 && !meio; m--) meio = repartir(L, R, m);
  if (!meio) return null;
  // sobra grande em poucos lotes: o meio cresce (um vizinho de cada lado por vez) e reparte a sobra por mais lotes
  let sobra = (f.area(L, R) - (meio.length - 1) * A) / (meio.length - 1);
  for (let lado = 0; sobra > 0.1 * A && meio.length - 1 < 8 && (esq.length > 1 || drt.length > 1); lado++) {
    const daEsq = (lado % 2 === 0 && esq.length > 1) || drt.length <= 1;
    const nL = daEsq ? esq[esq.length - 2] : L, nR = daEsq ? R : drt[drt.length - 2];
    const novo = repartir(nL, nR, meio.length);
    const nSobra = novo ? (f.area(nL, nR) - (novo.length - 1) * A) / (novo.length - 1) : Infinity;
    if (!novo || nSobra >= sobra - 1e-6) break;
    if (daEsq) esq.pop(); else drt.pop();
    L = nL; R = nR; meio = novo; sobra = nSobra;
  }
  return [...esq.slice(0, -1), ...meio, ...drt.slice(0, -1).reverse()];
}

/**
 * Faixa de ponta (lotes de frente para a via que cruza a ponta da referência), dividida a partir da esquina com a
 * referência: `nFundo` lotes de fundo inteiro (até os fundos da referência) e, depois, lotes de fundo `Pe`; o da
 * esquina com a via de trás fica com o que resta. Devolve os cortes na ordem da divisão.
 */
function dividirPonta(fInteiro: Faixa1D, fPe: Faixa1D, sentido: 1 | -1, nFundo: number, A: number, t: number): number[] | null {
  const alvo = A + FOLGA_AREA, tA = t + FOLGA_FRENTE, Am = A - TOL_AREA, tm = t - TOL_FRENTE;
  const de = sentido > 0 ? fInteiro.ini : fInteiro.fim, ate = sentido > 0 ? fPe.fim : fPe.ini;
  const cortes = [de];
  let x = de;
  for (let j = 0; j < nFundo; j++) {
    const nx = fInteiro.passo(x, alvo, tA, sentido, ate);
    if (nx === null) return null;
    x = nx; cortes.push(x);
  }
  const resto = (a: number): [number, number] => (sentido > 0 ? [fPe.area(a, ate), fPe.frente(a, ate)] : [fPe.area(ate, a), fPe.frente(ate, a)]);
  for (;;) {
    const [ar, fr] = resto(x);
    if (ar < 2 * A - TOL_AREA || fr < 2 * t - TOL_FRENTE) break;
    const nx = fPe.passo(x, alvo, tA, sentido, ate);
    if (nx === null) break;
    const [ar2, fr2] = resto(nx);
    if (ar2 < Am || fr2 < tm) break;
    x = nx; cortes.push(x);
  }
  const [ar, fr] = resto(x);
  if (ar >= Am && fr >= tm) cortes.push(ate);
  else if (cortes.length - 1 > nFundo) cortes[cortes.length - 1] = ate;
  else if (nFundo === 0) return null;
  return cortes;
}

interface Referencia { arestas: number[]; P: number; lotes: LoteFrame[] }
/** Faixa de ponta: via (arestas), lado (antes do início ou depois do fim da referência), lotes de fundo inteiro e fundo. */
interface Ponta { arestas: number[]; lado: "ini" | "fim"; nFundo: number; Pe: number }

/** 1. Lotes da via de referência: fundo fixo P, frente = área ÷ P; no leque, frente mínima e fundo que fecha a área. */
function implantarReferencia(anel: P2[], glebaGeo: Geo, arestas: number[], o: OpcoesFaixas, P: number): Referencia | null {
  const A = o.loteMinimoM2, t = o.testada;
  const comp = arestas.reduce((s, i) => s + dist(anel[i], anel[(i + 1) % anel.length]), 0);
  if (comp < 2 * t) return null;
  // comprimento das laterais: alcança o ponto da gleba mais distante da via de referência
  const viaPts = arestas.map((i) => anel[i]).concat([anel[(arestas[arestas.length - 1] + 1) % anel.length]]);
  const distVia = (q: P2) => {
    let m = Infinity;
    for (let k = 0; k + 1 < viaPts.length; k++) {
      const a = viaPts[k], b = viaPts[k + 1], ab = sub(b, a), L2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
      const f = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / L2));
      m = Math.min(m, dist(q, add(a, mul(ab, f))));
    }
    return m;
  };
  const Lg = Math.max(P, ...anel.map(distVia)) * 1.15 + 2;
  const am = amostrar(anel, arestas, 0.5, 2 * Lg, Lg, P); // margem: laterais só se encontrariam além de 2 × o alcance
  const sDe = (u: number) => emU(am, u).s;
  const sVia = (u: number) => Math.max(0, Math.min(comp, sDe(u)));
  const alvoA = A + FOLGA_AREA;
  // área de cada fatia no fundo P (acumulada): só as fatias cortadas pelas pontas do intervalo são recalculadas
  const acP = [0];
  for (let k = 0; k + 1 < am.length; k++) acP.push(acP[k] + (am[k + 1].u - am[k].u > EPS ? areaRecortada(anel, quad(am[k], am[k + 1], P)) : 0));
  const fatia = (u: number) => { let lo = 0, hi = am.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (am[m].u <= u) lo = m; else hi = m; } return lo; };
  const areaRef = (u0: number, u1: number, d: number) => {
    if (u1 <= u0 + EPS) return 0;
    if (d === P) {
      const i0 = fatia(u0), i1 = fatia(u1);
      if (i0 === i1) return areaRecortada(anel, quad(emU(am, u0), emU(am, u1), P));
      const ini = am[i0 + 1].u - u0 > EPS ? areaRecortada(anel, quad(emU(am, u0), am[i0 + 1], P)) : 0;
      const fim = u1 - am[i1].u > EPS ? areaRecortada(anel, quad(am[i1], emU(am, u1), P)) : 0;
      return ini + acP[i1] - acP[i0 + 1] + fim;
    }
    const tr = trecho(am, u0, u1);
    let soma = 0;
    for (let k = 0; k + 1 < tr.length; k++) soma += areaRecortada(anel, quad(tr[k], tr[k + 1], d));
    return soma;
  };
  const fundoQueFecha = (a: number, b: number, alvo = alvoA) => (areaRef(a, b, P) > alvo + 0.01 ? (busca((y) => areaRef(a, b, y), alvo, 0, P) ?? P) : P);
  /** Lote a partir de `de` no sentido dado: área exata, frente ≥ testada, fundo ≤ P. */
  const loteRef = (de: number, lim: number, sentido: 1 | -1, alvo: number, frenteNaVia: boolean): LoteRef | null => {
    const ar = (x: number) => (sentido > 0 ? areaRef(de, de + x, P) : areaRef(de - x, de, P));
    const span = Math.abs(lim - de);
    const xa = busca(ar, alvo, 0, span);
    if (xa === null) return null;
    // lote de esquina (começa no prolongamento): a frente pode ser a da via que cruza; senão, conta só a da própria via
    const sDe0 = frenteNaVia ? Math.max(0, Math.min(comp, sDe(de))) : sDe(de);
    const uFrente = sentido > 0 ? uDeS(am, sDe0 + t) : (() => { const r = busca((y) => sDe0 - sDe(de - y), t, 0, span); return r === null ? lim : de - r; })();
    const xf = Math.abs(uFrente - de);
    if (xf > span + EPS) return null;
    const x = Math.max(xa, xf);
    const [a, b] = sentido > 0 ? [de, de + x] : [de - x, de];
    return { u0: a, u1: b, d: x > xa + EPS ? fundoQueFecha(a, b, alvo) : P };
  };
  /** Polígono real do lote (recorte pela gleba); null se o recorte não dá uma peça só. */
  const poligonoRef = (r: LoteRef): Position[] | null => {
    const g = poligonoGeo(faixa(am, r.u0, r.u1, () => 0, r.d));
    const pc = pecas(g && (seguro(() => intersect(featureCollection([glebaGeo, g]))) as Geo | null));
    return pc.length === 1 ? pc[0] : null;
  };
  /** Como `loteRef`, conferindo a área no polígono real: o que faltar (esquinas) é reposto no corte. */
  const loteConferido = (de: number, lim: number, sentido: 1 | -1): LoteRef | null => {
    let alvo = alvoA, frenteNaVia = false, l = loteRef(de, lim, sentido, alvo, frenteNaVia);
    for (let volta = 0; volta < 4 && l; volta++) {
      const pc = poligonoRef(l);
      if (pc && !frenteNaVia && frenteReal(anel, pc) < t - 0.005) { frenteNaVia = true; l = loteRef(de, lim, sentido, alvo, frenteNaVia); continue; }
      const falta = A - (pc ? areaPlanar(pc) : A + 1);
      if (falta <= RUIDO_AREA) break;
      alvo += falta;
      l = loteRef(de, lim, sentido, alvo, frenteNaVia);
    }
    return l;
  };
  const esquerda: LoteRef[] = [], direita: LoteRef[] = [];
  // desde o prolongamento das pontas: a cunha da esquina obtusa entra no lote de esquina da referência
  const nA = anel.length, antes = (arestas[0] - 1 + nA) % nA, depois = (arestas[arestas.length - 1] + 1) % nA;
  let iL = 0, iR = am.length - 1;
  while (am[iL].s < -EPS) iL++;
  while (am[iR].s > comp + EPS) iR--;
  while (iL > 0 && alcanceCunha(anel, [], am[iL - 1], antes) > 0) iL--;
  while (iR < am.length - 1 && alcanceCunha(anel, [], am[iR + 1], depois) > 0) iR++;
  let L = am[iL].u, R = am[iR].u;
  for (let lado = 0; ; lado++) {
    if (areaRef(L, R, P) < 3 * A - TOL_AREA || sVia(R) - sVia(L) < 3 * t - TOL_FRENTE) break;
    const l = lado % 2 === 0 ? loteConferido(L, R, 1) : loteConferido(R, L, -1);
    if (!l) break;
    if (lado % 2 === 0) { esquerda.push(l); L = l.u1; } else { direita.push(l); R = l.u0; }
  }
  // meio: frentes iguais; o fundo de cada um fecha a área (≤ P)
  const meio: LoteRef[] = [];
  const sL = sVia(L), sR = sVia(R);
  for (let m = Math.min(Math.floor((sR - sL + TOL_FRENTE) / t), Math.floor((areaRef(L, R, P) + TOL_AREA) / A)); m >= 1; m--) {
    const cortes = Array.from({ length: m + 1 }, (_, k) => (k === 0 ? L : k === m ? R : uDeS(am, sL + ((sR - sL) * k) / m)));
    const tent: LoteRef[] = [];
    let ok = true;
    for (let k = 0; k < m && ok; k++) {
      const a = cortes[k], b = cortes[k + 1];
      if (areaRef(a, b, P) < A - TOL_AREA) { ok = false; break; }
      // o fundo fecha a área; conferido no polígono real (o que faltar é reposto no fundo)
      let lote: LoteRef = { u0: a, u1: b, d: fundoQueFecha(a, b) };
      for (let volta = 0, alvo = alvoA; volta < 3 && lote.d < P; volta++) {
        const pc = poligonoRef(lote), falta = A - (pc ? areaPlanar(pc) : A + 1);
        if (falta <= RUIDO_AREA) break;
        alvo += falta;
        lote = { u0: a, u1: b, d: fundoQueFecha(a, b, alvo) };
      }
      tent.push(lote);
    }
    if (ok) { meio.push(...tent); break; }
  }
  let refs = [...esquerda, ...meio, ...[...direita].reverse()];
  if (!meio.length && refs.length) {
    // sem lote no meio: a sobra vai para o vizinho (fundo até P)
    const i = esquerda.length - 1;
    if (i >= 0) refs[i] = { ...refs[i], u1: R, d: P };
    else refs[0] = { ...refs[0], u0: L, d: P };
  }
  refs = refs.filter((r) => r.u1 - r.u0 > EPS);
  if (!refs.length) return null;
  const lotes: LoteFrame[] = [];
  for (const r of refs) {
    const pc = poligonoRef(r);
    if (!pc) return null;
    lotes.push({ anel: pc, area: areaPlanar(pc), ret: bbox(pc), linha: 0, faixa: 0, segmento: 0, ordem: 0 });
  }
  return { arestas, P, lotes };
}

/** Polígonos dos lotes de uma zona (recorte pela gleba, menos o que já está ocupado); pedaço solto fica para o fechamento. */
function lotesDaZona(glebaGeo: Geo, ocup: Ocup[], z: Zona, partes: { cel: Cel[]; u0: number; u1: number }[], linha: number): LoteFrame[] {
  const out: LoteFrame[] = [];
  for (const pt of partes) {
    const pts = contorno(z, pt.cel, pt.u0, pt.u1);
    const g = poligonoGeo(pts);
    let peca = g && (seguro(() => intersect(featureCollection([glebaGeo, g]))) as Geo | null);
    const viz = perto(ocup, bbox(pts));
    if (peca && viz.length) {
      const fs = viz.map((oc) => turfPolygon([[...oc.pts, oc.pts[0]]]));
      const u = fs.length === 1 ? fs[0] : (seguro(() => union(featureCollection(fs))) as Geo | null);
      peca = u ? (seguro(() => difference(featureCollection([peca as Geo, u]))) as Geo | null) : null;
    }
    const pc = pecas(peca).sort((x, y) => areaPlanar(y) - areaPlanar(x));
    if (!pc.length) continue;
    out.push({ anel: pc[0], area: areaPlanar(pc[0]), ret: bbox(pc[0]), linha, faixa: linha === 0 ? 0 : 1, segmento: 0, ordem: 0 });
  }
  return out;
}

/** Laterais comuns a dois lotes vizinhos da referência: ponto do fundo e direção (da frente para o fundo). */
function lateraisDaReferencia(anel: P2[], ref: Referencia): { fundo: P2; th: number }[] {
  const out: { fundo: P2; th: number }[] = [];
  for (let i = 0; i + 1 < ref.lotes.length; i++) {
    const a = semFecho(ref.lotes[i].anel), b = semFecho(ref.lotes[i + 1].anel);
    const comuns = a.filter((v) => distAnel(b, v) < 0.01);
    const naDivisa = comuns.filter((v) => distAnel(anel, v) < 0.02), dentro = comuns.filter((v) => distAnel(anel, v) > 0.05);
    if (!naDivisa.length || !dentro.length) continue;
    const frente = naDivisa[0];
    const fundo = dentro.reduce((m, v) => (dist(v, frente) > dist(m, frente) ? v : m), dentro[0]);
    out.push({ fundo, th: Math.atan2(fundo[1] - frente[1], fundo[0] - frente[0]) });
  }
  return out;
}

/**
 * Cortes da zona que continuam, do outro lado, as laterais da referência (lotes de costas na mesma linha). Só onde
 * as laterais dos dois lados são paralelas; perto das esquinas, a sequência continua no mesmo passo.
 */
function encaixesDaZona(z: Zona, laterais: { fundo: P2; th: number }[]): number[] {
  const paralela = (thZona: number, thRef: number) => Math.abs(Math.atan2(Math.sin(thZona - thRef - Math.PI), Math.cos(thZona - thRef - Math.PI))) < (2 * Math.PI) / 180;
  const achados: { u: number; s: number; th: number }[] = [];
  for (const lt of laterais) {
    for (let k = 0; k + 1 < z.am.length; k++) {
      const a = z.am[k], b = z.am[k + 1];
      if (a.s < -EPS || b.s > z.comp + EPS || b.u - a.u <= EPS || !paralela(a.th, lt.th) || !paralela(b.th, lt.th)) continue;
      const va = sub(lt.fundo, a.p), vb = sub(lt.fundo, b.p), fa = cruz(dir(a.th), va), fb = cruz(dir(b.th), vb);
      if (fa * fb > 0 || Math.abs(fa - fb) < EPS) continue;
      const da = va[0] * Math.cos(a.th) + va[1] * Math.sin(a.th);
      if (da <= 0 || da > Math.max(z.alc[k], z.alc[k + 1]) + 1.5) continue;
      const f = fa / (fa - fb);
      achados.push({ u: a.u + (b.u - a.u) * f, s: a.s + (b.s - a.s) * f, th: a.th });
      break;
    }
  }
  achados.sort((x, y) => x.s - y.s);
  const out = achados.map((x) => x.u);
  // continuação no mesmo passo para além da primeira e da última lateral (lotes de esquina), enquanto a via segue reta
  const continuar = (de: { s: number; th: number }, passo: number) => {
    for (let k = 1; k <= 3; k++) {
      const sK = de.s + k * passo;
      if (sK <= 0 || sK >= z.comp || Math.abs(emU(z.am, uDeS(z.am, sK)).th - de.th) > Math.PI / 360) break;
      out.push(uDeS(z.am, sK));
    }
  };
  if (achados.length >= 2) {
    continuar(achados[0], achados[0].s - achados[1].s);
    continuar(achados[achados.length - 1], achados[achados.length - 1].s - achados[achados.length - 2].s);
  }
  return out.sort((x, y) => x - y);
}

interface Contexto { anel: P2[]; glebaGeo: Geo; trechos: number[][]; o: OpcoesFaixas; completar?: Completar }

/** Zona de uma faixa de ponta já amostrada (o fundo `Pe` é escolhido depois). */
interface PontaPronta { arestas: number[]; lado: "ini" | "fim"; z: Zona; inteiro: Cel[]; fInteiro: Faixa1D; sentido: 1 | -1; Pmax: number }

function prepararPonta(c: Contexto, ref: Referencia, arestas: number[], lado: "ini" | "fim"): PontaPronta {
  // fundo da faixa: até área mínima ÷ testada (além disso a frente mínima obrigaria a passar da área mínima)
  const Pmax = c.o.loteMinimoM2 / c.o.testada;
  const ocup = ref.lotes.map((l) => ocupar(semFecho(l.anel)));
  const z = prepararZona(c.anel, arestas, ocup, () => Pmax, Pmax);
  const inteiro = celulas(c.anel, z, ocup, Infinity);
  return { arestas, lado, z, inteiro, fInteiro: faixaExata(c.anel, z, ocup, inteiro), sentido: lado === "ini" ? -1 : 1, Pmax };
}

/** Menor fundo `Pe` com que a faixa de ponta rende o máximo de lotes (o resto do terreno fica para a via de trás). */
function fundoDaPonta(c: Contexto, ref: Referencia, pp: PontaPronta, nFundo: number): { Pe: number; n: number } | null {
  const ocup = ref.lotes.map((l) => ocupar(semFecho(l.anel)));
  const conta = (Pe: number) => { const ct = dividirPonta(pp.fInteiro, faixaExata(c.anel, pp.z, ocup, celulas(c.anel, pp.z, ocup, Pe)), pp.sentido, nFundo, c.o.loteMinimoM2, c.o.testada); return ct ? ct.length - 1 : 0; };
  const n = conta(pp.Pmax);
  if (n <= nFundo) return null;
  const Pe = busca(conta, n, pp.Pmax / 2, pp.Pmax, 16);
  return Pe === null ? null : { Pe, n };
}

/** 2 e 3. Faixas de ponta e via(s) de trás em volta da referência; devolve os lotes já fechados e conferidos. */
function montar(c: Contexto, ref: Referencia, pontas: (Ponta & { pronta: PontaPronta })[], fechar: boolean): LoteFrame[] | null {
  const { anel, o } = c, n = anel.length, A = o.loteMinimoM2, t = o.testada;
  const ocup = ref.lotes.map((l) => ocupar(semFecho(l.anel)));
  const lotesPonta: Record<"ini" | "fim", LoteFrame[]> = { ini: [], fim: [] };
  for (const pt of pontas) {
    const pp = pt.pronta;
    const celPe = celulas(anel, pp.z, ocup, pt.Pe);
    const ct = dividirPonta(pp.fInteiro, faixaExata(anel, pp.z, ocup, celPe), pp.sentido, pt.nFundo, A, t);
    if (!ct) return null;
    const partes = ct.slice(0, -1).map((x, k) => ({ cel: k < pt.nFundo ? pp.inteiro : celPe, u0: Math.min(x, ct[k + 1]), u1: Math.max(x, ct[k + 1]) }));
    // do lado da via de trás para a esquina com a referência (numeração corrida)
    if (pp.sentido < 0) partes.reverse();
    const novos = lotesDaZona(c.glebaGeo, ocup, pp.z, partes, 2);
    lotesPonta[pt.lado].push(...novos);
    for (const l of novos) ocup.push(ocupar(semFecho(l.anel)));
  }
  const laterais = lateraisDaReferencia(anel, ref);
  // vias de trás: os demais trechos, do mais comprido para o mais curto
  const naRef = new Set(ref.arestas), naPonta = new Set(pontas.flatMap((p) => p.arestas));
  const comprimento = (tr: number[]) => tr.reduce((s, i) => s + dist(anel[i], anel[(i + 1) % n]), 0);
  const resto = c.trechos.filter((tr) => !tr.some((i) => naRef.has(i) || naPonta.has(i))).sort((x, y) => comprimento(y) - comprimento(x) || x[0] - y[0]);
  const lotesTras: LoteFrame[] = [];
  const rumo = (i: number) => Math.atan2(anel[(i + 1) % n][1] - anel[i][1], anel[(i + 1) % n][0] - anel[i][0]);
  const giro = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
  for (const tr of resto) {
    // junto de uma faixa de ponta, as laterais acompanham a via da ponta (lotes paralelos aos fundos da faixa)
    const fixo = new Map<number, number>();
    for (const pt of pontas) {
      const pIni = pt.arestas[0], pFim = pt.arestas[pt.arestas.length - 1];
      const depois = (tr[tr.length - 1] + 1) % n === pIni, antes = (pFim + 1) % n === tr[0];
      if (!depois && !antes) continue;
      const alvoTh = depois ? rumo(pIni) : rumo(pFim) + Math.PI;
      const ordem = depois ? [...tr].reverse() : tr;
      for (const i of ordem) {
        if (Math.abs(giro(rumo(i) - rumo(ordem[0]))) > Math.PI / 180) break;
        const d = giro(alvoTh - (rumo(i) + Math.PI / 2));
        if (Math.abs(d) > (20 * Math.PI) / 180) break;
        fixo.set(i, d);
      }
    }
    const thAresta = fixo.size ? (i: number, th: number) => th + (fixo.get(i) ?? 0) : undefined;
    const previa = prepararZona(anel, tr, ocup, () => 0.01, 0, thAresta);
    const Lb = Math.max(0, ...previa.alc);
    if (Lb < 1) continue;
    // as laterais não se cruzam antes do fundo livre de cada ponto da via (medido na prévia)
    const pv = previa.am.map((a, k) => ({ s: a.s, h: previa.alc[k] }));
    const alcEm = (s: number) => {
      let lo = 0, hi = pv.length - 1;
      if (s <= pv[0].s) return pv[0].h;
      if (s >= pv[hi].s) return pv[hi].h;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pv[m].s <= s) lo = m; else hi = m; }
      return Math.max(pv[lo].h, pv[hi].h);
    };
    const z = prepararZona(anel, tr, ocup, (s) => Math.max(3, alcEm(s)) * 1.1, Lb, thAresta);
    const cel = celulas(anel, z, ocup, Infinity);
    const fz = faixaExata(anel, z, ocup, cel);
    let ct = dividirPontas(fz, A, t);
    if (!ct) continue;
    // lotes de costas com as laterais na mesma linha das da referência, se isso não custar nenhum lote
    const enc = encaixesDaZona(z, laterais);
    const alinhado = enc.length ? dividirPontas(fz, A, t, enc, 0.15) : null;
    if (alinhado && alinhado.length >= ct.length) ct = alinhado;
    const novos = lotesDaZona(c.glebaGeo, ocup, z, ct.slice(0, -1).map((x, k) => ({ cel, u0: x, u1: ct[k + 1] })), 1);
    lotesTras.push(...novos.reverse());
    for (const l of novos) ocup.push(ocupar(semFecho(l.anel)));
  }
  // numeração como no aprovado: a via de trás a partir da ponta final, a faixa da ponta inicial e a referência
  let lotes = [...lotesPonta.fim, ...lotesTras, ...lotesPonta.ini, ...ref.lotes];
  // fechamento: pedaços soltos viram lote (se têm frente e área) ou vão para o vizinho — 100% da gleba
  const completar = fechar ? c.completar : undefined;
  if (completar) lotes = completar([...anel, anel[0]], lotes, o);
  lotes = lotes.map((l, i) => {
    const frente = frenteReal(anel, l.anel);
    return { ...l, ordem: i, testada: frente, profundidadeMedia: l.area / Math.max(frente, EPS) };
  });
  const soma = lotes.reduce((x, l) => x + l.area, 0), areaGleba = Math.abs(areaAssinada(anel));
  if (soma > areaGleba + 0.5 || (completar && soma < areaGleba - 0.5)) return null;
  if (lotes.some((l) => l.area < A - 0.001 || (l.testada ?? 0) < t - 0.01)) return null;
  return lotes;
}

/** Arestas (no anel anti-horário) de cada via candidata a referência: sequências contíguas de trechos. */
function candidatas(trechos: number[][]): number[][] {
  const N = trechos.length, out: number[][] = [];
  for (let i = 0; i < N; i++) for (let k = 1; k < N; k++) {
    const arestas: number[] = [];
    for (let j = 0; j < k; j++) arestas.push(...trechos[(i + j) % N]);
    out.push(arestas);
  }
  return out;
}

export interface ResultadoFaixas { lotes: LoteFrame[]; chave: string; profundidadeRef: number; arestasRef: number[] }

/**
 * Busca o desmembramento em faixas: cada via (ou sequência de trechos) como referência, com
 * P = metade da largura de referência (a profundidade informada é só a 2ª tentativa, nunca um limite). `trechos` usa os
 * índices do anel recebido. Com `completar` (fechamento dos 100%), devolve só a melhor, já fechada e conferida;
 * sem ele, todas as variações, da maior quantidade de lotes para a menor.
 */
export function buscarFaixas(anelFechado: Position[], trechos: number[][], o: OpcoesFaixas, completar?: Completar): ResultadoFaixas[] {
  const v = anelFechado.slice(0, -1).map((p) => [p[0], p[1]] as P2);
  const n = v.length;
  if (n < 3 || trechos.length < 2) return [];
  const ccw = areaAssinada(v) > 0;
  // anel anti-horário: índice de aresta i (de v[i] a v[i+1]) vira n−1−i (de v'[n−1−i] a v'[n−i])
  const anel = ccw ? v : [...v].reverse();
  const mapa = (i: number) => (ccw ? i : n - 1 - i);
  const tr = ccw ? trechos : [...trechos].reverse().map((c) => [...c].reverse().map(mapa));
  const glebaGeo = poligonoGeo(anel);
  if (!glebaGeo) return [];
  const c: Contexto = { anel, glebaGeo, trechos: tr, o, completar };
  const A = o.loteMinimoM2, teto = Math.floor(Math.abs(areaAssinada(anel)) / A + 1e-9);
  const larg = larguraReferencia(anel, 2 * o.testada);
  const Ps: number[] = [];
  // só a frente e a área mínimas são restrição: a profundidade informada é apenas a 2ª referência de fundo
  if (larg) Ps.push(larg.w / 2);
  if (!Ps.some((p) => Math.abs(p - o.profundidade) < 0.01)) Ps.push(o.profundidade);
  type PontaEscolhida = Ponta & { pronta: PontaPronta };
  type Item = ResultadoFaixas & { regulares: number; maior: number; ref: Referencia; ordemP: number; pontas: PontaEscolhida[]; sufixo: string };
  const res: Item[] = [];
  const nome = (arestas: number[]) => arestas.map(mapa).join(",");
  const item = (lotes: LoteFrame[], ref: Referencia, ordemP: number, sufixo: string, pontas: PontaEscolhida[]): Item => ({
    lotes, ref, ordemP, pontas, sufixo, profundidadeRef: ref.P, arestasRef: ref.arestas.map(mapa),
    regulares: lotes.filter((l) => Math.abs(l.area - A) < 0.5).length, maior: Math.max(...lotes.map((l) => l.area)),
    chave: `faixas|P${ref.P.toFixed(2)}|${nome(ref.arestas)}${sufixo}`,
  });
  // melhor: mais lotes; depois o fundo da regra (metade da largura), nenhum lote muito acima da mínima (15%),
  // mais lotes regulares e a menor sobra num lote só
  const ordenar = () => res.sort((x, y) => y.lotes.length - x.lotes.length || x.ordemP - y.ordemP || Number(x.maior > 1.15 * A + 0.5) - Number(y.maior > 1.15 * A + 0.5) || y.regulares - x.regulares || x.maior - y.maior || (x.chave < y.chave ? -1 : 1));
  for (let ordemP = 0; ordemP < Ps.length; ordemP++) {
    const P = Ps[ordemP];
    if (P * o.testada < A * 0.25) continue;
    if (res.length && res[0].lotes.length >= teto) break; // já no teto ⌊área ÷ mínimo⌋: não há o que melhorar
    const bases: Item[] = [];
    for (const arestas of candidatas(tr)) {
      // lotes de costas entre as duas divisas paralelas: a referência é a via de uma delas (e só de uma)
      if (larg && ordemP === 0 && arestas.includes(larg.arestas[0]) === arestas.includes(larg.arestas[1])) continue;
      const ref = implantarReferencia(anel, glebaGeo, arestas, o, P);
      const lotes = ref && montar(c, ref, [], false);
      if (ref && lotes) bases.push(item(lotes, ref, ordemP, "", []));
    }
    res.push(...bases);
    // faixas de ponta (vias que cruzam as pontas da referência) nas duas melhores referências
    bases.sort((x, y) => y.lotes.length - x.lotes.length || y.regulares - x.regulares);
    const noTeto = () => res.some((x) => x.lotes.length >= teto && x.maior <= 1.15 * A + 0.5);
    for (const b of bases.slice(0, 2)) {
      if (noTeto()) break;
      const prim = b.ref.arestas[0], ult = b.ref.arestas[b.ref.arestas.length - 1];
      const trIni = tr.find((x) => x.includes((prim - 1 + n) % n)), trFim = tr.find((x) => x.includes((ult + 1) % n));
      const opcoes = (arestas: number[] | undefined, lado: "ini" | "fim"): PontaEscolhida[] => {
        if (!arestas || b.ref.arestas.some((i) => arestas.includes(i))) return [];
        const pronta = prepararPonta(c, b.ref, arestas, lado);
        const out: PontaEscolhida[] = [];
        for (let nFundo = 0; nFundo <= 3; nFundo++) {
          const f = fundoDaPonta(c, b.ref, pronta, nFundo);
          if (f) out.push({ arestas, lado, nFundo, Pe: f.Pe, pronta });
        }
        return out;
      };
      const opIni = opcoes(trIni, "ini");
      const rotulo = (p: Ponta) => `${nome(p.arestas)}@${p.Pe.toFixed(2)}+${p.nFundo}`;
      const melhorDe = (ops: PontaEscolhida[]) => {
        let melhor: { p: PontaEscolhida; it: Item } | null = null;
        for (const p of ops) {
          const lotes = montar(c, b.ref, [p], false);
          if (!lotes) continue;
          const it = item(lotes, b.ref, ordemP, `|pontas:${rotulo(p)}`, [p]);
          res.push(it);
          if (!melhor || it.lotes.length > melhor.it.lotes.length || (it.lotes.length === melhor.it.lotes.length && it.maior < melhor.it.maior)) melhor = { p, it };
        }
        return melhor;
      };
      const mi = melhorDe(opIni);
      if (noTeto()) break;
      const mf = melhorDe(trFim !== trIni ? opcoes(trFim, "fim") : []);
      if (mi && mf && !noTeto()) {
        const lotes = montar(c, b.ref, [mi.p, mf.p], false);
        if (lotes) res.push(item(lotes, b.ref, ordemP, `|pontas:${rotulo(mi.p)}+${rotulo(mf.p)}`, [mi.p, mf.p]));
      }
    }
    ordenar();
  }
  ordenar();
  // fechamento (100% da gleba) e conferência final só da melhor: a busca compara as variações antes de fechar
  if (!completar) return res.map(({ lotes, chave, profundidadeRef, arestasRef }) => ({ lotes, chave, profundidadeRef, arestasRef }));
  for (const r of res) {
    const lotes = montar(c, r.ref, r.pontas, true);
    if (lotes && lotes.length >= r.lotes.length) return [{ lotes, chave: r.chave, profundidadeRef: r.profundidadeRef, arestasRef: r.arestasRef }];
  }
  return [];
}
