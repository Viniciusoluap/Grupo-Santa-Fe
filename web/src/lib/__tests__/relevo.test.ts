import { describe, it, expect } from "vitest";
import {
  declividadeGrade,
  declividadeMedia,
  distribuicaoDeclividade,
  indiceFaixa,
  celulaEmMetros,
  FAIXAS_DECLIVIDADE,
  type GridElevacaoLike,
} from "@/lib/geo/relevo";

describe("indiceFaixa", () => {
  it("classifica cada faixa corretamente", () => {
    expect(indiceFaixa(0)).toBe(0);    // plano
    expect(indiceFaixa(4.9)).toBe(0);
    expect(indiceFaixa(5)).toBe(1);    // leve
    expect(indiceFaixa(12)).toBe(2);   // moderado
    expect(indiceFaixa(20)).toBe(3);   // íngreme
    expect(indiceFaixa(30)).toBe(4);   // inviável
    expect(indiceFaixa(999)).toBe(4);
  });
});

describe("declividadeGrade", () => {
  it("terreno plano tem declividade ~0%", () => {
    const grid: GridElevacaoLike = {
      ncols: 3, nrows: 3, min: 100, max: 100,
      z: [[100, 100, 100], [100, 100, 100], [100, 100, 100]],
    };
    const slopes = declividadeGrade(grid, 30, 30);
    for (const linha of slopes) for (const s of linha) expect(s).toBeCloseTo(0, 5);
  });

  it("rampa constante de 10 m a cada 100 m dá ~10% de declividade", () => {
    // z aumenta 10 m por célula na direção X; célula = 100 m.
    const grid: GridElevacaoLike = {
      ncols: 3, nrows: 3, min: 0, max: 20,
      z: [[0, 10, 20], [0, 10, 20], [0, 10, 20]],
    };
    const slopes = declividadeGrade(grid, 100, 100);
    // centro: gradiente (20-0)/(2*100)=0.1 → 10%
    expect(slopes[1][1]).toBeCloseTo(10, 5);
  });
});

describe("distribuicaoDeclividade", () => {
  it("soma das frações é ~1 e conta todas as células", () => {
    const slopes = [[0, 6], [12, 30]]; // plano, leve, moderado, inviável
    const dist = distribuicaoDeclividade(slopes);
    expect(dist).toHaveLength(FAIXAS_DECLIVIDADE.length);
    const somaPct = dist.reduce((s, f) => s + f.pct, 0);
    expect(somaPct).toBeCloseTo(1, 5);
    const somaCel = dist.reduce((s, f) => s + f.celulas, 0);
    expect(somaCel).toBe(4);
    expect(dist[0].celulas).toBe(1); // plano
    expect(dist[4].celulas).toBe(1); // inviável
  });
});

describe("declividadeMedia", () => {
  it("média simples das células", () => {
    expect(declividadeMedia([[10, 20], [30, 40]])).toBeCloseTo(25, 5);
    expect(declividadeMedia([])).toBe(0);
  });
});

describe("celulaEmMetros", () => {
  it("no equador, 1 grau de lng ≈ 111 km", () => {
    const { x } = celulaEmMetros(1, 1, 0);
    expect(x).toBeGreaterThan(111_000);
    expect(x).toBeLessThan(111_500);
  });
  it("em latitude alta o metro por grau de lng diminui", () => {
    const eq = celulaEmMetros(1, 1, 0).x;
    const alto = celulaEmMetros(1, 1, 60).x;
    expect(alto).toBeLessThan(eq);
  });
});

import {
  upsampleBilinear, suavizarGrade, pontoNoPoligono, passoNivel, isolinhas,
} from "@/lib/geo/relevo";

describe("upsampleBilinear", () => {
  it("dobra a resolução preservando os cantos e interpolando o meio", () => {
    const g: GridElevacaoLike = { ncols: 2, nrows: 2, min: 0, max: 10, z: [[0, 10], [0, 10]] };
    const up = upsampleBilinear(g, 2);
    expect(up.ncols).toBe(3);
    expect(up.nrows).toBe(3);
    expect(up.z[0][0]).toBeCloseTo(0, 6);
    expect(up.z[0][2]).toBeCloseTo(10, 6);
    expect(up.z[1][1]).toBeCloseTo(5, 6); // centro interpolado
  });
  it("fator 1 devolve a própria grade", () => {
    const g: GridElevacaoLike = { ncols: 2, nrows: 2, min: 0, max: 1, z: [[0, 1], [0, 1]] };
    expect(upsampleBilinear(g, 1)).toBe(g);
  });
});

describe("suavizarGrade", () => {
  it("reduz um pico isolado sem mudar dimensões", () => {
    const g: GridElevacaoLike = {
      ncols: 3, nrows: 3, min: 0, max: 90,
      z: [[0, 0, 0], [0, 90, 0], [0, 0, 0]],
    };
    const s = suavizarGrade(g, 1);
    expect(s.ncols).toBe(3);
    expect(s.z[1][1]).toBeCloseTo(10, 6); // 90/9
    expect(s.z[1][1]).toBeLessThan(90);
  });
});

describe("pontoNoPoligono", () => {
  const quadrado: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  it("dentro/fora do quadrado", () => {
    expect(pontoNoPoligono(5, 5, quadrado)).toBe(true);
    expect(pontoNoPoligono(15, 5, quadrado)).toBe(false);
    expect(pontoNoPoligono(-1, -1, quadrado)).toBe(false);
  });
});

describe("passoNivel", () => {
  it("escolhe passo redondo com no máx. o alvo de curvas", () => {
    expect(passoNivel(24, 10)).toBe(2.5);  // 24/2.5 = 9.6 curvas
    expect(passoNivel(100, 10)).toBe(10);
    expect(passoNivel(4, 10)).toBe(0.5);
  });
});

describe("isolinhas", () => {
  it("rampa simples gera segmentos contínuos no nível médio", () => {
    // rampa de 0 a 10 na horizontal; nível 5 deve cruzar no meio (col=0.5 numa grade 2x2 de 0..10)
    const g: GridElevacaoLike = { ncols: 2, nrows: 2, min: 0, max: 10, z: [[0, 10], [0, 10]] };
    const segs = isolinhas(g, [5]);
    expect(segs.length).toBe(1);
    const s = segs[0];
    expect(s.a[0]).toBeCloseTo(0.5, 6); // cruza a meia coluna
    expect(s.b[0]).toBeCloseTo(0.5, 6);
  });
  it("nível fora da faixa não gera segmentos", () => {
    const g: GridElevacaoLike = { ncols: 2, nrows: 2, min: 0, max: 10, z: [[0, 10], [0, 10]] };
    expect(isolinhas(g, [50])).toHaveLength(0);
  });
});
