import { describe, it, expect } from "vitest";
import {
  gerarCenariosMassa,
  criarProjecao,
  criarRng,
  areaPlanar,
  validarParametrosMassa,
  type ParametrosMassa,
} from "@/lib/geo/massa";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { polygon as turfPolygon, point } from "@turf/helpers";
import type { Position } from "geojson";

// Gleba retangular ~400m x 250m (~10 ha) em Canaã dos Carajás.
const CENTRO: [number, number] = [-49.879, -6.5];
const proj = criarProjecao(CENTRO);
const anelGeo: Position[] = (
  [
    [-200, -125], [200, -125], [200, 125], [-200, 125], [-200, -125],
  ] as Position[]
).map((p) => proj.paraGeo(p));

const PARAMS: ParametrosMassa = {
  larguraViaM: 12,
  testadaLoteM: 10,
  profundidadeLoteM: 25,
  loteMinimoM2: 250,
  comprimentoMaxQuadraM: 120,
  percentInstitucional: 0.05,
  percentAreaVerde: 0.1,
  precoM2Lote: 500,
};

describe("criarProjecao", () => {
  it("ida e volta preserva coordenadas (~1e-6 graus)", () => {
    const geo: Position = [-49.8785, -6.4995];
    const m = proj.paraMetros(geo);
    const volta = proj.paraGeo(m);
    expect(volta[0]).toBeCloseTo(geo[0], 6);
    expect(volta[1]).toBeCloseTo(geo[1], 6);
  });
});

describe("areaPlanar", () => {
  it("área do retângulo 400x250 = 100.000 m²", () => {
    const anelM: Position[] = [
      [-200, -125], [200, -125], [200, 125], [-200, 125], [-200, -125],
    ];
    expect(areaPlanar(anelM)).toBe(100_000);
  });
});

