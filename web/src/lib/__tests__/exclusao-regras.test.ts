import { describe, expect, it } from "vitest";
import { itensExcluidosJunto } from "@/lib/exclusao";

describe("exclusão definitiva (item 03 + pedido A6)", () => {
  it("sem vínculos: só o registro sai", () => {
    expect(itensExcluidosJunto({})).toEqual([]);
  });
  it("lista o que sai junto, com plural correto", () => {
    expect(itensExcluidosJunto({ movimentosFinanceiros: 1, recebimentos: 2, comissoes: 3, investidores: 1, medicoes: 2, unidades: 2 }))
      .toEqual(["1 movimento financeiro", "2 recebimentos", "3 comissões", "1 aporte de investidor", "2 medições", "2 unidades"]);
  });
});
