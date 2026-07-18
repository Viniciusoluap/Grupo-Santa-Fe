import { describe, expect, it } from "vitest";
import {
  orcamentoPreliminarPreenchidoDoJson,
  resumoOrcamentoPreliminar,
  type ItemOrcamentoPreliminar,
} from "@/lib/incorporacao/orcamento-preliminar";

function item(overrides: Partial<ItemOrcamentoPreliminar>): ItemOrcamentoPreliminar {
  return {
    id: "1",
    categoria: "Estrutura",
    valorOrcado: 100_000,
    ...overrides,
  };
}

describe("resumoOrcamentoPreliminar", () => {
  it("soma o total orçado", () => {
    const r = resumoOrcamentoPreliminar([
      item({ id: "1", valorOrcado: 100_000 }),
      item({ id: "2", valorOrcado: 50_000 }),
    ]);
    expect(r.totalOrcado).toBe(150_000);
  });

  it("calcula a variação percentual contra o custo parametrizado de referência", () => {
    const r = resumoOrcamentoPreliminar([item({ valorOrcado: 120_000 })], 100_000);
    expect(r.custoParametrizadoReferencia).toBe(100_000);
    expect(r.variacaoPct).toBe(20);
  });

  it("retorna variação null quando não há referência da Viabilidade", () => {
    const r = resumoOrcamentoPreliminar([item({ valorOrcado: 120_000 })]);
    expect(r.custoParametrizadoReferencia).toBeNull();
    expect(r.variacaoPct).toBeNull();
  });

  it("lista vazia soma zero", () => {
    const r = resumoOrcamentoPreliminar([]);
    expect(r.totalOrcado).toBe(0);
  });
});

describe("orcamentoPreliminarPreenchidoDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(orcamentoPreliminarPreenchidoDoJson(null)).toBe(false);
    expect(orcamentoPreliminarPreenchidoDoJson("{invalido")).toBe(false);
    expect(orcamentoPreliminarPreenchidoDoJson(JSON.stringify({ itens: [] }))).toBe(false);
  });

  it("retorna true quando ao menos um item tem valor orçado", () => {
    expect(orcamentoPreliminarPreenchidoDoJson(JSON.stringify({ itens: [item({ valorOrcado: 1000 })] }))).toBe(true);
  });

  it("retorna false quando todos os itens têm valor zero", () => {
    expect(orcamentoPreliminarPreenchidoDoJson(JSON.stringify({ itens: [item({ valorOrcado: 0 })] }))).toBe(false);
  });
});
