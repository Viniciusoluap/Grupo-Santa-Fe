import { describe, it, expect } from "vitest";
import { calcularPotencial, PARAMETROS_DEFAULT, type ParametrosUrbanisticos } from "@/lib/urbanismo/potencial";

const P: ParametrosUrbanisticos = {
  zona: "ZR2",
  taxaOcupacao: 0.6,
  coefAproveitamento: 2.0,
  recuoFrontalM: 3,
  recuoLateralM: 1.5,
  recuoFundosM: 3,
  loteMinimoM2: 250,
  testadaMinimaM: 10,
  gabaritoPavimentos: 4,
  percentInstitucional: 0.05,
  percentAreaVerde: 0.1,
  percentViario: 0.2,
  vagasPorUnidade: 1.5,
};

describe("calcularPotencial", () => {
  const area = 100_000; // 10 ha
  const r = calcularPotencial(area, P, 60);

  it("área edificável = área × CA", () => {
    expect(r.areaEdificavelMaxM2).toBe(200_000);
  });
  it("projeção máxima no térreo = área × TO", () => {
    expect(r.projecaoMaxTerreoM2).toBe(60_000);
  });
  it("doações = 35% (5+10+20) e loteável líquida = 65%", () => {
    expect(r.areaDoacaoM2).toBe(35_000);
    expect(r.areaLoteavelLiquidaM2).toBe(65_000);
  });
  it("lotes máx = líquida / lote mínimo (floor)", () => {
    expect(r.lotesMax).toBe(260); // 65000/250
  });
  it("unidades máx = edificável / área média (floor)", () => {
    expect(r.unidadesMaxVertical).toBe(3333); // 200000/60
  });
  it("vagas exigidas = unidades × vagas/unid (ceil)", () => {
    expect(r.vagasExigidas).toBe(5000); // 3333*1.5=4999.5 → 5000
  });
  it("sem área média → unidades e vagas null", () => {
    const s = calcularPotencial(area, P);
    expect(s.unidadesMaxVertical).toBeNull();
    expect(s.vagasExigidas).toBeNull();
  });
  it("doações acima de 100% são limitadas (líquida ≥ 0)", () => {
    const exagerado = { ...P, percentInstitucional: 0.5, percentAreaVerde: 0.4, percentViario: 0.3 };
    const s = calcularPotencial(1000, exagerado);
    expect(s.areaLoteavelLiquidaM2).toBe(0);
    expect(s.lotesMax).toBe(0);
  });
  it("defaults são sensatos (TO ≤ 1, CA > 0, lote mínimo > 0)", () => {
    expect(PARAMETROS_DEFAULT.taxaOcupacao).toBeLessThanOrEqual(1);
    expect(PARAMETROS_DEFAULT.coefAproveitamento).toBeGreaterThan(0);
    expect(PARAMETROS_DEFAULT.loteMinimoM2).toBeGreaterThan(0);
  });
});
