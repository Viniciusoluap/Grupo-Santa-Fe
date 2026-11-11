// Tipologia "VIAS PÚBLICAS": desmembramento de terreno cujas divisas JÁ são vias públicas.
//
// 1º) Desmembramento "em faixas" (vias-publicas-faixas.ts), como nos projetos aprovados: uma via de referência com
//     lotes de fundo fixo (metade da largura entre as divisas paralelas), lotes de costas na via de trás e uma
//     faixa de lotes de frente para a via da ponta. Vale quando rende pelo menos tantos lotes quanto o 2º.
// 2º) Motor por trechos (abaixo), mantido como alternativa:
//
// Não há via interna: toda divisa (do lado de fora e do lado de dentro, como a de uma rua com
// balão que entra no terreno) é frente de lote. Os lotes são implantados ao longo de cada trecho
// da divisa (quebras em cantos vivos), com frente ≥ testada sobre a via, fundo até a profundidade
// informada e área ≥ mínima (a frente cresce onde a faixa é rasa). Depois, toda sobra é
// incorporada: o que tem frente e área próprias vira lote; o resto é anexado ao lote vizinho —
// 100% de aproveitamento. Determinístico.

import { difference, featureCollection, polygon as turfPolygon, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { areaPlanar, type LoteFrame, type Ret } from "./geometria-parcelamento";
import { dividirZonaPorArea, implantarNaDivisa, type ImplantacaoViaDivisa } from "./rua-divisa";
import { buscarFaixas, type ResultadoFaixas } from "./vias-publicas-faixas";

export interface OpcoesViasPublicas { testada: number; profundidade: number; loteMinimoM2: number }

type Geo = Feature<Polygon | MultiPolygon>;
const comprimento = (a: Position, b: Position) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const poligonos = (g: Polygon | MultiPolygon): Position[][][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const bbox = (a: Position[]): Ret => {
  const xs = a.map((p) => p[0]), ys = a.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
function seguro<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }

/** Trechos contínuos da divisa (quebra nos cantos com deflexão > `quebraGraus`). Anel suave: duas metades. */
export function trechosDaDivisa(anelFechado: Position[], quebraGraus = 45): number[][] {
  const v = anelFechado.slice(0, -1);
  const n = v.length;
  const rumo = (i: number) => Math.atan2(v[(i + 1) % n][1] - v[i][1], v[(i + 1) % n][0] - v[i][0]);
  const quebras: number[] = [];
  for (let i = 0; i < n; i++) {
    let d = ((rumo(i) - rumo((i - 1 + n) % n)) * 180) / Math.PI;
    d = ((d + 540) % 360) - 180;
    if (Math.abs(d) > quebraGraus) quebras.push(i);
  }
  if (quebras.length === 0) {
    const meio = Math.floor(n / 2);
    return [Array.from({ length: meio }, (_, i) => i), Array.from({ length: n - meio }, (_, i) => meio + i)];
  }
  const out: number[][] = [];
  for (let k = 0; k < quebras.length; k++) {
    const a = quebras[k], b = quebras[(k + 1) % quebras.length];
    const arestas: number[] = [];
    for (let i = a; i !== b || arestas.length === 0; i = (i + 1) % n) { arestas.push(i); if (arestas.length > n) break; }
    out.push(arestas);
  }
  return out;
}

/** Distância do ponto ao contorno da gleba. */
function distContorno(anel: Position[], p: Position): number {
  let m = Infinity;
  for (let i = 0; i < anel.length - 1; i++) {
    const a = anel[i], b = anel[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    m = Math.min(m, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return m;
}

function distSegmento(a: Position, b: Position, p: Position): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Comprimento do contorno da peça que coincide com a divisa da gleba (= frente para a via pública). */
export function frenteNaDivisa(gleba: Position[], peca: Position[]): number {
  let f = 0;
  for (let i = 0; i < peca.length - 1; i++) {
    const a = peca[i], b = peca[i + 1];
    const meio: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (distContorno(gleba, a) < 0.05 && distContorno(gleba, b) < 0.05 && distContorno(gleba, meio) < 0.05) f += comprimento(a, b);
  }
  return f;
}

/** Incorpora toda a sobra: vira lote quando tem frente e área próprias; senão vai para o lote vizinho. */
export function completarAproveitamento(gleba: Position[], lotes: LoteFrame[], o: OpcoesViasPublicas): LoteFrame[] {
  if (lotes.length === 0) return lotes;
  const glebaF = turfPolygon([gleba]);
  const uniao = seguro(() => (lotes.length === 1 ? turfPolygon([lotes[0].anel]) : union(featureCollection(lotes.map((l) => turfPolygon([l.anel]))))));
  if (!uniao) return lotes;
  let sobra = seguro(() => difference(featureCollection([glebaF, uniao as Geo])) as Geo | null);
  if (sobra === null) {
    // falha numérica do recorte de uma vez só: desconta por grupos de lotes vizinhos na numeração (e lote a lote no
    // grupo que falhar); se ainda falhar, fica como está — nunca sobrepõe ninguém
    let resto: Geo | null = glebaF;
    const descontar = (fs: Geo[]) => {
      if (!resto) return;
      const u = fs.length === 1 ? fs[0] : (union(featureCollection(fs)) as Geo | null);
      if (u) resto = difference(featureCollection([resto, u])) as Geo | null;
    };
    try {
      for (let i = 0; i < lotes.length && resto; i += 8) {
        const grupo = lotes.slice(i, i + 8).map((l) => turfPolygon([l.anel]) as Geo);
        const antes: Geo = resto;
        try { descontar(grupo); } catch { resto = antes; for (const f of grupo) descontar([f]); }
      }
    } catch { return lotes; }
    sobra = resto;
  }
  if (!sobra) return lotes;
  const pecas = poligonos(sobra.geometry as Polygon | MultiPolygon).map((rs) => rs[0]).filter((a) => areaPlanar(a) > 0.01)
    .sort((a, b) => areaPlanar(b) - areaPlanar(a));
  const out = lotes.map((l) => ({ ...l }));
  for (const peca of pecas) {
    const area = areaPlanar(peca);
    const frente = frenteNaDivisa(gleba, peca);
    if (area >= o.loteMinimoM2 && frente >= o.testada - 1e-6) {
      out.push({ anel: peca, area, ret: bbox(peca), linha: 0, faixa: 0, segmento: 0, ordem: out.length, testada: frente, profundidadeMedia: area / frente });
      continue;
    }
    // vizinho: o lote cuja união com a peça é um polígono só (encostam); fica com o menor deles
    const rp = bbox(peca);
    let melhor: { i: number; anel: Position[] } | null = null;
    out.forEach((l, i) => {
      if (l.ret[2] < rp[0] - 0.01 || rp[2] < l.ret[0] - 0.01 || l.ret[3] < rp[1] - 0.01 || rp[3] < l.ret[1] - 0.01) return;
      const u = seguro(() => union(featureCollection([turfPolygon([l.anel]), turfPolygon([peca])])));
      if (!u || u.geometry.type !== "Polygon" || u.geometry.coordinates.length > 1) return;
      if (!melhor || out[melhor.i].area > l.area) melhor = { i, anel: u.geometry.coordinates[0] };
    });
    const m = melhor as { i: number; anel: Position[] } | null;
    if (m) {
      const novo = areaPlanar(m.anel);
      const t = out[m.i].testada ?? o.testada;
      // frente atualizada calculada uma vez e usada também na profundidade média (o desenho usa as duas)
      const frente = Math.max(t, frenteNaDivisa(gleba, m.anel) || t);
      out[m.i] = { ...out[m.i], anel: m.anel, area: novo, ret: bbox(m.anel), testada: frente, profundidadeMedia: novo / Math.max(frente, 1e-9) };
    }
  }
  return out.map((l, i) => ({ ...l, ordem: i }));
}

/** Comprimento da borda comum entre a peça e o lote (arestas da peça que estão sobre o contorno do lote). */
function bordaComum(lote: Position[], peca: Position[]): number {
  let f = 0;
  for (let i = 0; i < peca.length - 1; i++) {
    const a = peca[i], b = peca[i + 1];
    const meio: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (distContorno(lote, meio) < 0.05) f += comprimento(a, b);
  }
  return f;
}

const paraLote = (anel: Position[], frente: number): LoteFrame => {
  const area = areaPlanar(anel);
  return { anel, area, ret: bbox(anel), linha: 0, faixa: 0, segmento: 0, ordem: 0, testada: frente, profundidadeMedia: area / Math.max(frente, 1e-9) };
};

/**
 * Fecha os 100%: cada sobra vira lote (se tem frente e área próprias) ou entra na ZONA do trecho com quem divide a
 * maior borda; cada zona contínua é então redividida em N lotes de área igual (N = área ÷ mínimo, o maior que
 * respeita área e frente mínimas). Se a redivisão não fechar, a sobra é anexada ao lote vizinho.
 */
function consolidarZonas(gleba: Position[], lotes: LoteFrame[], doTrecho: number[], trechos: number[][], sentido: boolean[], o: OpcoesViasPublicas):
  { estimativa: number; finalizar: (maxParticoes: number) => LoteFrame[] } {
  if (lotes.length === 0) return { estimativa: 0, finalizar: () => lotes };
  const glebaF = turfPolygon([gleba]);
  const uniao = seguro(() => (lotes.length === 1 ? turfPolygon([lotes[0].anel]) : union(featureCollection(lotes.map((l) => turfPolygon([l.anel]))))));
  const sobra = uniao ? seguro(() => difference(featureCollection([glebaF, uniao as Geo])) as Geo | null) : null;
  // inclui as frestas de arredondamento entre lotes vizinhos: sem elas a zona de um trecho se parte em pedaços
  const pecas = sobra ? poligonos(sobra.geometry as Polygon | MultiPolygon).map((rs) => rs[0]).filter((a) => areaPlanar(a) > 1e-9) : [];
  const proprios: LoteFrame[] = [];
  const orfas: Position[][] = [];
  // frente de um polígono em cada trecho da divisa (arestas sobre a divisa de cada trecho)
  const frentePorTrecho = (anel: Position[]) => {
    const f = trechos.map(() => 0);
    for (let i = 0; i < anel.length - 1; i++) {
      const a = anel[i], b = anel[i + 1];
      const meio: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      trechos.forEach((tr, k) => {
        if (tr.some((e) => distSegmento(gleba[e], gleba[e + 1], meio) < 0.05 && distSegmento(gleba[e], gleba[e + 1], a) < 0.05 && distSegmento(gleba[e], gleba[e + 1], b) < 0.05)) f[k] += comprimento(a, b);
      });
    }
    return f;
  };
  const argmax = (xs: number[]) => xs.reduce((m, f, k) => (f > xs[m] ? k : m), 0);
  // cada LOTE pertence ao trecho em que tem a maior frente (um lote de outro trecho que alcançou esta rua muda de zona)
  const trechoDoLote = lotes.map((l, i) => { const f = frentePorTrecho(l.anel); const k = argmax(f); return f[k] > 0.05 ? k : doTrecho[i]; });
  const pecasDoTrecho = trechos.map(() => [] as Position[][]);
  for (const peca of pecas) {
    // toda sobra entra numa zona: com frente → trecho dessa rua; sem frente → maior borda somada com os lotes
    const f = frentePorTrecho(peca);
    const kf = argmax(f);
    if (f[kf] > 0.05) { pecasDoTrecho[kf].push(peca); continue; }
    const bordaPorTrecho = trechos.map(() => 0);
    lotes.forEach((l, i) => { bordaPorTrecho[trechoDoLote[i]] += bordaComum(l.anel, peca); });
    const kb = argmax(bordaPorTrecho);
    if (bordaPorTrecho[kb] > 1e-6) pecasDoTrecho[kb].push(peca); else orfas.push(peca);
  }
  // sobra que é "ponte" entre duas partes da zona de um trecho passa para esse trecho (a zona fica contínua)
  for (let volta = 0; volta < 3; volta++) {
    let mudou = false;
    trechos.forEach((_, k) => {
      const outrosK = [...lotes.filter((_, i) => trechoDoLote[i] !== k).map((l) => l.anel), ...pecasDoTrecho.flatMap((ps, j) => (j === k ? [] : ps)), ...orfas];
      const u = outrosK.length === 0 ? null : outrosK.length === 1 ? turfPolygon([outrosK[0]]) : seguro(() => union(featureCollection(outrosK.map((a) => turfPolygon([a])))));
      const z = u ? seguro(() => difference(featureCollection([glebaF, u as Geo]))) : null;
      if (!z) return;
      const comps = poligonos(z.geometry as Polygon | MultiPolygon).map((rs) => rs[0]).filter((a) => areaPlanar(a) > 0.5)
        .filter((c) => lotes.some((l, i) => trechoDoLote[i] === k && pontoNoAnel(c, centroDe(l.anel))));
      if (comps.length < 2) return;
      pecasDoTrecho.forEach((ps, j) => {
        if (j === k) return;
        for (let q = ps.length - 1; q >= 0; q--) {
          if (comps.filter((c) => bordaComum(c, ps[q]) > 0.01).length > 1) { pecasDoTrecho[k].push(ps[q]); ps.splice(q, 1); mudou = true; }
        }
      });
      for (let q = orfas.length - 1; q >= 0; q--) {
        if (comps.filter((c) => bordaComum(c, orfas[q]) > 0.01).length > 1) { pecasDoTrecho[k].push(orfas[q]); orfas.splice(q, 1); mudou = true; }
      }
    });
    if (!mudou) break;
  }
  const saida: LoteFrame[] = [...proprios];
  const centro = (a: Position[]): Position => a.reduce((s2, p) => [s2[0] + p[0] / a.length, s2[1] + p[1] / a.length], [0, 0]);
  /**
   * Redivide por área a zona de um GRUPO de trechos vizinhos no contorno (frente contínua): a área passa de um
   * trecho para o outro pela esquina, como no projeto — o grupo rende ⌊área ÷ mínimo⌋ lotes, não a soma dos pisos.
   */
  const cache = new Map<string, { lotes: LoteFrame[]; cobertos: Set<number> }>();
  const processarGrupo = (grupo: number[]) => {
    const chave = grupo.join(",");
    const salvo = cache.get(chave);
    if (salvo) return salvo;
    const noGrupo = (k: number) => grupo.includes(k);
    const meusIdx = lotes.map((_, i) => i).filter((i) => noGrupo(trechoDoLote[i]));
    const outros = [...lotes.filter((_, i) => !noGrupo(trechoDoLote[i])).map((l) => l.anel), ...pecasDoTrecho.flatMap((ps, j) => (noGrupo(j) ? [] : ps)), ...orfas];
    const uOutros = outros.length === 0 ? null : outros.length === 1 ? turfPolygon([outros[0]]) : seguro(() => union(featureCollection(outros.map((a) => turfPolygon([a])))));
    // falha numérica na união: não redivide (nunca usar a gleba inteira como zona — sobreporia outros lotes)
    const z = outros.length === 0 ? glebaF : uOutros ? seguro(() => difference(featureCollection([glebaF, uOutros as Geo]))) : null;
    const componentes = z ? poligonos(z.geometry as Polygon | MultiPolygon).map((rs) => rs[0]).filter((a) => areaPlanar(a) > 0.5)
      .filter((c) => meusIdx.some((i) => pontoNoAnel(c, centro(lotes[i].anel)))) : [];
    const arestas = grupo.flatMap((k) => trechos[k]);
    const res: LoteFrame[] = [];
    const cobertos = new Set<number>();
    for (const comp of componentes) {
      const dentro = meusIdx.filter((i) => pontoNoAnel(comp, centro(lotes[i].anel)));
      const area = areaPlanar(comp);
      const sent = grupo.length === 1 ? sentido[grupo[0]] : false;
      const minimos = { areaM2: o.loteMinimoM2, frenteM: o.testada };
      // 1) guloso (cada lote com a área mínima) nos dois sentidos → quantidade máxima
      const teto = Math.floor(area / o.loteMinimoM2 + 1e-9);
      // nos dois sentidos: o resto da ponta cai num lado ou no outro, e isso muda o encaixe com as zonas vizinhas
      let escolha = dividirZonaPorArea(gleba, arestas, sent, comp, 0, minimos, "minimo");
      const outro = dividirZonaPorArea(gleba, arestas, !sent, comp, 0, minimos, "minimo");
      if (outro && (!escolha || outro.length > escolha.length)) escolha = outro;
      // 2) com a mesma quantidade (ou uma a mais, se a área der), tenta área igual entre os lotes — frentes e fundos equilibrados
      for (const nAlvo of Array.from(new Set([teto, escolha?.length ?? 0])).filter((x) => x > 0 && x >= (escolha?.length ?? 0)).sort((a, b) => b - a)) {
        const igual = dividirZonaPorArea(gleba, arestas, sent, comp, nAlvo, minimos) ?? dividirZonaPorArea(gleba, arestas, !sent, comp, nAlvo, minimos);
        if (igual && igual.length >= (escolha?.length ?? 0)) { escolha = igual; break; }
      }
      if (escolha && escolha.length >= dentro.length) {
        escolha.forEach((x) => res.push(paraLote(x.anel, x.frente)));
        dentro.forEach((i) => cobertos.add(i));
      }
    }
    meusIdx.filter((i) => !cobertos.has(i)).forEach((i) => res.push(lotes[i]));
    const r = { lotes: res, cobertos };
    cache.set(chave, r);
    return r;
  };
  // trechos na ordem do contorno e área da zona de cada um (para estimar o rendimento de cada agrupamento)
  const anel = trechos.map((_, k) => k).sort((a, b) => trechos[a][0] - trechos[b][0]);
  const N = anel.length;
  const areaZona = trechos.map((_, k) => lotes.reduce((s2, l, i) => s2 + (trechoDoLote[i] === k ? l.area : 0), 0) + pecasDoTrecho[k].reduce((s2, a) => s2 + areaPlanar(a), 0));
  const particoes: number[][][] = [];
  for (let mask = 1; mask < 1 << N; mask++) {
    // cortes do ciclo entre anel[i] e anel[i+1]; ao menos dois cortes (um grupo só fecharia o anel inteiro)
    const cortes = Array.from({ length: N }, (_, i) => i).filter((i) => mask & (1 << i));
    if (N > 1 && cortes.length < 2) continue;
    const grupos: number[][] = [];
    for (let c = 0; c < cortes.length; c++) {
      const ini = (cortes[c] + 1) % N, fim = cortes[(c + 1) % cortes.length];
      const g: number[] = [];
      for (let i = ini; ; i = (i + 1) % N) { g.push(anel[i]); if (i === fim) break; }
      grupos.push(g);
    }
    particoes.push(grupos);
  }
  const estimar = (gs: number[][]) => gs.reduce((s2, g) => s2 + Math.floor(g.reduce((x, k) => x + areaZona[k], 0) / o.loteMinimoM2 + 1e-9), 0);
  particoes.sort((a, b) => estimar(b) - estimar(a) || b.length - a.length);
  const finalizar = (maxParticoes: number) => {
    let melhor: LoteFrame[] | null = null;
    for (const gs of particoes.slice(0, maxParticoes)) {
      if (melhor && estimar(gs) <= melhor.length) break;
      const lotesP = gs.flatMap((g) => processarGrupo(g).lotes);
      // proteção: soma das áreas não pode passar da gleba (nenhuma sobreposição entre lotes de grupos diferentes)
      if (lotesP.reduce((x, l) => x + l.area, 0) > areaPlanar(gleba) + 0.5) continue;
      if (!melhor || lotesP.length > melhor.length) melhor = lotesP;
    }
    // o que não fechou (zonas sem redivisão, peças órfãs) é anexado ao lote vizinho: 100% de aproveitamento
    return completarAproveitamento(gleba, [...saida, ...(melhor ?? lotes)], o);
  };
  return { estimativa: particoes.length ? estimar(particoes[0]) : lotes.length, finalizar };
}

function centroDe(a: Position[]): Position { return a.reduce((s2, p) => [s2[0] + p[0] / a.length, s2[1] + p[1] / a.length], [0, 0]); }

function pontoNoAnel(anel: Position[], p: Position): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 2; i < anel.length - 1; j = i++) {
    const a = anel[i], b = anel[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro;
  }
  return dentro;
}

/** Desmembra a gleba com frente para as vias públicas existentes. Devolve as melhores variações. */
export function buscarViasPublicas(anelFechado: Position[], o: OpcoesViasPublicas, max = 4, onProgress?: (f: number) => void): ImplantacaoViaDivisa[] {
  // ordem: trechos convexos/retos (do maior para o menor) e, por último, os côncavos — como o contorno de
  // um balão de retorno que entra no terreno, onde os lotes ficam em leque e só ocupam o que sobrou
  // teto absoluto: ⌊área da gleba ÷ área mínima⌋ — ao atingir, não há o que melhorar
  const tetoGleba = Math.floor(areaPlanar(anelFechado) / o.loteMinimoM2 + 1e-9);
  const perimetro = anelFechado.slice(0, -1).reduce((s, p, i) => s + comprimento(p, anelFechado[i + 1]), 0);
  // 1º) em faixas, como no projeto aprovado; se já chega ao teto, é o resultado
  const trechosTodos = trechosDaDivisa(anelFechado);
  const melhorFaixas = seguro(() => buscarFaixas(anelFechado, trechosTodos, o, completarAproveitamento))?.[0] ?? null;
  const emFaixas = (r: ResultadoFaixas): ImplantacaoViaDivisa => ({
    // uma quadra só, numerada na ordem do desmembramento (via de trás, faixa de ponta e via de referência)
    lotes: r.lotes.map((l, i) => ({ ...l, linha: 0, faixa: 0 as const, segmento: 0, ordem: i })),
    corredores: [], baloes: [], viasLivres: [], candidatos: r.lotes.length,
    arestasDivisa: trechosTodos.flat(), comprimentoViaM: 0, comprimentoDisponivelM: perimetro, chave: `vp|${r.chave}`,
    limitacoes: [
      `Vias públicas: todas as divisas da gleba (por fora e por dentro) já são frente para via pública — sem via interna. Desmembramento em faixas, como no projeto aprovado: os lotes da via de referência têm fundo de ${r.profundidadeRef.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m (metade da largura entre as divisas paralelas) e frente = área mínima ÷ fundo; em balão de retorno, a frente fica na mínima e o fundo fecha a área. Os lotes da via de trás ficam de costas para eles, com as laterais na mesma linha onde as vias são paralelas e em leque nas curvas; na ponta, uma faixa de lotes tem frente para a via que cruza. As únicas restrições são área ≥ ${o.loteMinimoM2.toLocaleString("pt-BR")} m² e frente ≥ ${o.testada.toLocaleString("pt-BR")} m: fundo, laterais e frente acima da mínima variam de lote para lote (a profundidade informada é só referência, não é limite). A sobra fica nos lotes de esquina e de curva; nenhum pedaço fica sem dono — 100% de aproveitamento.`,
      "Confirme em projeto que todas as divisas são de fato vias públicas oficiais (testada para logradouro existente).",
    ],
  });
  onProgress?.(0.3);
  if (melhorFaixas && melhorFaixas.lotes.length >= tetoGleba) { onProgress?.(0.95); return [emFaixas(melhorFaixas)]; }
  const v = anelFechado.slice(0, -1), n = v.length;
  let s2 = 0;
  for (let i = 0; i < n; i++) s2 += v[i][0] * v[(i + 1) % n][1] - v[(i + 1) % n][0] * v[i][1];
  const ccw = s2 > 0;
  const rumo = (i: number) => Math.atan2(v[(i + 1) % n][1] - v[i][1], v[(i + 1) % n][0] - v[i][0]);
  const giro = (c: number[]) => {
    let g = 0;
    for (let k = 1; k < c.length; k++) { let d = rumo(c[k]) - rumo(c[k - 1]); d = Math.atan2(Math.sin(d), Math.cos(d)); g += d; }
    return ccw ? g : -g; // > 0: convexo; < 0: côncavo (reentrante)
  };
  const info = trechosDaDivisa(anelFechado)
    .map((c, pos) => ({ c, pos, m: c.reduce((s, i) => s + comprimento(anelFechado[i], anelFechado[i + 1]), 0), concavo: giro(c) < -0.3 }))
    .filter((x) => x.m >= o.testada);
  if (info.length === 0) return melhorFaixas ? [emFaixas(melhorFaixas)] : [];
  const porTamanho = [...info].sort((a, b) => Number(a.concavo) - Number(b.concavo) || b.m - a.m || a.pos - b.pos);
  // 2ª ordem: o maior trecho e depois os vizinhos na sequência do contorno (côncavos sempre por último)
  const k0 = porTamanho[0].pos, N = info.length;
  const porContorno = [...info].sort((a, b) => Number(a.concavo) - Number(b.concavo) || ((a.pos - k0 + N) % N) - ((b.pos - k0 + N) % N));
  const ordens = [porTamanho.map((x) => x.c)];
  if (porContorno.some((x, i) => x !== porTamanho[i])) ordens.push(porContorno.map((x) => x.c));
  const opc = { testada: o.testada, profundidade: o.profundidade, via: 0, loteMinimoM2: o.loteMinimoM2 };
  // fundo até o meio da distância à via oposta (lotes de costas), nunca além de 2 × a profundidade informada
  const extras = (ocupados: Position[][], fracaoFundo: number) => ({ semVia: true, ocupados, fundoAteMeio: true, fundoMaxM: 2 * o.profundidade, fracaoFundo });
  const t = o.testada;
  // variações da 1ª passada: sentido e a FRAÇÃO da travessia do primeiro trecho (o de frente longa pode ser mais
  // fundo, deixando o lado limitado pela frente — como o contorno do balão — com lotes mais rasos)
  const iniciais: { reverso: boolean; fase: number; raio: number; ordem: number; fracao: number }[] = [];
  [0].forEach((ordem) => { for (const fracao of [0.57, 0.5, 0.65]) for (const reverso of [false, true]) iniciais.push({ reverso, fase: 0, raio: 2 * t, ordem, fracao }); });
  const total = iniciais.length * info.length + 6;
  let feitos = 0;
  const resultados: ImplantacaoViaDivisa[] = [];
  // cada variação: 1ª passada (zonas) → redivisão por área; para ao atingir o teto
  for (const ini of iniciais) {
    if (resultados.length && resultados[0].lotes.length >= tetoGleba) break;
    const lotes: LoteFrame[] = [];
    const doTrecho: number[] = []; // trecho de origem de cada lote (para redividir a zona por área)
    const sentido: boolean[] = [];
    const chaves: string[] = [];
    const trechos = ordens[ini.ordem];
    trechos.forEach((tr, k) => {
      const variantes = k === 0 ? [ini, { ...ini, fase: t / 2 }] : [false, true].map((reverso) => ({ reverso, fase: 0, raio: ini.raio }));
      let melhor: ImplantacaoViaDivisa | null = null;
      for (const v of variantes) {
        const r = implantarNaDivisa(anelFechado, tr, v.reverso, v.fase, opc, v.raio, extras(lotes.map((l) => l.anel), k === 0 ? ini.fracao : 0.5));
        if (r && (!melhor || r.lotes.length > melhor.lotes.length)) melhor = r;
      }
      onProgress?.(Math.min(0.95, 0.3 + (0.7 * ++feitos) / total));
      const m = melhor as ImplantacaoViaDivisa | null;
      sentido[k] = m ? m.chave.split("|")[2] === "r" : false;
      if (m) { lotes.push(...m.lotes); m.lotes.forEach(() => doTrecho.push(k)); chaves.push(m.chave); }
    });
    const consolidado = consolidarZonas(anelFechado, lotes, doTrecho, trechos, sentido, o);
    if (resultados.length && consolidado.estimativa <= resultados[0].lotes.length) continue;
    const completos = consolidado.finalizar(6);
    onProgress?.(Math.min(0.95, 0.3 + (0.7 * (feitos += 3)) / total));
    if (completos.length === 0) continue;
    resultados.push({
      lotes: completos, corredores: [], baloes: [], viasLivres: [], candidatos: completos.length,
      arestasDivisa: trechos.flat(), comprimentoViaM: 0, comprimentoDisponivelM: perimetro,
      chave: `vp|o${ini.ordem}|${ini.reverso ? "r" : "d"}|f${ini.fracao}|${chaves.join("/")}`,
      limitacoes: [
        `Vias públicas: todas as divisas da gleba (por fora e por dentro) já são frente para via pública — sem via interna. Cada trecho de divisa (repartido nas esquinas pela bissetriz) é dividido em lotes de área ≥ ${o.loteMinimoM2.toLocaleString("pt-BR")} m² e frente ≥ ${t.toLocaleString("pt-BR")} m; o fundo vai até o eixo entre as vias e a frente de cada lote é a que fecha a área (testadas e fundos variam, a área total se mantém). 100% de aproveitamento.`,
        "Confirme em projeto que todas as divisas são de fato vias públicas oficiais (testada para logradouro existente).",
      ],
    });
    resultados.sort((a, b) => b.lotes.length - a.lotes.length);
  }
  const somaArea = (r: ImplantacaoViaDivisa) => r.lotes.reduce((s, l) => s + l.area, 0);
  resultados.sort((a, b) => b.lotes.length - a.lotes.length || somaArea(b) - somaArea(a) || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
  // todas aproveitam 100% da área: o que diferencia é a quantidade de lotes — só seguem as de maior quantidade
  const maxLotes = resultados[0]?.lotes.length ?? 0;
  // o desenho em faixas (como o aprovado) vale sempre que rende pelo menos tantos lotes quanto o motor por trechos
  if (melhorFaixas && melhorFaixas.lotes.length >= maxLotes) return [emFaixas(melhorFaixas)];
  return resultados.filter((r) => r.lotes.length === maxLotes).slice(0, max);
}
