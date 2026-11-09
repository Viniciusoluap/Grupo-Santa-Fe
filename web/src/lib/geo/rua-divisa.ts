// Rua Simples com VIA QUE ACOMPANHA A DIVISA (traçado curvo).
//
// A via segue uma sequência contínua de arestas da poligonal (por exemplo um lado curvo
// do KML), com a largura informada pelo usuário, do lado de dentro da gleba. A borda
// interna da via é a linha de frente dos lotes: a cada `testada` metros medidos sobre
// ela, um corte perpendicular à via (bissetriz nos vértices) delimita o lote, que vai
// até a divisa oposta (no máximo 2 × a profundidade informada) e só é aceito com área
// ≥ área mínima — quando não atinge, a frente cresce em múltiplos da testada. Nas curvas
// os lotes ficam em leque; cada lote é recortado pela gleba e subtraído da via e dos lotes
// já implantados, então NÃO há sobreposição por construção.
//
// Busca determinística: trechos contínuos de divisa (quebras em cantos > 60°) e suas
// junções, nos dois sentidos, com duas fases de início. Sem aleatoriedade.

import { difference, featureCollection, intersect, polygon as turfPolygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { areaPlanar, pontoDentro, type ImplantacaoFrame, type LoteFrame, type Ret } from "./geometria-parcelamento";

type Geo = Feature<Polygon | MultiPolygon>;
type V = [number, number];

export interface OpcoesViaDivisa {
  testada: number;
  profundidade: number;
  via: number;
  loteMinimoM2: number;
  /** Modo manual da área viária: comprimento máximo da via (m). */
  limiteComprimentoM?: number;
}

export interface ImplantacaoViaDivisa extends ImplantacaoFrame {
  /** Polígonos da via já recortados pela gleba (traçado livre, não retangular). */
  viasLivres: Position[][];
  arestasDivisa: number[];
  comprimentoViaM: number;
  /** Comprimento total do trecho de divisa disponível para a via. */
  comprimentoDisponivelM: number;
  chave: string;
}

const sub = (a: Position, b: Position): V => [a[0] - b[0], a[1] - b[1]];
const add = (a: Position, b: Position): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Position, k: number): V => [a[0] * k, a[1] * k];
const len = (a: Position) => Math.hypot(a[0], a[1]);
const unit = (a: Position): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };

