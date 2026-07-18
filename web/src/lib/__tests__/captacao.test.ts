import { describe, expect, it } from "vitest";
import {
  businessPlanPreenchidoDoJson,
  calcularBusinessPlan,
  calcularFonteCaptacao,
  taxaMensalEquivalente,
  type FonteCaptacao,
} from "@/lib/finance/captacao";

function fonte(overrides: Partial<FonteCaptacao>): FonteCaptacao {
  return {
    id: "1",
    nome: "Investidor A",
    capitalAportado: 100_000,
    remuneracaoPct: 1,
    periodoRemuneracao: "mensal",
    prazoResgateMeses: 12,
    ...overrides,
  };
}

describe("taxaMensalEquivalente", () => {
  it("mantém a taxa mensal quando o período já é mensal", () => {
    expect(taxaMensalEquivalente(1, "mensal")).toBeCloseTo(0.01, 6);
  });

  it("converte taxa anual para mensal composta equivalente", () => {
    const mensal = taxaMensalEquivalente(12.68, "anual");
    // (1+mensal)^12 deve reconstituir a taxa anual original
    expect(Math.pow(1 + mensal, 12) - 1).toBeCloseTo(0.1268, 4);
  });
});

describe("calcularFonteCaptacao", () => {
  it("aplica juros compostos mensais até o prazo de resgate", () => {
    const r = calcularFonteCaptacao(fonte({ capitalAportado: 100_000, remuneracaoPct: 1, periodoRemuneracao: "mensal", prazoResgateMeses: 12 }));
    expect(r.valorResgate).toBeCloseTo(100_000 * Math.pow(1.01, 12), 1);
    expect(r.custoTotal).toBeCloseTo(r.valorResgate - 100_000, 1);
  });

  it("prazo zero não gera custo (resgate imediato)", () => {
    const r = calcularFonteCaptacao(fonte({ prazoResgateMeses: 0 }));
    expect(r.valorResgate).toBe(100_000);
    expect(r.custoTotal).toBe(0);
  });
});

describe("calcularBusinessPlan", () => {
  it("agrega capital total captado e custo total de múltiplas fontes", () => {
    const r = calcularBusinessPlan([
      fonte({ id: "1", capitalAportado: 100_000, remuneracaoPct: 1, prazoResgateMeses: 12 }),
      fonte({ id: "2", capitalAportado: 200_000, remuneracaoPct: 1.5, prazoResgateMeses: 12 }),
    ]);
    expect(r.capitalTotalCaptado).toBe(300_000);
    expect(r.custoTotalCaptacao).toBeGreaterThan(0);
    expect(r.fontes).toHaveLength(2);
  });

  it("calcula o % do investimento total e o capital próprio necessário quando informado", () => {
    const r = calcularBusinessPlan(
      [fonte({ capitalAportado: 400_000 })],
      1_000_000
    );
    expect(r.pctDoInvestimentoTotal).toBeCloseTo(40, 1);
    expect(r.capitalProprioNecessario).toBeCloseTo(600_000, 0);
  });

  it("retorna null para os comparativos quando não há investimento total da Viabilidade", () => {
    const r = calcularBusinessPlan([fonte({})]);
    expect(r.pctDoInvestimentoTotal).toBeNull();
    expect(r.capitalProprioNecessario).toBeNull();
  });

  it("sem fontes, totais são zero e custo médio ponderado é zero", () => {
    const r = calcularBusinessPlan([]);
    expect(r.capitalTotalCaptado).toBe(0);
    expect(r.custoMedioPonderadoMensalPct).toBe(0);
  });
});

describe("businessPlanPreenchidoDoJson", () => {
  it("retorna false para JSON nulo ou corrompido", () => {
    expect(businessPlanPreenchidoDoJson(null)).toBe(false);
    expect(businessPlanPreenchidoDoJson("{invalido")).toBe(false);
  });

  it("retorna true quando há alguma fonte com capital aportado", () => {
    expect(businessPlanPreenchidoDoJson(JSON.stringify({ fontes: [fonte({})] }))).toBe(true);
  });

  it("retorna false quando as fontes têm capital zerado", () => {
    expect(businessPlanPreenchidoDoJson(JSON.stringify({ fontes: [fonte({ capitalAportado: 0 })] }))).toBe(false);
  });
});
