import { describe, expect, it } from "vitest";
import { ehReceitaProspecta, indicadoresRegularizacao } from "./indicadores-regularizacao";

describe("indicadores de receitas da regularização", () => {
  it("reconhece apenas as chaves próprias e nomes legados inequívocos", () => {
    expect(ehReceitaProspecta({ chavePadrao: "cnd_cno", nome: "Certidão alterada" })).toBe(true);
    expect(ehReceitaProspecta({ nome: "Água" })).toBe(true);
    expect(ehReceitaProspecta({ nome: "CND/CNO" })).toBe(true);
    expect(ehReceitaProspecta({ chavePadrao: "art", nome: "Projetos" })).toBe(false);
    expect(ehReceitaProspecta({ nome: "Certidão de inteiro teor" })).toBe(false);
  });

  it("soma previsto e parcelas confirmadas sem repetir IDs nem incluir terceiros ou cancelados", () => {
    const processos = [{ id: 1, status: "em_andamento" }, { id: 2, status: "concluido" }, { id: 3, status: "cancelado" }];
    const itens = [
      { id: 10, regularizacaoId: 1, chavePadrao: "projetos", nome: "Projetos", previsto: "100.00" },
      { id: 11, regularizacaoId: 1, chavePadrao: "art", nome: "ART", previsto: "50.00" },
      { id: 12, regularizacaoId: 2, chavePadrao: null, nome: "Água", previsto: "40.00" },
      { id: 13, regularizacaoId: 3, chavePadrao: "pci", nome: "PCI", previsto: "90.00" },
    ];
    const recebimentos = [
      { id: 1, regularizacaoId: 1, itemId: 10, valor: "30.00", status: "confirmado" },
      { id: 2, regularizacaoId: 1, itemId: 10, valor: "20.00", status: "confirmado" },
      { id: 2, regularizacaoId: 1, itemId: 10, valor: "20.00", status: "confirmado" },
      { id: 3, regularizacaoId: 1, itemId: 10, valor: "10.00", status: "cancelado" },
      { id: 4, regularizacaoId: 1, itemId: 11, valor: "50.00", status: "confirmado" },
      { id: 5, regularizacaoId: 2, itemId: 12, valor: "40.00", status: "confirmado" },
      { id: 6, regularizacaoId: 3, itemId: 13, valor: "90.00", status: "confirmado" },
    ];
    expect(indicadoresRegularizacao(processos, itens, recebimentos)).toEqual({ contratado: 14000, recebido: 9000 });
  });
});
