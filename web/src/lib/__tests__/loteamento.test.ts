import { describe, it, expect } from "vitest";
import {
  calcularUrbanistico,
  calcularMix,
  calcularLoteamento,
  calcularCenarios,
  pesosCurvaVendas,
  type PremissasLoteamento,
} from "@/lib/finance/loteamento";

const base: PremissasLoteamento = {
  areaBrutaM2: 762_145,
  pctAreaPublica: 0.10,
  pctAreaVerde: 0.05,
  pctSistemaViario: 0.312,
  pctAPP: 0.036,
  pctFaixaServidao: 0.026,
  itensMix: [{ nome: "Lote padrão", quantidade: 2000, areaUnidadeM2: 160, precoM2: 500 }],
  duracaoVendasMeses: 24,
  perfilVendas: "lancamento_forte",
  entradaPct: 0.10,
  prazoParcelamentoMeses: 180,
  jurosClienteMensal: 0.0052,
  indexacaoMensal: 0.004,
  vendasAVistaPct: 0.05,
  descontoAVistaPct: 0.10,
  inadimplenciaPct: 0.05,
  comissaoPctVgv: 0.05,
  despesasGeraisPctVgv: 0.03,
  impostosPctVgv: 0.0658,
  taxaIncorporacaoPctVgv: 0.01,
  inicioObraMes: 0,
  duracaoObraMeses: 24,
  inicioVendasMes: 12,
  custoInfraM2Lote: 245,
  projetosLicencas: 500_000,
  marketing: 500_000,
  registroPorUnidade: 400,
  contingenciaPctInfra: 0.10,
  bdiPct: 0.10,
  taxaAdministracaoObraPct: 0.10,
  manutencaoPctObra: 0.015,
  inccObraMensal: 0.003,
  permutaPctVgv: 0.40,
  taxaDescontoAnual: 0.12,
};

describe("calcularUrbanistico", () => {
  it("área vendável = bruta − deduções", () => {
    const u = calcularUrbanistico(base);
    const somaDeducoes =
      u.areaPublicaM2 + u.areaVerdeM2 + u.areaViarioM2 + u.areaAppM2 + u.areaServidaoM2;
    expect(u.areaVendavelM2).toBeCloseTo(base.areaBrutaM2 - somaDeducoes, 2);
    // Taxa de aproveitamento ~47.6% (padrão do estudo de referência)
    expect(u.taxaAproveitamento).toBeGreaterThan(0.45);
    expect(u.taxaAproveitamento).toBeLessThan(0.50);
  });
});

describe("calcularMix", () => {
  it("VGV do mix = soma(quantidade × área × preço/m²)", () => {
    const m = calcularMix(base.itensMix);
    expect(m.vgv).toBeCloseTo(2000 * 160 * 500, 0);
    expect(m.totalUnidades).toBe(2000);
    expect(m.precoMedioUnidade).toBeCloseTo((160 * 500), 0);
  });

  it("preço médio é 0 quando não há unidades", () => {
    const m = calcularMix([{ nome: "x", quantidade: 0, areaUnidadeM2: 100, precoM2: 500 }]);
    expect(m.precoMedioUnidade).toBe(0);
  });
});

describe("calcularLoteamento", () => {
  const r = calcularLoteamento(base);

  it("VGV bruto = soma do mix de produtos", () => {
    expect(r.vgvGross).toBeCloseTo(2000 * 160 * 500, 0);
  });

  it("capacidade estimada = área vendável ÷ área média ponderada do mix", () => {
    expect(r.urbanistico.capacidadeEstimadaUnidades).toBe(
      Math.floor(r.urbanistico.areaVendavelM2 / 160)
    );
  });

  it("capacidade é 0 quando a área do mix é 0", () => {
    const semArea = calcularLoteamento({
      ...base,
      itensMix: [{ nome: "Lote padrão", quantidade: 2000, areaUnidadeM2: 0, precoM2: 500 }],
    });
    expect(semArea.urbanistico.capacidadeEstimadaUnidades).toBe(0);
  });

  it("VGV líquido é menor que o bruto (após comissão/despesas/impostos)", () => {
    expect(r.vgvNet).toBeLessThan(r.vgvGross);
    expect(r.vgvNet).toBeGreaterThan(0);
  });

  it("custo de obra nominal (com INCC) é maior ou igual ao custo-base de hoje", () => {
    expect(r.custoObraNominalTotal).toBeGreaterThanOrEqual(r.custoInfra);
    expect(r.custoTotalNominal).toBeGreaterThanOrEqual(r.custoTotal);
  });

  it("recebíveis: você + terreneiro = total, e terreneiro = permuta% do total", () => {
    expect(r.recebiveis.voce + r.recebiveis.terreneiro).toBeCloseTo(r.recebiveis.total, 0);
    expect(r.recebiveis.terreneiro).toBeCloseTo(r.recebiveis.total * base.permutaPctVgv, 0);
  });

  it("exposição máxima é positiva e o mês do pico está no horizonte", () => {
    expect(r.exposicaoMaxima).toBeGreaterThanOrEqual(0);
    expect(r.mesPico).toBeGreaterThanOrEqual(0);
    expect(r.mesPico).toBeLessThan(r.fluxo.length);
  });

  it("break-even exige um nº de unidades plausível (>0 e ≤ capacidade)", () => {
    expect(r.breakEven.unidadesNecessarias).toBeGreaterThan(0);
    expect(r.breakEven.unidadesNecessarias).toBeLessThanOrEqual(r.urbanistico.capacidadeEstimadaUnidades);
  });

  it("preço à vista sofre desconto (recebe menos que o cheio)", () => {
    // Sem inadimplência e 100% à vista, o recebido total < VGV por causa do desconto.
    const rVista = calcularLoteamento({
      ...base, vendasAVistaPct: 1, inadimplenciaPct: 0, prazoParcelamentoMeses: 1,
    });
    expect(rVista.recebiveis.total).toBeLessThan(r.vgvGross);
  });
});

describe("pesosCurvaVendas", () => {
  it("os pesos sempre somam ~1", () => {
    for (const perfil of ["lancamento_forte", "organico", "constante", "fechamento_forte"] as const) {
      const w = pesosCurvaVendas(24, perfil);
      expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    }
  });
  it("lançamento forte concentra vendas no início; fechamento forte no fim", () => {
    const lf = pesosCurvaVendas(12, "lancamento_forte");
    const ff = pesosCurvaVendas(12, "fechamento_forte");
    expect(lf[0]).toBeGreaterThan(lf[lf.length - 1]);
    expect(ff[0]).toBeLessThan(ff[ff.length - 1]);
  });
});

describe("calcularCenarios", () => {
  it("agressivo tem VGV maior e vende mais rápido que o conservador", () => {
    const c = calcularCenarios(base);
    expect(c.agressivo.vgvGross).toBeGreaterThan(c.conservador.vgvGross);
    expect(c.ideal.vgvGross).toBeGreaterThan(c.conservador.vgvGross);
    expect(c.agressivo.vgvGross).toBeGreaterThan(c.ideal.vgvGross);
  });
});
