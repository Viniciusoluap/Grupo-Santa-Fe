import { describe, expect, it } from "vitest";
import {
  orcamentoObraPreenchidoDoJson,
  resumoOrcamentoObra,
  type ItemOrcamentoObra,
} from "@/lib/incorporacao/orcamento-obra";

function item(overrides: Partial<ItemOrcamentoObra>): ItemOrcamentoObra {
  return { id: "1", categoria: "Estrutura", valorOrcado: 100_000, valorRealizado: 0, ...overrides };
}

describe("resumoOrcamentoObra", () => {
  it("soma orçado e realizado, calculando % executado", () => {
    const r = resumoOrcamentoObra([
      item({ id: "1", valorOrcado: 100_000, valorRealizado: 50_000 }),
      item({ id: "2", valorOrcado: 100_000, valorRealizado: 25_000 }),
    ]);
    expect(r.totalOrcado).toBe(200_000);
    expect(r.totalRealizado).toBe(75_000);
    expect(r.pctExecutado).toBe(37.5);
  });

  it("calcula a variação contra o orçamento preliminar de referência", () => {
    const r = resumoOrcamentoObra([item({ valorOrcado: 120_000 })], 100_000);
    expect(r.totalOrcamentoPreliminarReferencia).toBe(100_000);
    expect(r.variacaoVsPreliminarPct).toBe(20);
  });

  it("retorna variação null quando não há referência", () => {
    const r = resumoOrcamentoObra([item({ valorOrcado: 120_000 })]);
    expect(r.variacaoVsPreliminarPct).toBeNull();
  });

  it("lista vazia soma zero sem dividir por zero", () => {
    const r = resumoOrcamentoObra([]);
    expect(r.totalOrcado).toBe(0);
    expect(r.pctExecutado).toBe(0);
  });
});

describe("orcamentoObraPreenchidoDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(orcamentoObraPreenchidoDoJson(null)).toBe(false);
    expect(orcamentoObraPreenchidoDoJson("{invalido")).toBe(false);
    expect(orcamentoObraPreenchidoDoJson(JSON.stringify({ itens: [] }))).toBe(false);
  });

  it("retorna true quando ao menos um item tem valor realizado", () => {
    expect(orcamentoObraPreenchidoDoJson(JSON.stringify({ itens: [item({ valorRealizado: 1000 })] }))).toBe(true);
  });

  it("retorna false quando nenhum item tem valor realizado", () => {
    expect(orcamentoObraPreenchidoDoJson(JSON.stringify({ itens: [item({ valorRealizado: 0 })] }))).toBe(false);
  });
});
