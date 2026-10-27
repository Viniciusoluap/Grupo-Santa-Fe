import { describe, expect, it } from "vitest";
import { calcularBaixa, saldoLancamento, valorRealizado } from "@/lib/bpo-parciais";
import { resumoPorCliente } from "@/lib/bpo-categorias";
import { montarDre, resumoContabil } from "@/lib/financeiro/bpo-resultado";

describe("recebimentos parciais BPO", () => {
  const base = { clienteId: "c1", tipo: "recebimento", categoria: "Recebimento de cliente", valor: 1000, valorRecebido: 0, pago: false, competencia: "2026-10" };
  it("só quita depois de completar o saldo e mantém centavos", () => {
    const parcial = { ...base, ...calcularBaixa(base, 350.01) };
    expect(parcial.pago).toBe(false);
    expect(saldoLancamento(parcial)).toBe(649.99);
    expect(calcularBaixa(parcial, 649.99)).toEqual({ valorRecebido: 1000, pago: true });
    expect(() => calcularBaixa(parcial, 650)).toThrow();
    expect(() => calcularBaixa(parcial, 0)).toThrow();
  });
  it("mantém receita por competência sem duplicar e caixa/saldo refletem apenas a baixa", () => {
    const parcial = { ...base, valorRecebido: 350 };
    expect(valorRealizado(parcial)).toBe(350);
    expect(resumoPorCliente([parcial]).get("c1")).toEqual({ recebido: 350, emAberto: 650 });
    expect(montarDre([parcial])).toEqual([{ competencia: "2026-10", receitas: 1000, despesas: 0, resultado: 1000 }]);
    expect(resumoContabil([parcial]).receitaRealizada).toBe(350);
    expect(resumoContabil([{ ...parcial, tipo: "despesa", categoria: "Material" }]).despesasPagas).toBe(350);
  });
  it("preserva comportamento de lançamento legado já pago", () => {
    expect(valorRealizado({ valor: 900, pago: true })).toBe(900);
    expect(saldoLancamento({ valor: 900, pago: true })).toBe(0);
  });
});
