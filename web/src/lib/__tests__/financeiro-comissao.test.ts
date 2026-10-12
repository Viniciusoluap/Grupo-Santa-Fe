// Teste G e limites da comissão de obra (EPIC-020, Lote 3, item 32). Mesmo
// conteúdo em Prospecta/server/financeiro-comissao.test.ts.
import { describe, expect, it } from "vitest";
import { calcularComissaoObra, valorComissao } from "@/lib/financeiro/comissao";

const corretor = (percentualPadrao: string | null = null) => ({ id: 1, nome: "Corretor", percentualPadrao });

describe("Teste G — comissão", () => {
  it("VGV 230.000 × 5% = R$ 11.500,00", () => {
    expect(valorComissao(23_000_000, "5")).toBe(1_150_000);
    const r = calcularComissaoObra({ corretor: corretor(), vgvCentavos: 23_000_000, percentualObra: "5", pagoCentavos: 0 });
    expect(r).toMatchObject({ elegivel: true, valorCentavos: 1_150_000, fontePercentual: "obra", status: "pendente", saldoCentavos: 1_150_000 });
  });

  it("percentual decimal com arredondamento HALF_UP", () => {
    // 170.000,00 × 2,345% = 3.986,50
    expect(valorComissao(17_000_000, "2.345")).toBe(398_650);
    // 0,01 × 50% = 0,005 → 0,01 (meio para cima)
    expect(valorComissao(1, "50")).toBe(1);
  });
});

describe("regra cadastrada — nunca inventar percentual", () => {
  it("sem percentual na obra usa o padrão do corretor", () => {
    const r = calcularComissaoObra({ corretor: corretor("4"), vgvCentavos: 20_000_000, percentualObra: null, pagoCentavos: 0 });
    expect(r).toMatchObject({ percentual: "4", fontePercentual: "corretor", valorCentavos: 800_000 });
  });

  it("percentual da obra prevalece sobre o do corretor", () => {
    const r = calcularComissaoObra({ corretor: corretor("4"), vgvCentavos: 20_000_000, percentualObra: "3", pagoCentavos: 0 });
    expect(r).toMatchObject({ fontePercentual: "obra", valorCentavos: 600_000 });
  });

  it("sem regra nenhuma: dados incompletos, sem valor", () => {
    const r = calcularComissaoObra({ corretor: corretor(), vgvCentavos: 20_000_000, percentualObra: null, pagoCentavos: 0 });
    expect(r.status).toBe("dados_incompletos");
    expect(r.valorCentavos).toBeNull();
    expect(r.pendencias).toContain("Percentual de comissão não cadastrado (na obra ou no corretor)");
  });

  it("sem VGV: dados incompletos (ausente não é zero)", () => {
    const r = calcularComissaoObra({ corretor: corretor("5"), vgvCentavos: null, percentualObra: null, pagoCentavos: 0 });
    expect(r).toMatchObject({ status: "dados_incompletos", valorCentavos: null });
    expect(r.pendencias).toEqual(["VGV não informado em Valores da Operação"]);
  });

  it("percentual inválido (acima de 100% ou negativo) é ignorado", () => {
    expect(calcularComissaoObra({ corretor: corretor("150"), vgvCentavos: 100, percentualObra: "-1", pagoCentavos: 0 }).status).toBe("dados_incompletos");
  });

  it("0% é regra válida e gera comissão zero (paga)", () => {
    expect(calcularComissaoObra({ corretor: corretor(), vgvCentavos: 100_000, percentualObra: "0", pagoCentavos: 0 })).toMatchObject({ valorCentavos: 0, status: "paga" });
  });

  it("obra sem corretor não é elegível", () => {
    expect(calcularComissaoObra({ corretor: null, vgvCentavos: 100, percentualObra: "5", pagoCentavos: 0 }).elegivel).toBe(false);
  });
});

describe("pagamentos vindos do financeiro", () => {
  const base = { corretor: corretor(), vgvCentavos: 23_000_000, percentualObra: "5" };
  it("parcial", () => {
    expect(calcularComissaoObra({ ...base, pagoCentavos: 500_000 })).toMatchObject({ status: "parcial", saldoCentavos: 650_000 });
  });
  it("paga", () => {
    expect(calcularComissaoObra({ ...base, pagoCentavos: 1_150_000 })).toMatchObject({ status: "paga", saldoCentavos: 0 });
  });
  it("pago acima do calculado gera alerta, sem esconder o negativo", () => {
    const r = calcularComissaoObra({ ...base, pagoCentavos: 1_200_000 });
    expect(r.saldoCentavos).toBe(-50_000);
    expect(r.alertas.length).toBe(1);
  });
  it("pagamento com dados incompletos gera alerta", () => {
    expect(calcularComissaoObra({ ...base, vgvCentavos: null, pagoCentavos: 100 }).alertas.length).toBe(1);
  });
});
