import { describe, expect, it } from "vitest";
import { impedimentosExclusao, motivoBloqueioExclusao } from "@/lib/exclusao";

describe("regra de exclusão definitiva (item 03)", () => {
  it("sem vínculos com guarda obrigatória: pode excluir", () => {
    expect(motivoBloqueioExclusao("obra", {})).toBeNull();
    expect(motivoBloqueioExclusao("projeto", { valorPago: 0 })).toBeNull();
  });
  it("lista cada impedimento com plural correto", () => {
    expect(impedimentosExclusao({ movimentosFinanceiros: 1, recebimentos: 2, comissoes: 3, investidores: 1, unidadesComercializadas: 2 }))
      .toEqual(["1 movimento financeiro", "2 recebimentos", "3 comissões", "1 aporte de investidor", "2 unidades vendidas ou reservadas"]);
  });
  it("mensagem explica e orienta a cancelar, com concordância do módulo", () => {
    expect(motivoBloqueioExclusao("obra", { movimentosFinanceiros: 2 })).toMatch(/^Esta obra não pode ser excluída definitivamente porque tem 2 movimentos financeiros\..*Cancelar/);
    expect(motivoBloqueioExclusao("financiamento", { comissoes: 1 })).toMatch(/^Este financiamento não pode ser excluído/);
    expect(motivoBloqueioExclusao("comissao", { comissaoPaga: true })).toMatch(/pagamento já efetuado/);
  });
});
