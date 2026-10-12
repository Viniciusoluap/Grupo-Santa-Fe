// Testes de referência do motor financeiro (EPIC-020, Lote 2). Mesmo conteúdo
// em Grupo-Santa-Fe/web/src/lib/__tests__/financeiro-obra.test.ts — os dois
// sistemas precisam produzir exatamente os mesmos resultados.
import { describe, expect, it } from "vitest";
import {
  aplicarPercentual,
  calcularObra,
  centavosDe,
  diasEntre,
  parcelaPrice,
  percentualMicro,
  reaisDeCentavos,
  type EntradasObra,
  type Indicador,
  type MovimentoCalculo,
} from "@/lib/financeiro/obra";

const R = (reais: string) => centavosDe(reais)!;
const valor = (i: Indicador) => (i.ok ? i.centavos : `indisponível: ${i.motivo}`);

function obra(parcial: Partial<EntradasObra> = {}): EntradasObra {
  return {
    vgv: R("170000"),
    financiamento: R("140000"),
    fgts: R("0"),
    subsidio: R("8234"),
    custoTerreno: R("10000"),
    comissao: R("5000"),
    orcamentoPrevisto: R("110000"),
    taxaMensalPct: null,
    parcelas: null,
    dataInicio: null,
    dataTerminoPrevista: null,
    investidores: [],
    percentualEmpreiteiro: null,
    movimentos: [],
    ...parcial,
  };
}

const mov = (natureza: MovimentoCalculo["natureza"], reais: string, status: MovimentoCalculo["status"] = "confirmado"): MovimentoCalculo =>
  ({ natureza, valorCentavos: R(reais), status });

describe("Teste A — Entrada", () => {
  it("Entrada Total R$ 21.766,00 e Saldo R$ 15.766,00", () => {
    const r = calcularObra(obra({ movimentos: [mov("entrada", "2000"), mov("entrada", "4000")] }));
    expect(valor(r.entradaTotal)).toBe(R("21766"));
    expect(valor(r.entradaPaga)).toBe(R("6000"));
    expect(valor(r.saldoEntrada)).toBe(R("15766"));
    expect(valor(r.proSoluto)).toBe(R("15766"));
  });

  it("preserva saldo negativo e sinaliza pagamento a maior", () => {
    const r = calcularObra(obra({ movimentos: [mov("entrada", "25000")] }));
    expect(valor(r.saldoEntrada)).toBe(R("-3234"));
    expect(r.alertas.join(" ")).toMatch(/pagamento a maior/);
    expect(r.valorParcela.ok).toBe(false);
  });

  it("dado ausente não vira zero", () => {
    const r = calcularObra(obra({ fgts: null }));
    expect(r.entradaTotal).toEqual({ ok: false, motivo: "Informe: FGTS" });
    expect(r.saldoEntrada.ok).toBe(false);
  });
});

describe("Teste B — Recebimentos CEF", () => {
  const r = calcularObra(obra({ movimentos: [mov("recebimento_cef", "102817.42")] }));
  it("base R$ 138.234,00, a receber R$ 35.416,58 e PLS 74,38%", () => {
    expect(valor(r.basePls)).toBe(R("138234"));
    expect(valor(r.receberBanco)).toBe(R("35416.58"));
    expect(r.plsReal.ok && r.plsReal.percentual).toBeCloseTo(74.379255, 6);
    expect(r.plsReal.ok && r.plsReal.percentual.toFixed(2)).toBe("74.38");
  });

  it("PLS inválido quando a base é zero ou negativa", () => {
    const zero = calcularObra(obra({ financiamento: R("1766"), subsidio: R("8234"), custoTerreno: R("10000") }));
    expect(zero.plsReal.ok).toBe(false);
  });

  it("recebimento CEF não se mistura com entrada", () => {
    const misto = calcularObra(obra({ movimentos: [mov("recebimento_cef", "1000"), mov("entrada", "500")] }));
    expect(valor(misto.recebidoCef)).toBe(R("1000"));
    expect(valor(misto.entradaPaga)).toBe(R("500"));
  });
});

