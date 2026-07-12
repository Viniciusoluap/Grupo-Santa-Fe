// Cálculos de relevo a partir de uma grade de elevações (DEM): declividade por
// célula, declividade média e distribuição por faixas. Funções puras, testáveis.
//
// As faixas e cores seguem o padrão consagrado de estudo de loteamento
// (declividade em %): Plano / Leve / Moderado / Íngreme / Inviável.

export interface GridElevacaoLike {
  ncols: number;
  nrows: number;
  z: number[][]; // [linha][coluna], linha 0 = norte
  min: number;
  max: number;
}

export interface FaixaDeclividade {
  chave: "plano" | "leve" | "moderado" | "ingreme" | "inviavel";
  label: string;
  corHex: string;
  min: number; // % (inclusive)
  max: number; // % (exclusive; Infinity na última)
}

export const FAIXAS_DECLIVIDADE: FaixaDeclividade[] = [
  { chave: "plano",    label: "Plano (0–5%)",     corHex: "#16a34a", min: 0,  max: 5 },
  { chave: "leve",     label: "Leve (5–10%)",     corHex: "#84cc16", min: 5,  max: 10 },
  { chave: "moderado", label: "Moderado (10–18%)", corHex: "#eab308", min: 10, max: 18 },
  { chave: "ingreme",  label: "Íngreme (18–25%)",  corHex: "#f97316", min: 18, max: 25 },
  { chave: "inviavel", label: "Inviável (>25%)",   corHex: "#dc2626", min: 25, max: Infinity },
];

/** Índice da faixa (0..4) para uma declividade em %. */
export function indiceFaixa(declividadePct: number): number {
  for (let i = 0; i < FAIXAS_DECLIVIDADE.length; i++) {
    const f = FAIXAS_DECLIVIDADE[i];
    if (declividadePct >= f.min && declividadePct < f.max) return i;
  }
  return FAIXAS_DECLIVIDADE.length - 1;
}

/**
 * Declividade (%) por célula, via diferenças centrais sobre a grade.
 * `cellMetersX`/`cellMetersY` são o tamanho da célula em metros (lng/lat),
 * calculados a partir do tamanho em graus e da latitude do terreno.
 */
export function declividadeGrade(
  grid: GridElevacaoLike,
  cellMetersX: number,
  cellMetersY: number
): number[][] {
  const { ncols, nrows, z } = grid;
  const dx = Math.max(1e-6, cellMetersX);
  const dy = Math.max(1e-6, cellMetersY);
  const out: number[][] = [];

  for (let r = 0; r < nrows; r++) {
    const linha: number[] = [];
    for (let c = 0; c < ncols; c++) {
      const zl = z[r]?.[Math.max(0, c - 1)] ?? z[r]?.[c] ?? 0;
      const zr = z[r]?.[Math.min(ncols - 1, c + 1)] ?? z[r]?.[c] ?? 0;
      const zu = z[Math.max(0, r - 1)]?.[c] ?? z[r]?.[c] ?? 0;
      const zd = z[Math.min(nrows - 1, r + 1)]?.[c] ?? z[r]?.[c] ?? 0;
      const spanX = c === 0 || c === ncols - 1 ? dx : 2 * dx;
      const spanY = r === 0 || r === nrows - 1 ? dy : 2 * dy;
      const gx = (zr - zl) / spanX;
      const gy = (zd - zu) / spanY;
      const slope = Math.sqrt(gx * gx + gy * gy) * 100; // %
      linha.push(slope);
    }
    out.push(linha);
  }
  return out;
}

/** Declividade média (%) da grade de declividades. */
export function declividadeMedia(slopes: number[][]): number {
  let soma = 0;
  let n = 0;
  for (const linha of slopes) for (const s of linha) { soma += s; n++; }
  return n ? soma / n : 0;
}

export interface DistribuicaoFaixa extends FaixaDeclividade {
  celulas: number;
  pct: number; // fração 0..1 das células
}

/** Distribuição das células por faixa de declividade. */
export function distribuicaoDeclividade(slopes: number[][]): DistribuicaoFaixa[] {
  const contagem = new Array(FAIXAS_DECLIVIDADE.length).fill(0);
  let total = 0;
  for (const linha of slopes) {
    for (const s of linha) {
      contagem[indiceFaixa(s)]++;
      total++;
    }
  }
  return FAIXAS_DECLIVIDADE.map((f, i) => ({
    ...f,
    celulas: contagem[i],
    pct: total ? contagem[i] / total : 0,
  }));
}

/** Tamanho da célula em metros a partir do tamanho em graus e da latitude. */
export function celulaEmMetros(
  cellsizeXGraus: number,
  cellsizeYGraus: number,
  latitudeGraus: number
): { x: number; y: number } {
  const latRad = (latitudeGraus * Math.PI) / 180;
  const metrosPorGrauLat = 111_132;
  const metrosPorGrauLng = 111_320 * Math.cos(latRad);
  return {
    x: Math.abs(cellsizeXGraus * metrosPorGrauLng),
    y: Math.abs(cellsizeYGraus * metrosPorGrauLat),
  };
}

// ─── Processamento da malha para visualização 3D ────────────────────────────
// O DEM chega em grade grossa (16–24 células por lado). Para uma superfície
// suave estilo "estudo de loteamento" (sem picos serrilhados), interpolamos
// bilinearmente para uma grade densa e aplicamos suavização por média 3×3.

