import { describe, it, expect } from "vitest";
import {
  calcularVgv,
  calcularAreaVendavel,
  calcularCustoTerreno,
  vpl,
  tir,
  payback,
  calcularEve,
  analiseSensibilidade,
  type EveInput,
  type UnidadeMix,
} from "@/lib/finance/eve";

const mix: UnidadeMix[] = [
  { nome: "Lote 300m²", quantidade: 100, areaUnidadeM2: 300, precoM2: 500 },
  { nome: "Lote 450m²", quantidade: 20, areaUnidadeM2: 450, precoM2: 480 },
];

describe("calcularVgv / calcularAreaVendavel", () => {
  it("VGV soma quantidade × área × preço/m²", () => {
    // 100*300*500 = 15.000.000 ; 20*450*480 = 4.320.000
    expect(calcularVgv(mix)).toBe(19_320_000);
  });
  it("área vendável soma quantidade × área", () => {
    // 100*300 + 20*450 = 39.000
    expect(calcularAreaVendavel(mix)).toBe(39_000);
  });
  it("VGV de mix vazio é zero", () => {
    expect(calcularVgv([])).toBe(0);
  });
});

describe("calcularCustoTerreno", () => {
  const vgv = 10_000_000;
  it("compra usa valorCompra", () => {
    expect(calcularCustoTerreno({ tipo: "compra", valorCompra: 2_000_000 }, mix, vgv)).toBe(2_000_000);
  });
  it("permuta financeira usa % do VGV", () => {
    expect(calcularCustoTerreno({ tipo: "permuta_financeira", percentualVgv: 0.15 }, mix, vgv)).toBe(1_500_000);
  });
  it("permuta física usa valor médio das unidades", () => {
    // 120 unidades, VGV 10MM → média 83.333,33/unid; 12 permutadas → 1.000.000
    const r = calcularCustoTerreno({ tipo: "permuta_fisica", unidadesPermutadas: 12 }, mix, vgv);
    expect(Math.round(r)).toBe(1_000_000);
  });
});

describe("vpl", () => {
  it("VPL com taxa zero é a soma simples", () => {
    expect(vpl([-100, 50, 60], 0)).toBeCloseTo(10, 6);
  });
  it("VPL desconta fluxos futuros", () => {
    const v = vpl([-100, 110], 0.1); // -100 + 110/1.1 = 0
    expect(v).toBeCloseTo(0, 6);
  });
});

describe("tir", () => {
  it("encontra a taxa que zera o VPL", () => {
    const t = tir([-100, 110]); // 10%
    expect(t).not.toBeNull();
    expect(t!).toBeCloseTo(0.1, 3);
  });
  it("retorna null quando não há troca de sinal", () => {
    expect(tir([100, 110, 120])).toBeNull();
  });
});

describe("payback", () => {
  it("retorna o primeiro mês com saldo acumulado ≥ 0", () => {
    expect(payback([-100, -50, 10, 80])).toBe(2);
  });
  it("retorna null se nunca recupera", () => {
    expect(payback([-100, -90, -80])).toBeNull();
  });
});

describe("calcularEve (integração)", () => {
  const input: EveInput = {
    mix,
    terreno: { tipo: "compra", valorCompra: 3_000_000, mesPagamento: 0 },
    custos: { custoObraM2: 150, indiretosPercentualVgv: 0.12, comissaoPercentualVgv: 0.05 },
    cronograma: { mesesObra: 12, mesesVendas: 18, inicioObraMes: 0, inicioVendasMes: 0 },
    financeiro: { taxaDescontoMensal: 0.008, indexacaoMensal: 0.005, entradaPercentual: 0.2 },
  };

  const r = calcularEve(input);

  it("VGV e área conferem", () => {
    expect(r.vgv).toBe(19_320_000);
    expect(r.areaVendavelM2).toBe(39_000);
  });
  it("custo de obra = área × custo/m²", () => {
    expect(r.custoObraTotal).toBe(39_000 * 150);
  });
  it("custo total soma todos os componentes", () => {
    const esperado =
      r.custoObraTotal + r.custoTerreno + r.custosIndiretos + r.comissaoTotal;
    expect(r.custoTotal).toBeCloseTo(esperado, 2);
  });
  it("lucro bruto = VGV - custo total e margem = lucro / VGV", () => {
    expect(r.lucroBruto).toBeCloseTo(r.vgv - r.custoTotal, 2);
    expect(r.margemLiquida).toBeCloseTo(r.lucroBruto / r.vgv, 6);
  });
  it("gera fluxo de caixa mensal não vazio", () => {
    expect(r.fluxo.length).toBeGreaterThan(0);
    expect(r.fluxo[0].mes).toBe(0);
  });
  it("exposição máxima é não-negativa", () => {
    expect(r.exposicaoMaxima).toBeGreaterThanOrEqual(0);
  });
  it("soma das receitas do fluxo aproxima o VGV (com indexação, ≥ VGV)", () => {
    const totalReceitas = r.fluxo.reduce((s, f) => s + f.receitas, 0);
    expect(totalReceitas).toBeGreaterThan(r.vgv * 0.99);
  });

  describe("analiseSensibilidade", () => {
    const sens = analiseSensibilidade(input, [-0.1, 0.1]);

    it("gera 6 cenários (3 variáveis × 2 deltas)", () => {
      expect(sens.length).toBe(6);
    });
    it("preço +10% aumenta VGV e margem; -10% reduz", () => {
      const mais = sens.find((s) => s.variavel === "preco" && s.delta === 0.1)!;
      const menos = sens.find((s) => s.variavel === "preco" && s.delta === -0.1)!;
      expect(mais.vgv).toBeGreaterThan(r.vgv);
      expect(menos.vgv).toBeLessThan(r.vgv);
      expect(mais.margemLiquida).toBeGreaterThan(r.margemLiquida);
      expect(menos.margemLiquida).toBeLessThan(r.margemLiquida);
    });
    it("custo +10% reduz a margem; -10% aumenta", () => {
      const mais = sens.find((s) => s.variavel === "custo" && s.delta === 0.1)!;
      const menos = sens.find((s) => s.variavel === "custo" && s.delta === -0.1)!;
      expect(mais.margemLiquida).toBeLessThan(r.margemLiquida);
      expect(menos.margemLiquida).toBeGreaterThan(r.margemLiquida);
    });
    it("VGV não muda com velocidade de vendas (só o fluxo)", () => {
      const v = sens.find((s) => s.variavel === "velocidade_vendas" && s.delta === 0.1)!;
      expect(v.vgv).toBe(r.vgv);
    });
  });
});