function areaComSinal(aberto: Position[]): number {
  let s = 0;
  for (let i = 0; i < aberto.length; i++) {
    const a = aberto[i], b = aberto[(i + 1) % aberto.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function poligonos(g: Polygon | MultiPolygon): Position[][][] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}

function areaGeo(g: Polygon | MultiPolygon): number {
  return poligonos(g).reduce((s, rs) => s + areaPlanar(rs[0]) - rs.slice(1).reduce((h, r) => h + areaPlanar(r), 0), 0);
}

/** Interseção das retas (p + t·r) e (q + u·s); null se paralelas. */
function cruzaRetas(p: Position, r: Position, q: Position, s: Position): { t: number; u: number } | null {
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const qp = sub(q, p);
  return { t: (qp[0] * s[1] - qp[1] * s[0]) / den, u: (qp[0] * r[1] - qp[1] * r[0]) / den };
}

/** Trechos contínuos de divisa (quebra em cantos com deflexão > 60°) e junções de dois trechos vizinhos. */
export function cadeiasDeDivisa(anelFechado: Position[], quebraGraus = 60): number[][] {
  const v = anelFechado.slice(0, -1);
  const n = v.length;
  const rumo = (i: number) => { const d = sub(v[(i + 1) % n], v[i]); return Math.atan2(d[1], d[0]); };
  const quebra: boolean[] = [];
  for (let i = 0; i < n; i++) {
    let d = ((rumo(i) - rumo((i - 1 + n) % n)) * 180) / Math.PI;
    d = ((d + 540) % 360) - 180;
    quebra[i] = Math.abs(d) > quebraGraus; // quebra NO vértice i (entre a aresta i-1 e a aresta i)
  }
  const inicios = quebra.map((q, i) => (q ? i : -1)).filter((i) => i >= 0);
  const trechos: number[][] = [];
  if (inicios.length === 0) {
    trechos.push(Array.from({ length: n - 1 }, (_, i) => i)); // anel suave: tudo menos uma aresta
  } else {
    for (let k = 0; k < inicios.length; k++) {
      const a = inicios[k], b = inicios[(k + 1) % inicios.length];
      const arestas: number[] = [];
      for (let i = a; i !== b || arestas.length === 0; i = (i + 1) % n) { arestas.push(i); if (arestas.length > n) break; }
      trechos.push(arestas);
    }
  }
  const cadeias: number[][] = [...trechos];
  if (trechos.length > 1) {
    for (let k = 0; k < trechos.length; k++) {
      const junta = [...trechos[k], ...trechos[(k + 1) % trechos.length]];
      if (junta.length < n) cadeias.push(junta);
    }
  }
  return cadeias;
}

/** Arestas seguem a ordem do mesmo anel, independentemente do sentido de implantação. */
export function divisasOpostas(anel: Position[], referencia: number[], candidata: number[]): boolean {
  if (candidata.some((i) => referencia.includes(i))) return false;
  const direcao = (arestas: number[]) => sub(anel[arestas[arestas.length - 1] + 1], anel[arestas[0]]);
  const a = direcao(referencia), b = direcao(candidata);
  const produto = a[0] * b[0] + a[1] * b[1];
  // Exige que as divisas estejam voltadas em sentidos opostos, com tolerância para curvas.
  return produto < -0.5 * len(a) * len(b);
}

interface Linha { pontos: V[]; normais: V[]; offset: V[]; acum: number[]; total: number }

/** Monta a cadeia (pontos da divisa), as normais para dentro e a borda interna da via (offset com junta em esquadro limitado). */
function montarLinha(v: Position[], arestas: number[], normalDentro: (i: number) => V, w: number, reverso: boolean): Linha {
  const n = v.length;
  let pontos: V[] = [v[arestas[0]] as V, ...arestas.map((i) => v[(i + 1) % n] as V)];
  let normais: V[] = arestas.map(normalDentro);
  if (reverso) { pontos = pontos.reverse(); normais = normais.reverse(); }
  const offset: V[] = [add(pontos[0], mul(normais[0], w))];
  for (let j = 1; j < pontos.length - 1; j++) {
    const a0 = add(pontos[j - 1], mul(normais[j - 1], w)), d0 = sub(pontos[j], pontos[j - 1]);
    const a1 = add(pontos[j], mul(normais[j], w)), d1 = sub(pontos[j + 1], pontos[j]);
    const x = cruzaRetas(a0, d0, a1, d1);
    const p = x ? add(a0, mul(d0, x.t)) : add(pontos[j], mul(unit(add(normais[j - 1], normais[j])), w));
    offset.push(len(sub(p, pontos[j])) > 4 * w + 1e-9 ? add(pontos[j], mul(unit(add(normais[j - 1], normais[j])), w)) : p);
  }
  offset.push(add(pontos[pontos.length - 1], mul(normais[normais.length - 1], w)));
  const acum = [0];
  for (let k = 0; k < offset.length - 1; k++) acum.push(acum[k] + len(sub(offset[k + 1], offset[k])));
  return { pontos, normais, offset, acum, total: acum[acum.length - 1] };
}

function pontoEm(l: Linha, s: number): { p: V; d: V; seg: number } {
  const sCl = Math.min(Math.max(s, 0), l.total);
  let k = 0;
  while (k < l.acum.length - 2 && l.acum[k + 1] < sCl - 1e-9) k++;
  const L = l.acum[k + 1] - l.acum[k] || 1;
  const t = (sCl - l.acum[k]) / L;
  const p = add(l.offset[k], mul(sub(l.offset[k + 1], l.offset[k]), t));
  // corte perpendicular à via; exatamente num vértice usa a bissetriz
  let d = l.normais[k];
  if (Math.abs(sCl - l.acum[k]) < 1e-9 && k > 0) d = unit(add(l.normais[k - 1], l.normais[k]));
  else if (Math.abs(sCl - l.acum[k + 1]) < 1e-9 && k + 1 < l.normais.length) d = unit(add(l.normais[k], l.normais[k + 1]));
  return { p, d, seg: k };
}

function caminho(l: Linha, s0: number, s1: number): V[] {
  const out: V[] = [pontoEm(l, s0).p];
  for (let k = 1; k < l.offset.length - 1; k++) if (l.acum[k] > s0 + 1e-9 && l.acum[k] < s1 - 1e-9) out.push(l.offset[k]);
  out.push(pontoEm(l, s1).p);
  return out;
}

/** Polígono da via de s=0 até sFim (entre a divisa e a borda interna), antes do recorte. */
function poligonoVia(l: Linha, sFim: number, w: number): Position[] {
  const fim = pontoEm(l, sFim);
  const borda: V[] = [];
  const divisa: V[] = [l.pontos[0]];
  for (let k = 1; k <= fim.seg; k++) { borda.push(l.offset[k]); divisa.push(l.pontos[k]); }
  divisa.push(sub(fim.p, mul(l.normais[fim.seg], w)));
  const anel: Position[] = [...divisa, fim.p, ...borda.reverse(), l.offset[0]];
  anel.push(anel[0]);
  return anel;
}

function seguro<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }

/** Arredonda a 0,1 mm e remove vértices repetidos/colineares degenerados — robustez das operações booleanas. */
function limpar(anel: Position[]): Position[] | null {
  const out: Position[] = [];
  for (const p of anel) {
    const q: Position = [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];
    const u = out[out.length - 1];
    if (!u || u[0] !== q[0] || u[1] !== q[1]) out.push(q);
  }
  if (out.length > 1 && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out.length >= 4 && areaPlanar(out) > 1e-6 ? out : null;
}

function bboxDe(a: Position[]): Ret {
  const xs = a.map((p) => p[0]), ys = a.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const tocam = (a: Ret, b: Ret) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);

/** Subtrai do polígono cada área ocupada que o toque. Qualquer falha ⇒ null (o lote é recusado, nunca aceito sem conferir). */
function subtrairOcupados(g: Geo, ocupados: { ret: Ret; f: Feature<Polygon> }[]): Geo | null {
  let atual: Geo | null = g;
  const caixa = bboxDe(poligonos(g.geometry as Polygon | MultiPolygon).flatMap((rs) => rs[0]));
  for (const o of ocupados) {
    if (!atual) return null;
    if (!tocam(caixa, o.ret)) continue;
    let r: Geo | null | undefined;
    try { r = difference(featureCollection([atual, o.f])) as Geo | null; } catch { return null; }
    if (!r) return null; // tudo consumido
    atual = r;
  }
  return atual;
}

/** Implanta os lotes ao longo de uma cadeia de divisa (um sentido, uma fase). */
export function implantarNaDivisa(anelFechado: Position[], arestas: number[], reverso: boolean, fase: number, o: OpcoesViaDivisa, raio = 0): ImplantacaoViaDivisa | null {
  const v = anelFechado.slice(0, -1);
  const n = v.length;
  const ccw = areaComSinal(v) > 0;
  const normalDentro = (i: number): V => { const u = unit(sub(v[(i + 1) % n], v[i])); return ccw ? [-u[1], u[0]] : [u[1], -u[0]]; };
  const l = montarLinha(v, arestas, normalDentro, o.via, reverso);
  if (l.total < o.testada) return null;
  const gleba = turfPolygon([anelFechado]);
  const limite = Math.min(l.total, o.limiteComprimentoM ?? Infinity);
  const anelVia = limpar(poligonoVia(l, l.total, o.via));
  const viaToda = anelVia ? seguro(() => intersect(featureCollection([turfPolygon([anelVia]), gleba]))) : null;
  if (!viaToda) return null;
  const ocupados: { ret: Ret; f: Feature<Polygon> }[] = poligonos(viaToda.geometry as Polygon | MultiPolygon)
    .map((rs) => limpar(rs[0])).filter((a): a is Position[] => !!a).map((a) => ({ ret: bboxDe(a), f: turfPolygon([a]) }));
  const Lmax = 2 * o.profundidade;
  const minArea = Math.max(o.loteMinimoM2, 1);
  const lotes: LoteFrame[] = [];
  // Cabeceiras: o primeiro/último lote pode seguir a divisa vizinha à via (absorve o triângulo
  // que o corte perpendicular deixaria sem dono quando a cabeceira da gleba é inclinada).
  const seq = [arestas[0], ...arestas.map((i) => (i + 1) % n)];
  if (reverso) seq.reverse();
  const vizinho = (i: number, outro: number) => { const a = (i - 1 + n) % n, b = (i + 1) % n; return a === outro ? b : a; };
  const vIni = v[seq[0]] as V, vFim = v[seq[seq.length - 1]] as V;
  const eIni = unit(sub(v[vizinho(seq[0], seq[1])], vIni));
  const eFim = unit(sub(v[vizinho(seq[seq.length - 1], seq[seq.length - 2])], vFim));
  /**
   * Direção do corte entre lotes no ponto s da via. Sem leque (raio 0): perpendicular à via
   * (bissetriz nos vértices). Com leque: gira gradualmente ±raio em torno de cada vértice e,
   * nas pontas, da divisa da cabeceira até a perpendicular — lotes em leque nas curvas.
   */
  const direcao = (sPos: number): V => {
    const base = pontoEm(l, sPos);
    if (raio <= 0) return base.d;
    let d: V = l.normais[base.seg];
    for (let k = 1; k < l.offset.length - 1; k++) {
      const dv = sPos - l.acum[k];
      if (Math.abs(dv) < raio) { const t = (dv + raio) / (2 * raio); d = unit(add(mul(l.normais[k - 1], 1 - t), mul(l.normais[k], t))); }
    }
    if (sPos < raio) { const t = sPos / raio; d = unit(add(mul(eIni, 1 - t), mul(d, t))); }
    if (l.total - sPos < raio) { const t = (l.total - sPos) / raio; d = unit(add(mul(eFim, 1 - t), mul(d, t))); }
    return d;
  };
  /** Lote entre s0 e s1 (frente sobre a via), recortado pela gleba e livre de via/lotes; null se inviável. */
  const loteEntre = (s0: number, s1: number, ponta: { ini?: boolean; fim?: boolean } = {}): { anel: Position[]; area: number; frente: number } | null => {
    const a = { p: pontoEm(l, s0).p, d: direcao(s0) }, b = { p: pontoEm(l, s1).p, d: direcao(s1) };
    const frente = caminho(l, s0, s1);
    const fa = add(a.p, mul(a.d, Lmax)), fb = add(b.p, mul(b.d, Lmax));
    let fundo: V[];
    let inicio: V[] = [];
    if (ponta.ini || ponta.fim) {
      const f1 = ponta.fim ? add(vFim, mul(eFim, Lmax)) : fb;
      const f0 = ponta.ini ? add(vIni, mul(eIni, Lmax)) : fa;
      if (ponta.ini) inicio = [vIni];
      fundo = [...(ponta.fim ? [vFim] : []), f1, f0];
    } else {
      const x = cruzaRetas(a.p, mul(a.d, Lmax), b.p, mul(b.d, Lmax));
      fundo = x && x.t > 0 && x.t < 1 && x.u > 0 && x.u < 1 ? [add(a.p, mul(a.d, Lmax * x.t))] : [fb, fa];
    }
    const contorno = [...inicio, ...frente, ...fundo];
    const anelQ = limpar([...contorno, contorno[0]]);
    if (!anelQ) return null;
    const recorte = seguro(() => intersect(featureCollection([turfPolygon([anelQ]), gleba])));
    if (!recorte) return null;
    const livre = subtrairOcupados(recorte as Geo, ocupados);
    if (!livre) return null;
    // fica só a parte encostada na frente (no meio da frente, logo para dentro do lote)
    const meio = pontoEm(l, (s0 + s1) / 2);
    const teste = add(meio.p, mul(add(a.d, b.d).every((c) => Math.abs(c) < 1e-9) ? meio.d : unit(add(a.d, b.d)), 0.05));
    const peca = poligonos(livre.geometry as Polygon | MultiPolygon).find((rs) => pontoDentro(rs[0], teste[0], teste[1]));
    if (!peca || peca.length > 1) return null; // furo no lote = geometria inválida para venda
    const anel = limpar(peca[0]);
    if (!anel) return null;
    // FRENTE EFETIVA: o recorte (divisa côncava, via, lotes vizinhos) pode encurtar a frente
    // nominal s1 − s0; mede-se por amostragem (a cada ≤ 25 cm) o trecho da borda da via que
    // continua encostado no lote.
    const n = Math.max(4, Math.ceil((s1 - s0) / 0.25));
    let dentro = 0;
    for (let i = 0; i < n; i++) {
      const sx = s0 + ((i + 0.5) / n) * (s1 - s0);
      const px = pontoEm(l, sx).p, dx = direcao(sx);
      const q = add(px, mul(dx, 0.02));
      if (pontoDentro(anel, q[0], q[1])) dentro++;
    }
    return { anel, area: areaPlanar(anel), frente: (dentro / n) * (s1 - s0) };
  };
  const valido = (x: { area: number; frente: number } | null): x is { anel: Position[]; area: number; frente: number } =>
    !!x && x.area >= minArea && x.frente >= o.testada - 1e-6;

  let s0 = fase, sUltimo = 0, ordem = 0, s0Ultimo = 0;
  const maxFrente = 4 * o.testada;
  while (s0 + o.testada <= limite + 1e-9) {
    // frente MÍNIMA (≥ testada informada) que atinge a área mínima: testada exata quando basta;
    // senão busca binária até 4 × a testada (nos trechos rasos, perto das cabeceiras)
    let s1 = s0 + o.testada;
    const primeiro = lotes.length === 0 && s0 === 0;
    const pontaIni = primeiro ? { ini: true } : {};
    let lote = (primeiro ? loteEntre(s0, s1, pontaIni) : null) ?? loteEntre(s0, s1);
    if (!valido(lote)) {
      const sMax = Math.min(s0 + maxFrente, limite);
      const tenta = (sx: number) => (primeiro ? loteEntre(s0, sx, pontaIni) : null) ?? loteEntre(s0, sx);
      const loteMax = sMax > s1 + 1e-9 ? tenta(sMax) : null;
      if (valido(loteMax)) {
        let lo = s1, hi = sMax, melhor = { s: sMax, l: loteMax };
        for (let it = 0; it < 10; it++) {
          const mid = (lo + hi) / 2;
          const lm = tenta(mid);
          if (valido(lm)) { hi = mid; melhor = { s: mid, l: lm }; } else lo = mid;
        }
        // arredonda a frente para cima em centímetros (medida de projeto)
        const sCm = Math.min(sMax, s0 + Math.ceil((melhor.s - s0) * 100) / 100);
        const lCm = tenta(sCm);
        s1 = valido(lCm) ? sCm : melhor.s;
        lote = valido(lCm) ? lCm : melhor.l;
      } else {
        lote = null;
      }
    }
    if (valido(lote)) {
      const ret = bboxDe(lote.anel);
      // testada registrada = frente EFETIVA (após o recorte), nunca a nominal
      lotes.push({ anel: lote.anel, area: lote.area, ret, linha: 0, faixa: 0, segmento: 0, ordem: ordem++, testada: lote.frente, profundidadeMedia: lote.area / lote.frente });
      ocupados.push({ ret, f: turfPolygon([lote.anel]) });
      s0Ultimo = s0;
      s0 = s1;
      sUltimo = s1;
    } else {
      s0 += o.testada; // trecho sem lote viável: segue a via
    }
  }
  if (lotes.length === 0) return null;
  // Último lote: se o que sobra da via até o fim da divisa não comporta outro lote, ele vai até a
  // cabeceira seguindo a divisa vizinha (sem criar lote novo, sem deixar triângulo sem dono).
  if (o.limiteComprimentoM === undefined && l.total - sUltimo > 1e-6 && l.total - sUltimo < o.testada + 1e-9) {
    const ultimo = lotes[lotes.length - 1];
    const s0u = s0Ultimo; // início NOMINAL do último lote na via
    ocupados.pop();
    const ext = loteEntre(s0u, l.total, { fim: true, ini: lotes.length === 1 && s0u === 0 });
    if (valido(ext) && ext.area >= ultimo.area) {
      const ret = bboxDe(ext.anel);
      lotes[lotes.length - 1] = { ...ultimo, anel: ext.anel, area: ext.area, ret, testada: ext.frente, profundidadeMedia: ext.area / ext.frente };
      ocupados.push({ ret, f: turfPolygon([ext.anel]) });
      sUltimo = l.total;
    } else {
      ocupados.push({ ret: ultimo.ret, f: turfPolygon([ultimo.anel]) });
    }
  }
  const sFimVia = o.limiteComprimentoM !== undefined ? limite : sUltimo;
  const anelViaFinal = limpar(poligonoVia(l, sFimVia, o.via));
  const via = anelViaFinal ? seguro(() => intersect(featureCollection([turfPolygon([anelViaFinal]), gleba]))) : null;
  const viasLivres = via ? poligonos(via.geometry as Polygon | MultiPolygon).map((rs) => rs[0]) : [];
  return {
    lotes, corredores: [], baloes: [], viasLivres, candidatos: lotes.length,
    limitacoes: [
      `Via acompanha a divisa (traçado curvo) com ${o.via.toLocaleString("pt-BR")} m de largura, do lado de dentro da gleba; lotes com frente mínima de ${o.testada.toLocaleString("pt-BR")} m sobre a via (maior só onde a faixa não atinge a área mínima), fundo até a divisa oposta (máx. ${(2 * o.profundidade).toLocaleString("pt-BR")} m) e área ≥ ${minArea.toLocaleString("pt-BR")} m². Nas curvas os lotes ficam em leque.`,
      "Rua Simples não inclui balão de retorno; o acesso externo ocorre pelo início da via na divisa e deve ser confirmado em projeto.",
    ],
    arestasDivisa: arestas, comprimentoViaM: sFimVia, comprimentoDisponivelM: l.total,
    chave: `div|${arestas.join(",")}|${reverso ? "r" : "d"}|${fase}|r${raio}`,
  };
}

/** Varre as cadeias de divisa nos dois sentidos e duas fases; devolve as melhores implantações (determinístico). */
export function buscarViaDivisa(anelFechado: Position[], o: OpcoesViaDivisa, max = 12, onProgress?: (fracao: number) => void): ImplantacaoViaDivisa[] {
  const out: ImplantacaoViaDivisa[] = [];
  const cadeias = cadeiasDeDivisa(anelFechado);
  const total = cadeias.length * 4 + 16;
  let feitos = 0;
  const avancar = () => onProgress?.(Math.min(1, ++feitos / total));
  for (const arestas of cadeias) {
    for (const reverso of [false, true]) {
      for (const fase of [0, o.testada / 2]) {
        const r = implantarNaDivisa(anelFechado, arestas, reverso, fase, o);
        if (r) out.push(r);
        avancar();
      }
    }
  }
  const areaVia = (r: ImplantacaoViaDivisa) => r.viasLivres.reduce((s, a) => s + areaPlanar(a), 0);
  const ordenar = (lista: ImplantacaoViaDivisa[]) =>
    lista.sort((a, b) => b.lotes.length - a.lotes.length || areaVia(a) - areaVia(b) || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
  ordenar(out);
  // refino: lotes em leque nas curvas/cabeceiras para as 4 melhores configurações
  const base = out.slice(0, 4).map((r) => r.chave.split("|"));
  for (const [, ar, sentido, fase] of base) {
    for (const raio of [o.testada, 2 * o.testada, 4 * o.testada, 8 * o.testada]) {
      const r = implantarNaDivisa(anelFechado, ar.split(",").map(Number), sentido === "r", Number(fase), o, raio);
      if (r) out.push(r);
      avancar();
    }
  }
  return ordenar(out).slice(0, max);
}

export { areaGeo as _areaGeo };
