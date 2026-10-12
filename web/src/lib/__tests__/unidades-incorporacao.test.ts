import { describe, expect, it } from "vitest";
import { chaveUnidade, vendasLegadas } from "../incorporacao/unidades";

describe("inventário e reconciliação histórica", () => {
  it("normaliza somente a identidade exata da unidade", () => {
    expect(chaveUnidade("  Lote   12 ")).toBe("LOTE 12");
    expect(chaveUnidade("Lote 012")).not.toBe(chaveUnidade("Lote 12"));
  });
  it("preserva pendências inválidas sem criar venda automática", () => {
    expect(vendasLegadas(JSON.stringify({ vendas: [{ id: "1", unidade: "Lote 1", comprador: "", valorVenda: 0 }] }))).toEqual({ vendas: [], invalido: true });
    expect(vendasLegadas(JSON.stringify({ vendas: [
      { id: "1", unidade: "Lote 1", comprador: "Ana", valorVenda: 100 },
      { id: "2", unidade: "lote  1", comprador: "Bia", valorVenda: 200 },
    ] })).invalido).toBe(true);
    expect(vendasLegadas(JSON.stringify({ vendas: [{ id: "1", unidade: "Lote 1", comprador: "Ana", valorVenda: 100 }] })).vendas).toHaveLength(1);
  });
});
