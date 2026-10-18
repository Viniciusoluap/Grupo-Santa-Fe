import { describe, expect, it } from "vitest";
import { baseDaMedicao, estimarMedicoes, obraPassaFiltroMedicao, situacaoDaMedicao } from "@/lib/financeiro/medicoes";

describe("pedido de 18/10 — valor estimado da medição", () => {
  const base = baseDaMedicao({ financiamento: 20_000_000, fgts: 3_000_000, subsidio: 2_000_000, custoTerreno: 5_000_000 });
  it("Y = (financiado + FGTS + subsídio) − terreno", () => {
    expect(base).toEqual({ ok: true, centavos: 20_000_000 });
  });
  it("valor vazio deixa a base incompleta (zero vale)", () => {
    expect(baseDaMedicao({ financiamento: 1, fgts: null, subsidio: 0, custoTerreno: 0 })).toEqual({ ok: false, motivo: "Dados incompletos: FGTS" });
    expect(baseDaMedicao({ financiamento: 1, fgts: 0, subsidio: 0, custoTerreno: 0 })).toEqual({ ok: true, centavos: 1 });
  });
  it("X = Y × (percentual da medição − anterior), em ordem cronológica", () => {
    const r = estimarMedicoes([
      { id: 2, progresso: 25.79, criadoEm: "2026-10-13T04:05:33Z" },
      { id: 1, progresso: 7.992, criadoEm: "2026-10-13T04:05:24Z" },
    ], base);
    expect(r.get(1)).toEqual({ percentualDaMedicao: 7.992, valorCentavos: 1_598_400, aviso: null });
    expect(r.get(2)?.valorCentavos).toBe(3_559_600); // 17,798% de R$ 200.000
  });
  it("medição menor que a anterior não tem valor a receber", () => {
    const r = estimarMedicoes([
      { id: 1, progresso: 25.79, criadoEm: "2026-10-13T04:05:24Z" },
      { id: 2, progresso: 7.992, criadoEm: "2026-10-13T04:05:33Z" },
    ], base);
    expect(r.get(2)).toMatchObject({ valorCentavos: 0, aviso: expect.stringContaining("menor") });
  });
  it("sem base completa o valor fica indisponível", () => {
    const r = estimarMedicoes([{ id: 1, progresso: 10, criadoEm: "2026-10-13" }], { ok: false, motivo: "x" });
    expect(r.get(1)?.valorCentavos).toBeNull();
  });
  it("situação e filtro", () => {
    expect(situacaoDaMedicao({})).toBe("registrada");
    expect(situacaoDaMedicao({ solicitadaEm: new Date() })).toBe("solicitada");
    expect(situacaoDaMedicao({ solicitadaEm: new Date(), recebidaEm: new Date() })).toBe("recebida");
    expect(obraPassaFiltroMedicao({ medicoesSolicitadas: 1, medicoesRecebidas: 0 }, "solicitada")).toBe(true);
    expect(obraPassaFiltroMedicao({ medicoesSolicitadas: 1, medicoesRecebidas: 0 }, "recebida")).toBe(false);
    expect(obraPassaFiltroMedicao({ medicoesSolicitadas: 0, medicoesRecebidas: 0 }, "")).toBe(true);
  });
});
