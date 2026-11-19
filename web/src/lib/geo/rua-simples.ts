// Tipologia RUA SIMPLES — via única de mão dupla com lotes dos dois lados.
//
// A via é um corredor reto de largura = largura informada pelo usuário. Os lotes
// têm testada × profundidade informadas, com frente para a via, encostados em
// sequência a partir da extremidade em que a via encontra o limite da gleba (é por
// ali que a via recebe o acesso). Etapa F (15/11): o lote que cruza a divisa é
// RECORTADO por ela (aceito com área ≥ mínima e testada ≥ mínima), inclusive no
// trecho de acesso junto à divisa; a via só avança enquanto o próprio corredor couber.
//
// NÃO há balão de retorno (diferente do cul-de-sac): a via termina em seu último lote
// e isso é registrado como limitação. Curvas da via não são modeladas nesta versão —
// a irregularidade da poligonal é tratada escolhendo a orientação e a posição do eixo.
//
// A busca é uma varredura DETERMINÍSTICA (ângulos × deslocamentos do eixo × extremidade
// de entrada), sem aleatoriedade.

import type { Position } from "geojson";
import {
  EPS_GEO, angulosDasArestas, areaPlanar, distanciaAteDivisa, prepararFrameAnel, recortarPorRetangulo, retAnel, retanguloDentro,
  type FrameAnel, type ImplantacaoFrame, type LoteFrame, type Ret,
} from "./geometria-parcelamento";
import {
  areaCelula, avaliarMalhaRapida, frenteMinimaPara, prepararGlebaFrame, type CelulaLote, type GlebaFrame, type ViaMalha,
} from "./malha-conectada";

export interface DimensoesRua {
  testada: number;
  profundidade: number;
  via: number;
}

export type Ancora = "inicio" | "fim";

export interface OpcoesRua {
  /** Máximo de peças de via (cada peça = 1 testada de comprimento). Usado no modo manual da área viária. */
  limitePecas?: number;
  /** Remove a via excedente após o último lote (padrão true). */
  aparar?: boolean;
  /**
   * "retangular" (padrão): lote = retângulo exato testada × profundidade.
   * "divisa": lote acompanha a divisa — frente = testada informada (ou múltiplo dela, quando
   * a faixa não atinge a área mínima), fundo até o limite da gleba (no máximo 2 × a
   * profundidade informada), aceito só com área ≥ área mínima. Formato usual de chacreamento.
   */
  formato?: "retangular" | "divisa";
  loteMinimoM2?: number;
  /** Furos da gleba (metros, antes da rotação) — não recebem lote nem via. */
  furosM?: Position[][];
  /** Gleba já preparada no frame (cache da busca). */
  gf?: GlebaFrame;
  /** Orientações adicionais a testar (ex.: alinhadas às vias existentes do entorno). */
  angulosExtras?: number[];
}

export interface ImplantacaoRua extends ImplantacaoFrame {
  c: number;
  ancora: Ancora;
  intervalo: [number, number];
  pecasVia: number;
  comprimentoViaM: number;
  /** Peças de via que a poligonal comportaria sem o limite informado. */
  pecasPossiveis: number;
  /** Formato retangular: células candidatas (inclusive as recortadas pela divisa) e o corredor, para a malha conectada. */
  celulas?: CelulaLote[];
  viaRet?: Ret;
}

