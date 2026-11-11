// Rua por LADOS escolhidos da gleba: "rua de cima", "rua da esquerda", "rua da direita",
// "rua de baixo" — o usuário marca exatamente onde quer a via (uma ou mais divisas).
//
// Cada aresta da poligonal pertence ao lado para onde aponta a sua normal externa
// (norte = cima, leste = direita, sul = baixo, oeste = esquerda). Lados marcados vizinhos
// viram uma via contínua (ex.: cima + direita = via em "L" pela divisa); lados separados viram
// vias independentes. Todas as vias são traçadas primeiro e depois os lotes, de modo que
// nenhum lote atravessa outra via. Os lotes têm a frente EXATA da testada sobre a via e o fundo
// variável até a divisa oposta (a divisa lateral gira quando a faixa não atinge a área mínima).
// Determinístico.

import type { Position } from "geojson";
import { areaPlanar, type LoteFrame } from "./geometria-parcelamento";
import { implantarNaDivisa, subtrairAreas, viaDaCadeia, type ImplantacaoViaDivisa, type OpcoesViaDivisa } from "./rua-divisa";

export type LadoGleba = "cima" | "esquerda" | "direita" | "baixo";
export const LADOS_GLEBA: LadoGleba[] = ["cima", "esquerda", "direita", "baixo"];
export const ROTULO_LADO: Record<LadoGleba, string> = { cima: "Rua de cima", esquerda: "Rua da esquerda", direita: "Rua da direita", baixo: "Rua de baixo" };

export interface LadoMedido { lado: LadoGleba; arestas: number[]; comprimentoM: number }

