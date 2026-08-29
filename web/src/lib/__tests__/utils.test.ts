import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatArea,
  formatTelefone,
  maskPhone,
  maskCurrency,
  currencyToFloat,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats zero", () => {
    expect(formatCurrency(0)).toMatch(/R\$\s*0,00/);
  });
  it("formats integer value", () => {
    expect(formatCurrency(1000)).toMatch(/R\$\s*1\.000,00/);
  });
  it("formats decimal value", () => {
    expect(formatCurrency(1234.56)).toMatch(/R\$\s*1\.234,56/);
  });
  it("formats large value", () => {
    expect(formatCurrency(1000000)).toMatch(/R\$\s*1\.000\.000,00/);
  });
  it("formats negative value", () => {
    expect(formatCurrency(-500)).toMatch(/-?\s*R\$\s*500,00|R\$\s*-500,00/);
  });
});

describe("formatArea", () => {
  it.each([
    [0, "0 m²"],
    [120, "120 m²"],
    [1500, "1.500 m²"],
    [120.5, "120,5 m²"],
    [-10, "-10 m²"],
  ])("formats %s using the pt-BR area convention", (value, expected) => {
    expect(formatArea(value)).toBe(expected);
  });
});

describe("formatTelefone", () => {
  it("formats 11-digit mobile number", () => {
    expect(formatTelefone("94999991234")).toBe("(94) 9 9999-1234");
  });
  it("formats 10-digit landline number", () => {
    expect(formatTelefone("9433001234")).toBe("(94) 3300-1234");
  });
  it("returns original string for unrecognized format", () => {
    expect(formatTelefone("12345")).toBe("12345");
  });
  it("strips non-numeric characters first", () => {
    expect(formatTelefone("(94) 9 9999-1234")).toBe("(94) 9 9999-1234");
  });
});

describe("maskPhone", () => {
  it("returns empty for empty string", () => {
    expect(maskPhone("")).toBe("");
  });
  it("wraps first two digits in parentheses", () => {
    expect(maskPhone("94")).toBe("(94");
  });
  it("produces partial mask for 5 digits", () => {
    const result = maskPhone("94933");
    expect(result).toContain("(94)");
  });
  it("produces full 11-digit mask", () => {
    expect(maskPhone("94999991234")).toBe("(94) 9 9999-1234");
  });
});

describe("maskCurrency", () => {
  it("returns empty for empty string", () => {
    expect(maskCurrency("")).toBe("");
  });
  it("formats single digit as centavos", () => {
    expect(maskCurrency("1")).toBe("0,01");
  });
  it("formats 100 as 1 real", () => {
    expect(maskCurrency("100")).toBe("1,00");
  });
  it("formats 100000 with thousands separator", () => {
    expect(maskCurrency("100000")).toBe("1.000,00");
  });
});

describe("currencyToFloat", () => {
  it("converts masked currency to float string", () => {
    expect(currencyToFloat("1.234,56")).toBe("1234.56");
  });
  it("converts integer masked value", () => {
    expect(currencyToFloat("1.000,00")).toBe("1000.00");
  });
  it("handles value without thousands separator", () => {
    expect(currencyToFloat("500,00")).toBe("500.00");
  });
});
