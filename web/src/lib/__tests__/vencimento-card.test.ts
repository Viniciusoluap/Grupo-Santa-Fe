import { describe, expect, it } from "vitest";
import { chaveDoCard, dataDoCard, diaEmImperatriz } from "../crm/vencimento-card";

describe("vencimento individual do card", () => {
  it("preserva a data civil, valida o calendário e põe cartões sem data por último", () => {
    expect(chaveDoCard(dataDoCard("2026-10-22"))).toBe("2026-10-22");
    expect(chaveDoCard(null)).toBe("9999-12-31");
    expect(() => dataDoCard("2026-02-30")).toThrow();
  });

  it("respeita a virada do dia em Imperatriz", () => {
    expect(diaEmImperatriz(new Date("2026-10-22T02:59:59Z"))).toBe("2026-10-21");
    expect(diaEmImperatriz(new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-22");
  });
});
