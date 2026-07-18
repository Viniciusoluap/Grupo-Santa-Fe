import { describe, it, expect } from "vitest";
import {
  calcularPrecificacaoPorComparaveis,
  comparavelValido,
  type AtributoComparavel,
  type Comparavel,
} from "@/lib/mercado/precificacao";

const atributos: AtributoComparavel[] = [
  { nome: "Localização", peso: 3 },
  { nome: "Lazer e amenidades", peso: 2 },
  { nome: "Padrão construtivo", peso: 1 },
];

describe("comparavelValido", () => {
  it("é válido com preço e todas as notas preenchidas", () => {
    const c: Comparavel = { nome: "A", precoM2: 5000, notas: [3, 2, 1] };
    expect(comparavelValido(c, 3)).toBe(true);
  });
  it("é inválido sem preço", () => {
    const c: Comparavel = { nome: "A", precoM2: null, notas: [3, 2, 1] };
    expect(comparavelValido(c, 3)).toBe(false);
  });
  it("é inválido com nota faltando", () => {
    const c: Comparavel = { nome: "A", precoM2: 5000, notas: [3, 2] };
    expect(comparavelValido(c, 3)).toBe(false);
  });
});

describe("calcularPrecificacaoPorComparaveis", () => {
  it("empreendimento com nota igual à média dos comparáveis sugere o preço médio", () => {
    const comparaveis: Comparavel[] = [
      { nome: "Concorrente 1", precoM2: 6000, notas: [3, 3, 3] },
      { nome: "Concorrente 2", precoM2: 4000, notas: [3, 3, 3] },
    ];
    // nota do novo == nota dos comparáveis (todas 3) → preço sugerido == preço médio (5000)
    const r = calcularPrecificacaoPorComparaveis(atributos, [3, 3, 3], comparaveis);
    expect(r.precoMedioComparaveis).toBeCloseTo(5000, 2);
    expect(r.precoSugeridoM2).toBeCloseTo(5000, 2);
    expect(r.comparaveisValidos).toBe(2);
    expect(r.comparaveisIncompletos).toHaveLength(0);
  });

  it("empreendimento com nota melhor que a média sugere preço acima da média", () => {
    const comparaveis: Comparavel[] = [
      { nome: "Concorrente 1", precoM2: 5000, notas: [2, 2, 2] },
    ];
    const r = calcularPrecificacaoPorComparaveis(atributos, [3, 3, 3], comparaveis);
    expect(r.precoSugeridoM2).toBeGreaterThan(5000);
  });

  it("empreendimento com nota pior que a média sugere preço abaixo da média", () => {
    const comparaveis: Comparavel[] = [
      { nome: "Concorrente 1", precoM2: 5000, notas: [3, 3, 3] },
    ];
    const r = calcularPrecificacaoPorComparaveis(atributos, [1, 1, 1], comparaveis);
    expect(r.precoSugeridoM2).toBeLessThan(5000);
    expect(r.precoSugeridoM2).toBeGreaterThan(0);
  });

  it("ignora comparáveis incompletos e lista os nomes", () => {
    const comparaveis: Comparavel[] = [
      { nome: "Completo", precoM2: 5000, notas: [3, 3, 3] },
      { nome: "Sem preço", precoM2: null, notas: [3, 3, 3] },
      { nome: "Sem nota", precoM2: 4000, notas: [3, 3] },
    ];
    const r = calcularPrecificacaoPorComparaveis(atributos, [3, 3, 3], comparaveis);
    expect(r.comparaveisValidos).toBe(1);
    expect(r.comparaveisIncompletos).toEqual(["Sem preço", "Sem nota"]);
  });

  it("sem comparáveis válidos, preço sugerido é 0 (sem dado suficiente)", () => {
    const r = calcularPrecificacaoPorComparaveis(atributos, [3, 3, 3], []);
    expect(r.precoSugeridoM2).toBe(0);
    expect(r.comparaveisValidos).toBe(0);
  });

  it("pesos maiores dão mais peso ao atributo correspondente", () => {
    // Localização (peso 3) é o atributo mais importante.
    const notaAltaNaLocalizacao = calcularPrecificacaoPorComparaveis(atributos, [3, 1, 1], []);
    const notaAltaNoAcabamento = calcularPrecificacaoPorComparaveis(atributos, [1, 1, 3], []);
    expect(notaAltaNaLocalizacao.notaPonderadaNovo).toBeGreaterThan(notaAltaNoAcabamento.notaPonderadaNovo);
  });
});