/** Trechos do eixo y=c que estão dentro da poligonal (regra par-ímpar com semiaberto — sem dupla contagem de vértices). */
export function intervalosDaCorda(anel: Position[], c: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0; i < anel.length - 1; i++) {
    const [ax, ay] = anel[i], [bx, by] = anel[i + 1];
    if ((ay <= c) !== (by <= c)) xs.push(ax + ((c - ay) * (bx - ax)) / (by - ay));
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

export function gerarRuaSimplesFrame(
  fr: FrameAnel, c: number, intervalo: [number, number], ancora: Ancora, g: DimensoesRua, opcoes: OpcoesRua & { fase?: number } = {}
): ImplantacaoRua {
  const { testada: t, profundidade: p, via: w } = g;
  const meio = w / 2;
  const [ini, fim] = intervalo;
  const dir = ancora === "inicio" ? 1 : -1;
  const maxPecas = opcoes.limitePecas ?? Infinity;
  const aparar = opcoes.aparar ?? true;
  const fase = opcoes.fase ?? 0;
  const vazio = (): ImplantacaoRua => ({
    lotes: [], corredores: [], baloes: [], candidatos: 0, limitacoes: [], c, ancora, intervalo, pecasVia: 0, comprimentoViaM: 0, pecasPossiveis: 0,
  });

  // Onde a via sai da divisa: o eixo toca o limite em `ini`/`fim`, mas com a divisa inclinada o
  // corredor de largura cheia só cabe um pouco adiante. O trecho de acesso entre a divisa e o
  // primeiro trecho cheio é via (recortada pela poligonal) — nenhum lote fica nele.
  const passo = Math.max(0.05, Math.min(0.5, t / 20));
  // o trecho de acesso é curto: limitado a 4 × (via + testada) ou 30 m (o que for maior)
  const alcance = Math.min(fim - ini - t, Math.max(4 * (w + t), 30));
  let s0 = -1;
  for (let s = 0; s <= alcance + 1e-9; s += passo) {
    const xa = dir === 1 ? ini + s : fim - s - t;
    if (retanguloDentro(fr.ind, [xa, c - meio, xa + t, c + meio])) { s0 = s; break; }
  }
  if (s0 < 0) return vazio();
  const inicio = s0 + fase;

  const lotes: LoteFrame[] = [];
  const pecas: { ret: Ret; lotes: number }[] = [];
  let candidatos = 0;
  let pecasPossiveis = 0;
  // formato "acompanha a divisa": faixas da frente da via até o limite da gleba
  const divisa = opcoes.formato === "divisa";
  const minArea = Math.max(opcoes.loteMinimoM2 ?? t * p, 1);
  const profMax = 2 * p;
  const acumulado: ({ x0: number; x1: number; k0: number } | null)[] = [null, null];
  const loteDivisa = (x0: number, x1: number, lado: 0 | 1): Omit<LoteFrame, "linha" | "faixa" | "segmento" | "ordem"> | null => {
    const sentido = lado === 0 ? 1 : -1;
    const y0 = lado === 0 ? c + meio : c - meio;
    // fundo = até a primeira divisa (amostrado nas laterais e no meio), limitado a 2 × a profundidade
    const amostras = [x0 + 1e-3, (x0 + x1) / 2, x1 - 1e-3].map((x) => distanciaAteDivisa(fr.anel, x, y0, sentido));
    const d = Math.min(profMax, Math.max(...amostras));
    if (!Number.isFinite(d) || d <= EPS_GEO) return null;
    const ret: Ret = lado === 0 ? [x0, y0, x1, y0 + d] : [x0, y0 - d, x1, y0];
    const anel = recortarPorRetangulo(fr.anel, ret);
    if (anel.length < 4) return null;
    const area = areaPlanar(anel);
    return { anel, area, ret, testada: x1 - x0, profundidadeMedia: area / (x1 - x0) };
  };
  // formato retangular: células de lote (frente para a via) recortadas pela divisa — etapa F
  const gf = divisa ? null : (opcoes.gf ?? prepararGlebaFrame(fr, opcoes.furosM ?? []));
  const viaFaixa: ViaMalha[] = [{ ret: [Math.min(ini, fim) - 1, c - meio, Math.max(ini, fim) + 1, c + meio] }];
  const oMalha = { loteMinimoM2: Math.max(opcoes.loteMinimoM2 ?? t * p, 1e-9), frenteMinimaM: frenteMinimaPara(t), larguraViaM: w };
  const celulasDaColuna = (xa: number, xb: number, k: number): CelulaLote[] => [
    { ret: [xa, c + meio, xb, c + meio + p], frente: "S", viasFrente: [0], linha: 0, faixa: 0, segmento: 0, ordem: k },
    { ret: [xa, c - meio - p, xb, c - meio], frente: "N", viasFrente: [0], linha: 0, faixa: 0, segmento: 1, ordem: k },
  ];
  const aceitaRapido = (cel: CelulaLote) => avaliarMalhaRapida(gf!, viaFaixa, [cel], oMalha).n > 0;
  const celulas: CelulaLote[] = [];
  if (!divisa) {
    // trecho de acesso (entre a divisa e a primeira peça cheia): lotes recortados pela divisa, de frente para o acesso
    for (let k = -1; ; k--) {
      const xa = dir === 1 ? ini + inicio + k * t : fim - inicio - (k + 1) * t;
      const xb = xa + t;
      if (dir === 1 ? xb <= ini + EPS_GEO : xa >= fim - EPS_GEO) break;
      for (const cel of celulasDaColuna(xa, xb, k)) {
        celulas.push(cel);
        if (aceitaRapido(cel)) {
          lotes.push({ anel: retAnel(cel.ret), area: areaCelula(gf!, cel.ret), ret: cel.ret, linha: 0, faixa: 0, segmento: cel.segmento, ordem: k });
          candidatos++;
        }
      }
    }
  }
  for (let k = 0; ; k++) {
    const xa = dir === 1 ? ini + inicio + k * t : fim - inicio - (k + 1) * t;
    const xb = xa + t;
    if (xa < ini - EPS_GEO || xb > fim + EPS_GEO) break;
    const peca: Ret = [xa, c - meio, xb, c + meio];
    if (!retanguloDentro(fr.ind, peca)) break;
    pecasPossiveis++;
    if (k >= maxPecas) continue; // segue só para saber quanto a poligonal comportaria
    let n = 0;
    if (divisa) {
      for (const lado of [0, 1] as const) {
        const acc = acumulado[lado];
        const novo = acc ? { x0: Math.min(acc.x0, xa), x1: Math.max(acc.x1, xb), k0: acc.k0 } : { x0: xa, x1: xb, k0: k };
        const lote = loteDivisa(novo.x0, novo.x1, lado);
        if (lote && lote.area >= minArea) {
          lotes.push({ ...lote, linha: 0, faixa: 0, segmento: lado, ordem: novo.k0 });
          candidatos++;
          n++;
          acumulado[lado] = null;
        } else {
          acumulado[lado] = novo;
        }
      }
    } else {
      for (const cel of celulasDaColuna(xa, xb, k)) {
        // a peça de via está inteira na gleba: a frente do lote está toda sobre a via; basta a área mínima
        const area = areaCelula(gf!, cel.ret);
        if (area + 1e-9 >= oMalha.loteMinimoM2) {
          lotes.push({ anel: retAnel(cel.ret), area, ret: cel.ret, linha: 0, faixa: 0, segmento: cel.segmento, ordem: k });
          candidatos++;
          n++;
        }
      }
    }
    pecas.push({ ret: peca, lotes: n });
  }
  let ultimo = pecas.length - 1;
  if (aparar) while (ultimo >= 0 && pecas[ultimo].lotes === 0) ultimo--;
  const usadas = pecas.slice(0, ultimo + 1);
  // os lotes das peças aparadas (e das além do limite manual) não contam
  const lotesUsados = divisa ? lotes : lotes.filter((l) => l.ordem < usadas.length);
  if (usadas.length === 0 || lotesUsados.length === 0) return { ...vazio(), pecasPossiveis };
  const corredores: Ret[] = [];
  // corredor da divisa (acesso) até o fim do último trecho usado
  const xFimUsado = dir === 1 ? Math.max(...usadas.map((u) => u.ret[2])) : Math.min(...usadas.map((u) => u.ret[0]));
  corredores.push(dir === 1 ? [ini, c - meio, xFimUsado, c + meio] : [xFimUsado, c - meio, fim, c + meio]);
  // as células das peças usadas seguem para a malha conectada (recorte exato e testada medida)
  if (!divisa) {
    for (let k = 0; k < usadas.length; k++) {
      const xa = dir === 1 ? ini + inicio + k * t : fim - inicio - (k + 1) * t;
      celulas.push(...celulasDaColuna(xa, xa + t, k));
    }
  }
  return {
    lotes: lotesUsados, corredores, baloes: [], candidatos: divisa ? candidatos : lotesUsados.length,
    limitacoes: [
      ...(divisa ? [`Lotes acompanham a divisa: frente de ${t.toLocaleString("pt-BR")} m (ou múltiplo, quando a faixa não atinge a área mínima), fundo até o limite da gleba (máx. ${profMax.toLocaleString("pt-BR")} m) e área ≥ ${minArea.toLocaleString("pt-BR")} m² — profundidade variável, informada por lote.`] : []),
      "Rua Simples: via única, reta, de mão dupla, com lotes dos dois lados. Curvas da via não são modeladas; a poligonal é acomodada pela escolha da orientação e do eixo.",
      "Rua Simples não inclui balão de retorno: a via termina no último lote; a ligação com o sistema viário é pela extremidade em que a via encontra a divisa.",
    ],
    c, ancora, intervalo, pecasVia: usadas.length, comprimentoViaM: inicio + usadas.length * t, pecasPossiveis,
    ...(divisa ? {} : { celulas, viaRet: corredores[0] }),
  };
}

export interface CandidatoRua {
  angulo: number;
  c: number;
  fase: number;
  ancora: Ancora;
  intervalo: [number, number];
  nLotes: number;
  pecasVia: number;
}

/** Ordenação canônica: mais lotes → via mais curta → ângulo → eixo → âncora (totalmente determinística). */
export function compararCandidatoRua(a: CandidatoRua, b: CandidatoRua): number {
  return b.nLotes - a.nLotes || a.pecasVia - b.pecasVia || a.angulo - b.angulo || a.c - b.c || a.fase - b.fase
    || (a.ancora === b.ancora ? 0 : a.ancora === "inicio" ? -1 : 1) || a.intervalo[0] - b.intervalo[0];
}

function angulosGrossos(anelM: Position[], extras: number[] = []): number[] {
  const set = new Set<number>([...angulosDasArestas(anelM, 8), ...extras]);
  for (let a = 0; a < 180; a += 10) set.add(a);
  return Array.from(set).sort((a, b) => a - b);
}

function norm180(a: number): number {
  return Math.round((((a % 180) + 180) % 180) * 1000) / 1000;
}

/** Varredura determinística de orientações, posições do eixo e extremidade de entrada. */
export function buscarRuaSimples(anelM: Position[], g: DimensoesRua, opcoes: OpcoesRua = {}, maxCandidatos = 60): CandidatoRua[] {
  const celula = Math.max(g.testada, g.profundidade, g.via) * 2;
  const passo = Math.max(0.5, Math.min(5, g.testada / 4));
  const frames = new Map<number, { fr: FrameAnel; gf: GlebaFrame | undefined }>();
  const quadroDe = (ang: number) => {
    let f = frames.get(ang);
    if (!f) {
      const fr = prepararFrameAnel(anelM, ang, celula);
      f = { fr, gf: opcoes.formato === "divisa" ? undefined : prepararGlebaFrame(fr, opcoes.furosM ?? []) };
      frames.set(ang, f);
    }
    return f;
  };

  const varrer = (ang: number, desloc: number[] | null, passoC: number, fases: number[] = [0, g.testada / 2]): CandidatoRua[] => {
    const { fr, gf } = quadroDe(ang);
    const [, minY, , maxY] = fr.bbox;
    const cs: number[] = [];
    if (desloc) for (const d of desloc) cs.push(d);
    else for (let c = minY; c <= maxY + 1e-9; c += passoC) cs.push(Math.round(c * 1e6) / 1e6);
    const out: CandidatoRua[] = [];
    for (const c of cs) {
      for (const intervalo of intervalosDaCorda(fr.anel, c)) {
        if (intervalo[1] - intervalo[0] < g.testada) continue;
        for (const ancora of ["inicio", "fim"] as const) {
          for (const fase of fases) {
            const r = gerarRuaSimplesFrame(fr, c, intervalo, ancora, g, { ...opcoes, gf, fase, aparar: opcoes.aparar ?? true });
            if (r.lotes.length > 0) out.push({ angulo: ang, c, fase, ancora, intervalo, nLotes: r.lotes.length, pecasVia: r.pecasVia });
          }
        }
      }
    }
    return out;
  };

  // 1) varredura grossa
  let pool: CandidatoRua[] = [];
  for (const ang of angulosGrossos(anelM, opcoes.angulosExtras)) pool.push(...varrer(ang, null, passo));
  pool.sort(compararCandidatoRua);

  // 2) refino local ao redor dos melhores (por ângulo)
  const melhoresAngulos: number[] = [];
  for (const c of pool) if (!melhoresAngulos.includes(c.angulo)) melhoresAngulos.push(c.angulo);
  const refinados: CandidatoRua[] = [];
  for (const base of melhoresAngulos.slice(0, 6)) {
    const cBase = pool.find((x) => x.angulo === base)!.c;
    for (const da of [-5, -2.5, -1, 0, 1, 2.5, 5]) {
      const ang = norm180(base + da);
      const deslocs: number[] = [];
      for (let d = -passo; d <= passo + 1e-9; d += passo / 4) deslocs.push(Math.round((cBase + d) * 1e6) / 1e6);
      refinados.push(...varrer(ang, deslocs, passo, [0, g.testada / 4, g.testada / 2, (3 * g.testada) / 4]));
    }
  }
  pool = [...pool, ...refinados];
  pool.sort(compararCandidatoRua);

  // 3) no máximo 2 por orientação (mesma orientação = variações do mesmo layout), sem duplicatas
  const porAngulo = new Map<number, number>();
  const vistos = new Set<string>();
  const out: CandidatoRua[] = [];
  for (const cand of pool) {
    const chave = `${cand.angulo}|${cand.c}|${cand.fase}|${cand.ancora}|${cand.intervalo[0].toFixed(3)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const n = porAngulo.get(cand.angulo) ?? 0;
    if (n >= 2) continue;
    porAngulo.set(cand.angulo, n + 1);
    out.push(cand);
    if (out.length >= maxCandidatos) break;
  }
  // orientações pedidas (ex.: alinhadas às vias existentes do entorno): os 2 melhores de cada uma entram sempre,
  // com as duas extremidades de acesso, para a seleção poder ligar a via à rua existente
  for (const ang of opcoes.angulosExtras ?? []) {
    for (const ancora of ["inicio", "fim"] as const) {
      let n = 0;
      for (const cand of pool) {
        if (cand.angulo !== ang || cand.ancora !== ancora) continue;
        const chave = `${cand.angulo}|${cand.c}|${cand.fase}|${cand.ancora}|${cand.intervalo[0].toFixed(3)}`;
        if (!out.some((o) => `${o.angulo}|${o.c}|${o.fase}|${o.ancora}|${o.intervalo[0].toFixed(3)}` === chave)) out.push(cand);
        if (++n >= 2) break;
      }
    }
  }
  return out;
}

/** Reconstrói a implantação completa de um candidato (mesmo caminho da busca). */
export function implantacaoDoCandidatoRua(anelM: Position[], cand: CandidatoRua, g: DimensoesRua, opcoes: OpcoesRua = {}): { fr: FrameAnel; impl: ImplantacaoRua } {
  const fr = prepararFrameAnel(anelM, cand.angulo, Math.max(g.testada, g.profundidade, g.via) * 2);
  const gf = opcoes.formato === "divisa" ? undefined : prepararGlebaFrame(fr, opcoes.furosM ?? []);
  return { fr, impl: gerarRuaSimplesFrame(fr, cand.c, cand.intervalo, cand.ancora, g, { ...opcoes, gf, fase: cand.fase }) };
}
