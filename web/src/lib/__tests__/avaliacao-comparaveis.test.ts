import { describe, expect, it } from "vitest";
import { normalizarComparaveis } from "../avaliacao-comparaveis";
describe("comparáveis da avaliação", () => {
  it("descarta anúncios inválidos e calcula médias a partir dos válidos", () => {
    const r = normalizarComparaveis({ comparaveis: [{ descricao: "Casa A", preco: 200000, area: 100, precoPorM2: 1 }, { descricao: "Casa B", preco: 300000, area: 100 }, { descricao: "Sem área", preco: 10, area: 0 }, { descricao: "Inválido", preco: Infinity, area: 10 }], valorMedio: 1 }, "Centro", "https://www.zapimoveis.com.br/");
    expect(r.valorMedio).toBe(250000);
    expect(r.precoPorM2Medio).toBe(2500);
    expect(r.totalEncontrados).toBe(2);
  });
  it("não produz uma avaliação de zero sem anúncios válidos", () => {
    expect(() => normalizarComparaveis({ comparaveis: [] }, "Centro", "")).toThrow("Nenhum anúncio");
  });
});
