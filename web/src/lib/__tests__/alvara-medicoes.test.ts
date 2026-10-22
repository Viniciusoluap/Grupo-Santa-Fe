import { describe, expect, it } from "vitest";
import { dadosMedicaoPadrao, dadosPlsPadrao, datasAlvaraDeMedicoes } from "@/lib/medicao-caixa";

const pls = (alvaraEmissao: string | null, alvaraVigencia: string | null) => ({
  tipo: "pls",
  dadosCaixa: { pls: { alvaraEmissao, alvaraVigencia } },
});

describe("alvará pré-preenchido na próxima medição PLS", () => {
  it("usa os valores preenchidos mais recentes, independentemente por campo", () => {
    const datas = datasAlvaraDeMedicoes([
      pls(null, "2027-10-20"),
      { tipo: "repactuacao", dadosCaixa: { pls: { alvaraEmissao: "2030-01-01" } } },
      pls("2026-06-29", "2027-06-29"),
    ], { alvaraEmissao: "2025-01-01", alvaraVigencia: "2025-12-31" });
    expect(datas).toEqual({ alvaraEmissao: "2026-06-29", alvaraVigencia: "2027-10-20" });
    expect(dadosMedicaoPadrao("pls", dadosPlsPadrao(datas)).pls).toMatchObject(datas);
  });

  it("usa a PCI só para os campos ainda não informados numa PLS", () => {
    expect(datasAlvaraDeMedicoes([
      pls("2026-06-29", null),
      pls(null, null),
    ], { alvaraEmissao: "2020-01-01", alvaraVigencia: "2028-01-01" })).toEqual({
      alvaraEmissao: "2026-06-29", alvaraVigencia: "2028-01-01",
    });
    expect(datasAlvaraDeMedicoes([], {})).toEqual({ alvaraEmissao: null, alvaraVigencia: null });
  });

  it("ignora registros legados e datas inválidas antes de procurar uma PLS anterior", () => {
    expect(datasAlvaraDeMedicoes([
      { tipo: "pls", dadosCaixa: null },
      pls("31/06/2026", ""),
      pls("2026-06-29", "2027-06-29"),
    ])).toEqual({ alvaraEmissao: "2026-06-29", alvaraVigencia: "2027-06-29" });
  });
});
