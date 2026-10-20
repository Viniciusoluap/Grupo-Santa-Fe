import { describe, expect, it } from "vitest";
import { resumirComissoes } from "../comissoes/listagem";

describe("Resumo de comissões filtradas", () => {
  it("soma o saldo parcial e pagamentos reais sem duplicar o cadastro manual da obra", () => {
    expect(resumirComissoes([{ calculo: { valorCentavos: 1150000, pagoCentavos: 300000, saldoCentavos: 850000 } }], [
      { id: 1, status: "pendente", valor: 11500 }, { id: 2, status: "paga", valor: 125.50 },
      { id: 3, status: "pendente", valor: 200.10 }, { id: 4, status: "aprovada", valor: 80.20 },
      { id: 5, status: "cancelada", valor: 900 },
    ], [1])).toEqual({ pendente: 8780.30, pago: 3125.50, aprovado: 80.20, geral: 11905.80 });
  });
  it("calcula sobre o subconjunto já filtrado e não inventa valor para dados incompletos", () => {
    expect(resumirComissoes([{ calculo: { valorCentavos: null, pagoCentavos: 10000, saldoCentavos: null } }], [], [])).toEqual({ pendente: 0, pago: 100, aprovado: 0, geral: 0 });
    expect(resumirComissoes([], [], [1])).toEqual({ pendente: 0, pago: 0, aprovado: 0, geral: 0 });
  });
  it("reconhece o vínculo por id mesmo com representação numérica diferente", () => {
    expect(resumirComissoes([], [{ id: "1", status: "paga", valor: 100 }], [1]).pago).toBe(0);
  });
});
