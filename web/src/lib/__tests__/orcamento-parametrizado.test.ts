import { describe, it, expect } from "vitest";
import { calcularOrcamentoParametrizado, type PremissasOrcamentoParametrizado } from "@/lib/orcamento/parametrizado";

const base: PremissasOrcamentoParametrizado = {
  itens: [
    { pavimento: "Torre padrão", areaM2: 10_000, coeficienteEquivalencia: 1.0 },
    { pavimento: "Garagem", areaM2: 4_000, coeficienteEquivalencia: 0.5 },
  ],
  custoM2Equivalente: 2000,
  passivoAmbiental: 100_000,
  decoracaoEquipamentos: 200_000,
  projetos: 50_000,
  previsaoInfra: 300_000,
  outros: 0,
};

describe("calcularOrcamentoParametrizado", () => {
  it("área equivalente pondera cada pavimento pelo seu coeficiente", () => {
    const r = calcularOrcamentoParametrizado(base);
    // 10000*1.0 + 4000*0.5 = 12000
    expect(r.areaEquivalenteTotalM2).toBeCloseTo(12_000, 2);
    expect(r.areaTotalM2).toBeCloseTo(14_000, 2);
  });

  it("custo de obra base = custo/m² equivalente × área equivalente total", () => {
    const r = calcularOrcamentoParametrizado(base);
    expect(r.custoObraBase).toBeCloseTo(2000 * 12_000, 2);
  });

  it("custo total soma o custo de obra base com os adicionais", () => {
    const r = calcularOrcamentoParametrizado(base);
    const esperado = 2000 * 12_000 + 100_000 + 200_000 + 50_000 + 300_000;
    expect(r.custoTotal).toBeCloseTo(esperado, 2);
  });

  it("custo/m² real usa a área total real, não a equivalente", () => {
    const r = calcularOrcamentoParametrizado(base);
    expect(r.custoM2Real).toBeCloseTo(r.custoTotal / 14_000, 2);
  });

  it("sem itens, tudo zero exceto os adicionais fixos", () => {
    const r = calcularOrcamentoParametrizado({ ...base, itens: [] });
    expect(r.areaTotalM2).toBe(0);
    expect(r.custoObraBase).toBe(0);
    expect(r.custoM2Real).toBe(0);
    expect(r.custoTotal).toBeCloseTo(100_000 + 200_000 + 50_000 + 300_000, 2);
  });
});
