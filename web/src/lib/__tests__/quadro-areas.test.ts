import { describe, it, expect } from "vitest";
import { calcularQuadroAreas, type ItemQuadroAreas } from "@/lib/urbanismo/quadro-areas";

const itens: ItemQuadroAreas[] = [
  { pavimento: "Térreo", areaConstCobertaM2: 1000, areaConstDescobertaM2: 100, areaUrbanizadaM2: 200, areaDescontarM2: 50, areaComputavelM2: 950, areaPrivativaM2: 800 },
  { pavimento: "Torre A", areaConstCobertaM2: 4000, areaConstDescobertaM2: 0, areaUrbanizadaM2: 0, areaDescontarM2: 400, areaComputavelM2: 3600, areaPrivativaM2: 3200 },
];

describe("calcularQuadroAreas", () => {
  it("soma ACC, área construída descoberta e ACT corretamente", () => {
    const r = calcularQuadroAreas(itens, 10_000, 1.0);
    expect(r.areaConstCobertaTotalM2).toBeCloseTo(5000, 2);
    expect(r.areaConstDescobertaTotalM2).toBeCloseTo(100, 2);
    expect(r.areaConstTotalM2).toBeCloseTo(5100, 2);
  });

  it("soma APV e área computável", () => {
    const r = calcularQuadroAreas(itens, 10_000, 1.0);
    expect(r.areaPrivativaTotalM2).toBeCloseTo(4000, 2);
    expect(r.areaComputavelTotalM2).toBeCloseTo(4550, 2);
  });

  it("índice APV/ACC é a eficiência real", () => {
    const r = calcularQuadroAreas(itens, 10_000, 1.0);
    expect(r.indiceApvAcc).toBeCloseTo(4000 / 5000, 4);
  });

  it("área computável máxima = área do terreno × coeficiente de aproveitamento", () => {
    const r = calcularQuadroAreas(itens, 10_000, 1.5);
    expect(r.areaComputavelMaximaM2).toBeCloseTo(15_000, 2);
    expect(r.aproveitamentoPct).toBeCloseTo(4550 / 15_000, 4);
    expect(r.excedeCoeficiente).toBe(false);
  });

  it("sinaliza quando a área computável excede o coeficiente do terreno", () => {
    const r = calcularQuadroAreas(itens, 1000, 1.0); // máximo = 1000 m², usado = 4550 m²
    expect(r.excedeCoeficiente).toBe(true);
  });

  it("sem itens, tudo zero e não excede", () => {
    const r = calcularQuadroAreas([], 10_000, 1.0);
    expect(r.areaComputavelTotalM2).toBe(0);
    expect(r.indiceApvAcc).toBe(0);
    expect(r.excedeCoeficiente).toBe(false);
  });
});