describe("criarRng", () => {
  it("é determinístico para a mesma seed", () => {
    const a = criarRng(7), b = criarRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("gerarCenariosMassa", () => {
  const cenarios = gerarCenariosMassa(anelGeo, CENTRO, PARAMS, {
    populacao: 8,
    geracoes: 5,
    seed: 42,
    nCenarios: 2,
  });

  it("retorna o nº de cenários pedido", () => {
    expect(cenarios.length).toBe(2);
  });

  it("gera lotes vendáveis em quantidade plausível para 10 ha", () => {
    const c = cenarios[0];
    // 10 ha com lotes ~250-400 m² e 35% de perdas → dezenas a centenas de lotes
    expect(c.kpis.lotesVendaveis).toBeGreaterThan(50);
    expect(c.kpis.lotesVendaveis).toBeLessThan(400);
  });

  it("todos os lotes têm área ≥ lote mínimo (com tolerância de clip 60%)", () => {
    for (const l of cenarios[0].lotes) {
      expect(l.areaM2).toBeGreaterThanOrEqual(PARAMS.loteMinimoM2 * 0.6 - 1);
    }
  });

  it("centro de cada lote está dentro da gleba", () => {
    const gleba = turfPolygon([anelGeo]);
    for (const l of cenarios[0].lotes.slice(0, 40)) {
      const cx = l.anel.reduce((s, p) => s + p[0], 0) / l.anel.length;
      const cy = l.anel.reduce((s, p) => s + p[1], 0) / l.anel.length;
      expect(booleanPointInPolygon(point([cx, cy]), gleba)).toBe(true);
    }
  });

  it("reserva área pública ≥ 15% da gleba (institucional+verde)", () => {
    const c = cenarios[0];
    const areaGleba = 100_000;
    expect(c.kpis.areaPublicaM2).toBeGreaterThanOrEqual(0.15 * areaGleba * 0.9); // tolerância granularidade
  });

  it("aproveitamento entre 30% e 75% (faixa realista de loteamentos)", () => {
    const c = cenarios[0];
    expect(c.kpis.aproveitamento).toBeGreaterThan(0.3);
    expect(c.kpis.aproveitamento).toBeLessThan(0.75);
  });

  it("VGV = área vendável × preço/m²", () => {
    const c = cenarios[0];
    expect(c.kpis.vgv).toBe(Math.round(c.kpis.areaVendavelM2 * PARAMS.precoM2Lote));
  });

  it("é determinístico com a mesma seed", () => {
    const outra = gerarCenariosMassa(anelGeo, CENTRO, PARAMS, {
      populacao: 8, geracoes: 5, seed: 42, nCenarios: 2,
    });
    expect(outra[0].kpis.vgv).toBe(cenarios[0].kpis.vgv);
    expect(outra[0].anguloVia).toBe(cenarios[0].anguloVia);
  });

  it("VGV recalculado a partir de um preço digitado em formato BR (vírgula) confere", () => {
    // Simula o usuário digitando "1.234,56" no campo de preço/m² — o valor
    // já deve chegar parseado corretamente (função testada em utils.test.ts);
    // aqui validamos que o motor de VGV responde de forma consistente ao
    // trocar apenas o preço, mantendo a área vendável.
    const precoBR = 1234.56; // resultado de parseNumeroBR("1.234,56")
    const comPrecoBR = gerarCenariosMassa(anelGeo, CENTRO, { ...PARAMS, precoM2Lote: precoBR }, {
      populacao: 8, geracoes: 5, seed: 42, nCenarios: 2,
    });
    expect(comPrecoBR[0].kpis.areaVendavelM2).toBe(cenarios[0].kpis.areaVendavelM2);
    expect(comPrecoBR[0].kpis.vgv).toBe(Math.round(comPrecoBR[0].kpis.areaVendavelM2 * precoBR));
  });
});

describe("validarParametrosMassa", () => {
  it("aceita os parâmetros padrão (válidos)", () => {
    expect(validarParametrosMassa(PARAMS)).toBeNull();
  });

  it("rejeita testada do lote igual a 0 (travaria o laço de geração em loop infinito)", () => {
    expect(validarParametrosMassa({ ...PARAMS, testadaLoteM: 0 })).toMatch(/testada/i);
  });

  it("rejeita testada do lote negativa", () => {
    expect(validarParametrosMassa({ ...PARAMS, testadaLoteM: -5 })).toMatch(/testada/i);
  });

  it("rejeita profundidade do lote igual a 0", () => {
    expect(validarParametrosMassa({ ...PARAMS, profundidadeLoteM: 0 })).toMatch(/profundidade/i);
  });

  it("rejeita comprimento máximo de quadra igual a 0", () => {
    expect(validarParametrosMassa({ ...PARAMS, comprimentoMaxQuadraM: 0 })).toMatch(/quadra/i);
  });

  it("rejeita lote mínimo negativo", () => {
    expect(validarParametrosMassa({ ...PARAMS, loteMinimoM2: -1 })).toMatch(/mínimo/i);
  });

  it("rejeita largura de via negativa", () => {
    expect(validarParametrosMassa({ ...PARAMS, larguraViaM: -1 })).toMatch(/via/i);
  });

  it("rejeita percentual institucional >= 100%", () => {
    expect(validarParametrosMassa({ ...PARAMS, percentInstitucional: 1 })).toMatch(/institucional/i);
  });

  it("rejeita percentual de área verde negativo", () => {
    expect(validarParametrosMassa({ ...PARAMS, percentAreaVerde: -0.1 })).toMatch(/verde/i);
  });

  it("rejeita soma de institucional + área verde >= 100%", () => {
    expect(
      validarParametrosMassa({ ...PARAMS, percentInstitucional: 0.5, percentAreaVerde: 0.5 })
    ).toMatch(/soma/i);
  });

  it("rejeita preço do lote igual a 0", () => {
    expect(validarParametrosMassa({ ...PARAMS, precoM2Lote: 0 })).toMatch(/preço/i);
  });

  it("rejeita preço do lote negativo", () => {
    expect(validarParametrosMassa({ ...PARAMS, precoM2Lote: -500 })).toMatch(/preço/i);
  });

  it("rejeita valores não finitos (NaN vindo de um parse inválido)", () => {
    expect(validarParametrosMassa({ ...PARAMS, testadaLoteM: NaN })).toMatch(/testada/i);
  });
});
