import { describe, expect, it } from "vitest";
import {
  lancamentoImobiliarioComVendasDoJson,
  resumoLancamentoImobiliario,
  type VendaLancamento,
} from "@/lib/incorporacao/lancamento-imobiliario";

function venda(overrides: Partial<VendaLancamento>): VendaLancamento {
  return { id: "1", unidade: "Lote 01", valorVenda: 100_000, ...overrides };
}

describe("resumoLancamentoImobiliario", () => {
  it("soma unidades vendidas e VGV vendido", () => {
    const r = resumoLancamentoImobiliario([
      venda({ id: "1", valorVenda: 100_000 }),
      venda({ id: "2", valorVenda: 150_000 }),
    ]);
    expect(r.unidadesVendidas).toBe(2);
    expect(r.vgvVendido).toBe(250_000);
  });

  it("calcula percentuais contra a projeção quando informada", () => {
    const r = resumoLancamentoImobiliario(
      [venda({ id: "1", valorVenda: 100_000 }), venda({ id: "2", valorVenda: 100_000 })],
      10,
      1_000_000
    );
    expect(r.pctUnidadesVendidas).toBe(20);
    expect(r.pctVgvVendido).toBe(20);
  });

  it("retorna percentuais null quando não há projeção", () => {
    const r = resumoLancamentoImobiliario([venda({})]);
    expect(r.pctUnidadesVendidas).toBeNull();
    expect(r.pctVgvVendido).toBeNull();
  });

  it("lista vazia soma zero", () => {
    const r = resumoLancamentoImobiliario([]);
    expect(r.unidadesVendidas).toBe(0);
    expect(r.vgvVendido).toBe(0);
  });
});

describe("lancamentoImobiliarioComVendasDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(lancamentoImobiliarioComVendasDoJson(null)).toBe(false);
    expect(lancamentoImobiliarioComVendasDoJson("{invalido")).toBe(false);
    expect(lancamentoImobiliarioComVendasDoJson(JSON.stringify({ vendas: [] }))).toBe(false);
  });

  it("retorna true quando há ao menos uma venda registrada", () => {
    expect(lancamentoImobiliarioComVendasDoJson(JSON.stringify({ vendas: [venda({})] }))).toBe(true);
  });
});