describe("Teste C — Distribuição dos lucros", () => {
  const r = calcularObra(obra({ investidores: [{ id: 1, percentual: 30 }], percentualEmpreiteiro: 20 }));
  it("Estimado 45.000; Investidor 13.500; Base 31.500; Empreiteiro 6.300; Empresa 25.200", () => {
    expect(valor(r.lucroEstimado)).toBe(R("45000"));
    expect(valor(r.lucroInvestidores)).toBe(R("13500"));
    expect(valor(r.baseEmpreiteiro)).toBe(R("31500"));
    expect(valor(r.lucroEmpreiteiro)).toBe(R("6300"));
    expect(valor(r.lucroEmpresa)).toBe(R("25200"));
  });

  it("Lucro Estimado usa Orçamento Previsto, nunca o Total Gasto", () => {
    const comGastos = calcularObra(obra({ movimentos: [mov("pagamento", "90000")] }));
    expect(valor(comGastos.lucroEstimado)).toBe(R("45000"));
    expect(valor(comGastos.totalGasto)).toBe(R("90000"));
  });

  it("investidores múltiplos ficam individualizados; soma acima de 100% é recusada", () => {
    const dois = calcularObra(obra({ investidores: [{ id: "a", percentual: 30 }, { id: "b", percentual: 10 }] }));
    expect(dois.investidores.map((i) => valor(i.lucro))).toEqual([R("13500"), R("4500")]);
    expect(valor(dois.lucroInvestidores)).toBe(R("18000"));
    const demais = calcularObra(obra({ investidores: [{ id: "a", percentual: 70 }, { id: "b", percentual: 40 }] }));
    expect(demais.lucroInvestidores.ok).toBe(false);
    expect(demais.lucroEmpresa.ok).toBe(false);
  });

  it("investidor com 0% e 100%", () => {
    expect(valor(calcularObra(obra({ investidores: [{ id: 1, percentual: 0 }] })).lucroInvestidores)).toBe(0);
    const cem = calcularObra(obra({ investidores: [{ id: 1, percentual: 100 }], percentualEmpreiteiro: 20 }));
    expect(valor(cem.lucroInvestidores)).toBe(R("45000"));
    expect(valor(cem.lucroEmpreiteiro)).toBe(0);
    expect(valor(cem.lucroEmpresa)).toBe(0);
  });

  it("percentual decimal com 4 casas não perde precisão", () => {
    expect(aplicarPercentual(R("45000"), percentualMicro("12.3456")!)).toBe(R("5555.52"));
  });

  it("lucro negativo é mostrado, não zerado", () => {
    const r2 = calcularObra(obra({ orcamentoPrevisto: R("200000") }));
    expect(valor(r2.lucroEstimado)).toBe(R("-45000"));
    expect(r2.alertas.join(" ")).toMatch(/negativo/);
  });
});

describe("Teste D — HP 12C (Price, modo END)", () => {
  it("PV 12.000,00, 1,50% a.m., 20 parcelas → R$ 698,95", () => {
    expect(valor(parcelaPrice(R("12000"), 1.5, 20))).toBe(R("698.95"));
    expect(valor(parcelaPrice(R("12000"), "1.5", 20))).toBe(69895);
  });
  it("casos especiais", () => {
    expect(valor(parcelaPrice(R("12000"), 0, 20))).toBe(R("600"));
    expect(parcelaPrice(R("12000"), 1.5, 0).ok).toBe(false);
    expect(parcelaPrice(R("12000"), 1.5, -3).ok).toBe(false);
    expect(parcelaPrice(R("12000"), -1, 12).ok).toBe(false);
    expect(parcelaPrice(R("12000"), null, 12)).toMatchObject({ ok: false, motivo: expect.stringContaining("indisponível") });
    expect(parcelaPrice(0, 1.5, 12).ok).toBe(false);
    expect(parcelaPrice(R("-100"), 1.5, 12).ok).toBe(false);
  });
  it("parcela acompanha o saldo da entrada", () => {
    const r = calcularObra(obra({ vgv: R("160234"), taxaMensalPct: 1.5, parcelas: 20 }));
    expect(valor(r.proSoluto)).toBe(R("12000"));
    expect(valor(r.valorParcela)).toBe(R("698.95"));
  });
});

describe("Teste F — Pagamentos", () => {
  it("1.000 + 2.000 + 3.000 = 6.000; cancelar o 3º → 3.000", () => {
    const pagamentos = [mov("pagamento", "1000"), mov("pagamento", "2000"), mov("pagamento", "3000")];
    expect(valor(calcularObra(obra({ movimentos: pagamentos })).totalGasto)).toBe(R("6000"));
    pagamentos[2] = { ...pagamentos[2], status: "cancelado" };
    const r = calcularObra(obra({ movimentos: pagamentos }));
    expect(valor(r.totalGasto)).toBe(R("3000"));
    expect(valor(r.gastoObraRealizado)).toBe(R("3000"));
    expect(valor(r.saldoRestante)).toBe(R("167000"));
  });
});

describe("Dias de obra e conversões", () => {
  it("01/10/2026 → 31/12/2026 = 91 dias, sem efeito de fuso", () => {
    expect(diasEntre("2026-10-01", "2026-12-31")).toEqual({ ok: true, dias: 91 });
    expect(diasEntre("2026-10-01T00:00:00.000Z", "2026-12-31T23:00:00.000Z")).toEqual({ ok: true, dias: 91 });
    expect(diasEntre("2026-12-31", "2026-10-01").ok).toBe(false);
    expect(diasEntre(null, "2026-10-01").ok).toBe(false);
  });
  it("centavos exatos, valores grandes e HALF_UP", () => {
    expect(centavosDe("102817.42")).toBe(10281742);
    expect(centavosDe(0.1 + 0.2)).toBe(30);
    expect(centavosDe("1000000000.005")).toBe(100000000001);
    expect(centavosDe("-0.005")).toBe(-1);
    expect(centavosDe("abc")).toBeNull();
    expect(reaisDeCentavos(10281742)).toBe("102817.42");
    expect(reaisDeCentavos(-5)).toBe("-0.05");
  });
  it("custo de construção e saldo restante seguem as fontes certas", () => {
    const r = calcularObra(obra({ movimentos: [mov("pagamento", "57795")] }));
    expect(valor(r.custoConstrucao)).toBe(R("110000"));
    expect(valor(r.saldoRestante)).toBe(R("112205"));
  });
});