/** Interpola bilinearmente a grade para (n-1)*fator+1 pontos por eixo. */
export function upsampleBilinear(grid: GridElevacaoLike, fator: number): GridElevacaoLike {
  const f = Math.max(1, Math.round(fator));
  if (f === 1) return grid;
  const { ncols, nrows, z } = grid;
  const nc = (ncols - 1) * f + 1;
  const nr = (nrows - 1) * f + 1;
  const out: number[][] = [];
  let min = Infinity, max = -Infinity;
  for (let r = 0; r < nr; r++) {
    const gy = r / f;
    const r0 = Math.min(nrows - 1, Math.floor(gy));
    const r1 = Math.min(nrows - 1, r0 + 1);
    const ty = gy - r0;
    const linha: number[] = [];
    for (let c = 0; c < nc; c++) {
      const gx = c / f;
      const c0 = Math.min(ncols - 1, Math.floor(gx));
      const c1 = Math.min(ncols - 1, c0 + 1);
      const tx = gx - c0;
      const v =
        z[r0][c0] * (1 - tx) * (1 - ty) +
        z[r0][c1] * tx * (1 - ty) +
        z[r1][c0] * (1 - tx) * ty +
        z[r1][c1] * tx * ty;
      linha.push(v);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    out.push(linha);
  }
  return { ncols: nc, nrows: nr, z: out, min, max };
}

/** Suaviza a grade com média 3×3 (n passes), preservando dimensões. */
export function suavizarGrade(grid: GridElevacaoLike, passes = 1): GridElevacaoLike {
  let z = grid.z.map((l) => [...l]);
  const { ncols, nrows } = grid;
  for (let p = 0; p < passes; p++) {
    const novo: number[][] = [];
    for (let r = 0; r < nrows; r++) {
      const linha: number[] = [];
      for (let c = 0; c < ncols; c++) {
        let soma = 0, n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < nrows && cc >= 0 && cc < ncols) { soma += z[rr][cc]; n++; }
          }
        }
        linha.push(soma / n);
      }
      novo.push(linha);
    }
    z = novo;
  }
  let min = Infinity, max = -Infinity;
  for (const l of z) for (const v of l) { if (v < min) min = v; if (v > max) max = v; }
  return { ncols, nrows, z, min, max };
}

/** Ray casting: ponto [lng,lat] dentro do anel [[lng,lat],...]. */
export function pontoNoPoligono(lng: number, lat: number, anel: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const cruza = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Passo "redondo" de cota para ~alvo curvas de nível no desnível dado. */
export function passoNivel(amplitude: number, alvo = 10): number {
  const candidatos = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  for (const c of candidatos) {
    if (amplitude / c <= alvo) return c;
  }
  return candidatos[candidatos.length - 1];
}

export interface SegmentoIsolinha {
  nivel: number;
  // coordenadas fracionárias de grade: [col, row] de cada extremidade
  a: [number, number];
  b: [number, number];
}

/**
 * Extrai curvas de nível da grade por marching squares (casos básicos).
 * Retorna segmentos em coordenadas fracionárias de grade (col, row).
 */
export function isolinhas(grid: GridElevacaoLike, niveis: number[]): SegmentoIsolinha[] {
  const { ncols, nrows, z } = grid;
  const segs: SegmentoIsolinha[] = [];

  const interp = (v0: number, v1: number, nivel: number) => {
    const d = v1 - v0;
    return Math.abs(d) < 1e-12 ? 0.5 : (nivel - v0) / d;
  };

  for (const nivel of niveis) {
    for (let r = 0; r < nrows - 1; r++) {
      for (let c = 0; c < ncols - 1; c++) {
        const v00 = z[r][c];       // topo-esq
        const v01 = z[r][c + 1];   // topo-dir
        const v10 = z[r + 1][c];   // base-esq
        const v11 = z[r + 1][c + 1]; // base-dir
        let caso = 0;
        if (v00 >= nivel) caso |= 8;
        if (v01 >= nivel) caso |= 4;
        if (v11 >= nivel) caso |= 2;
        if (v10 >= nivel) caso |= 1;
        if (caso === 0 || caso === 15) continue;

        // pontos de cruzamento em cada aresta (col,row fracionários)
        const topo: [number, number]    = [c + interp(v00, v01, nivel), r];
        const dir: [number, number]     = [c + 1, r + interp(v01, v11, nivel)];
        const base: [number, number]    = [c + interp(v10, v11, nivel), r + 1];
        const esq: [number, number]     = [c, r + interp(v00, v10, nivel)];

        const add = (a: [number, number], b: [number, number]) => segs.push({ nivel, a, b });

        switch (caso) {
          case 1: case 14: add(esq, base); break;
          case 2: case 13: add(base, dir); break;
          case 3: case 12: add(esq, dir); break;
          case 4: case 11: add(topo, dir); break;
          case 6: case 9:  add(topo, base); break;
          case 7: case 8:  add(esq, topo); break;
          case 5:  add(esq, topo); add(base, dir); break; // sela
          case 10: add(topo, dir); add(esq, base); break; // sela
        }
      }
    }
  }
  return segs;
}