function areaComSinal(v: Position[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

/** Lado de cada aresta (anel em metros, x = leste, y = norte, fechado). */
export function ladoDasArestas(anelFechado: Position[]): LadoGleba[] {
  const v = anelFechado.slice(0, -1);
  const ccw = areaComSinal(v) > 0;
  return v.map((a, i) => {
    const b = v[(i + 1) % v.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const nx = ccw ? dy : -dy, ny = ccw ? -dx : dx; // normal EXTERNA
    const ang = (Math.atan2(ny, nx) * 180) / Math.PI;
    if (ang > -45 && ang <= 45) return "direita";
    if (ang > 45 && ang <= 135) return "cima";
    if (ang > -135 && ang <= -45) return "baixo";
    return "esquerda";
  });
}

/** Comprimento de divisa de cada lado (para o usuário saber quantos lotes cabem antes de gerar). */
export function medirLados(anelFechado: Position[]): LadoMedido[] {
  const lados = ladoDasArestas(anelFechado);
  return LADOS_GLEBA.map((lado) => {
    const arestas = lados.map((l, i) => (l === lado ? i : -1)).filter((i) => i >= 0);
    const comprimentoM = arestas.reduce((s, i) => s + Math.hypot(anelFechado[i + 1][0] - anelFechado[i][0], anelFechado[i + 1][1] - anelFechado[i][1]), 0);
    return { lado, arestas, comprimentoM };
  });
}

/** Trechos contínuos (na ordem do anel) das arestas dos lados marcados. Anel inteiro ⇒ um trecho por lado. */
export function cadeiasDosLados(anelFechado: Position[], selecionados: LadoGleba[]): number[][] {
  const lados = ladoDasArestas(anelFechado);
  const n = lados.length;
  const marcada = lados.map((l) => selecionados.includes(l));
  if (!marcada.some(Boolean)) return [];
  const runs = (corte: (i: number) => boolean): number[][] => {
    // começa logo após uma aresta não marcada (ou num corte), para não partir um trecho ao meio
    let inicio = marcada.findIndex((m, i) => m && (!marcada[(i - 1 + n) % n] || corte(i)));
    if (inicio < 0) inicio = 0;
    const out: number[][] = [];
    let atual: number[] = [];
    for (let k = 0; k < n; k++) {
      const i = (inicio + k) % n;
      if (!marcada[i] || (atual.length > 0 && corte(i))) { if (atual.length) out.push(atual); atual = []; }
      if (marcada[i]) atual.push(i);
    }
    if (atual.length) out.push(atual);
    return out;
  };
  const todas = marcada.every(Boolean);
  return todas ? runs((i) => lados[i] !== lados[(i - 1 + n) % n]) : runs(() => false);
}

export interface ImplantacaoPorLados extends ImplantacaoViaDivisa { lados: LadoGleba[] }

const areaVias = (r: ImplantacaoViaDivisa) => r.viasLivres.reduce((s, a) => s + areaPlanar(a), 0);
const desvioFrente = (r: ImplantacaoViaDivisa, t: number) => r.lotes.reduce((s, l) => s + Math.abs((l.testada ?? t) - t), 0);

/** Implanta a via nos lados marcados e os lotes com frente exata e fundo variável. Devolve as melhores variações. */
export function buscarPorLados(anelFechado: Position[], selecionados: LadoGleba[], o: OpcoesViaDivisa, max = 6, onProgress?: (f: number) => void): ImplantacaoPorLados[] {
  // divisas mais longas primeiro: o resultado não depende do vértice em que o KML começa
  const compr = (c: number[]) => c.reduce((x, i) => x + Math.hypot(anelFechado[i + 1][0] - anelFechado[i][0], anelFechado[i + 1][1] - anelFechado[i][1]), 0);
  const cadeias = cadeiasDosLados(anelFechado, selecionados)
    .map((c) => ({ c, m: compr(c) })).sort((a, b) => b.m - a.m || a.c[0] - b.c[0]).map((x) => x.c);
  if (cadeias.length === 0) return [];
  const vias = cadeias.map((c) => viaDaCadeia(anelFechado, c, o.via));
  const t = o.testada;
  // variações: sentido de implantação × leque nas curvas (a 1ª via testa também meia fase)
  const variantesDe = (k: number) => {
    const out: { reverso: boolean; fase: number; raio: number }[] = [];
    for (const reverso of [false, true]) for (const fase of k === 0 ? [0, t / 2] : [0]) for (const raio of k === 0 ? [0, 2 * t, 4 * t] : [0, 4 * t]) out.push({ reverso, fase, raio });
    return out;
  };
  // vias em divisas separadas: cada lote vai no máximo até a profundidade informada (a outra via usa o restante)
  const fundoMaxM = cadeias.length > 1 ? o.profundidade : undefined;
  const ordenar = (a: ImplantacaoViaDivisa, b: ImplantacaoViaDivisa) =>
    b.lotes.length - a.lotes.length || desvioFrente(a, t) - desvioFrente(b, t) || areaVias(a) - areaVias(b) || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0);
  const total = cadeias.reduce((s, _, k) => s + variantesDe(k).length, 0) * Math.min(max, 3);
  let feitos = 0;
  // lotes de uma cadeia, dado o que já está ocupado (outras vias + lotes anteriores)
  const melhoresDaCadeia = (k: number, ocupados: Position[][], quantos: number): ImplantacaoViaDivisa[] => {
    const res: ImplantacaoViaDivisa[] = [];
    for (const v of variantesDe(k)) {
      const r = implantarNaDivisa(anelFechado, cadeias[k], v.reverso, v.fase, { ...o, limiteComprimentoM: undefined }, v.raio, { ocupados, fundoVariavel: true, viaInteira: true, fundoMaxM });
      if (r) res.push(r);
      onProgress?.(Math.min(1, ++feitos / total));
    }
    return res.sort(ordenar).slice(0, quantos);
  };
  const outrasVias = (k: number) => vias.filter((_, j) => j !== k).flat();
  const primeirasLista = melhoresDaCadeia(0, outrasVias(0), cadeias.length > 1 ? Math.min(max, 3) : max);
  // a primeira divisa pode não comportar lote: a via fica e as outras divisas ainda são avaliadas
  const primeiras: (ImplantacaoViaDivisa | null)[] = primeirasLista.length > 0 ? primeirasLista : cadeias.length > 1 ? [null] : [];
  const resultados: ImplantacaoPorLados[] = [];
  for (const p0 of primeiras) {
    const lotes: LoteFrame[] = [...(p0?.lotes ?? [])];
    const chaves = [p0?.chave ?? "sem-lotes"];
    for (let k = 1; k < cadeias.length; k++) {
      const melhor = melhoresDaCadeia(k, [...outrasVias(k), ...lotes.map((l) => l.anel)], 1)[0];
      if (melhor) { lotes.push(...melhor.lotes); chaves.push(melhor.chave); }
    }
    // via final: cada via só com a parte que não está em outra (cruzamento contado uma vez)
    const viasLivres: Position[][] = [];
    vias.forEach((vk, k) => viasLivres.push(...(k === 0 ? vk : subtrairAreas(vk, vias.slice(0, k).flat()))));
    if (lotes.length === 0) continue;
    const comprimentoViaM = cadeias.reduce((s, c) => s + compr(c), 0);
    resultados.push({
      corredores: [], baloes: [],
      lotes: lotes.map((l, i) => ({ ...l, ordem: i })),
      candidatos: lotes.length,
      viasLivres,
      arestasDivisa: cadeias.flat(),
      comprimentoViaM,
      comprimentoDisponivelM: comprimentoViaM,
      chave: `lados|${selecionados.join("+")}|${chaves.join("/")}`,
      lados: selecionados,
      limitacoes: [
        `Via de ${o.via.toLocaleString("pt-BR")} m somente na(s) divisa(s) escolhida(s): ${selecionados.map((l) => ROTULO_LADO[l].toLowerCase()).join(", ")} (${comprimentoViaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m de divisa). Lotes com frente de ${t.toLocaleString("pt-BR")} m sobre a via e fundo variável até a divisa oposta; área ≥ ${o.loteMinimoM2.toLocaleString("pt-BR")} m². O lote da ponta pode ter frente maior para absorver a sobra da divisa.`,
        "Rua Simples não inclui balão de retorno; o acesso externo deve ser confirmado em projeto.",
      ],
    });
  }
  return resultados.sort(ordenar).slice(0, max);
}
