import { describe, expect, it } from "vitest";
import {
  avancoFinanceiroProjetado,
  obraConcluidaDoJson,
  resumoCronogramaObra,
  type MedicaoMensal,
} from "@/lib/incorporacao/cronograma-obra";

function medicao(overrides: Partial<MedicaoMensal>): MedicaoMensal {
  return { id: "1", mes: 0, avancoFisicoAcumuladoPct: 0, ...overrides };
}

describe("avancoFinanceiroProjetado", () => {
  it("projeta desembolso linear ao longo da duração da obra", () => {
    expect(avancoFinanceiroProjetado(0, 12)).toBeCloseTo(8.3, 1);
    expect(avancoFinanceiroProjetado(11, 12)).toBe(100);
  });

  it("nunca ultrapassa 100%", () => {
    expect(avancoFinanceiroProjetado(20, 12)).toBe(100);
  });

  it("retorna null sem duração de obra válida", () => {
    expect(avancoFinanceiroProjetado(0, 0)).toBeNull();
  });
});

describe("resumoCronogramaObra", () => {
  it("calcula o desvio entre físico e financeiro projetado", () => {
    const r = resumoCronogramaObra(
      [medicao({ id: "1", mes: 0, avancoFisicoAcumuladoPct: 15 })],
      12
    );
    expect(r.itens[0].avancoFinanceiroProjetadoPct).toBeCloseTo(8.3, 1);
    expect(r.itens[0].desvioPct).toBeGreaterThan(0); // adiantado
  });

  it("usa a última medição (por mês) como avanço atual", () => {
    const r = resumoCronogramaObra(
      [
        medicao({ id: "1", mes: 2, avancoFisicoAcumuladoPct: 30 }),
        medicao({ id: "2", mes: 0, avancoFisicoAcumuladoPct: 10 }),
      ],
      12
    );
    expect(r.avancoFisicoAtualPct).toBe(30);
  });

  it("identifica obra concluída quando o físico chega a 100%", () => {
    const r = resumoCronogramaObra([medicao({ mes: 11, avancoFisicoAcumuladoPct: 100 })], 12);
    expect(r.obraConcluida).toBe(true);
  });

  it("sem duração de obra, financeiro projetado fica null", () => {
    const r = resumoCronogramaObra([medicao({})]);
    expect(r.itens[0].avancoFinanceiroProjetadoPct).toBeNull();
  });

  it("lista vazia não quebra", () => {
    const r = resumoCronogramaObra([], 12);
    expect(r.avancoFisicoAtualPct).toBe(0);
    expect(r.obraConcluida).toBe(false);
  });
});

describe("obraConcluidaDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(obraConcluidaDoJson(null)).toBe(false);
    expect(obraConcluidaDoJson("{invalido")).toBe(false);
    expect(obraConcluidaDoJson(JSON.stringify({ medicoes: [] }))).toBe(false);
  });

  it("retorna true quando a última medição indica 100% físico", () => {
    expect(
      obraConcluidaDoJson(JSON.stringify({ medicoes: [medicao({ mes: 5, avancoFisicoAcumuladoPct: 100 })] }))
    ).toBe(true);
  });
});
