import { describe, it, expect } from "vitest";
import {
  gerarCenariosMassa,
  criarProjecao,
  criarRng,
  areaPlanar,
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
});
