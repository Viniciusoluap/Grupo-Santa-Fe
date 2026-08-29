import { describe, expect, it } from "vitest";
import { simulate, type SimulationInput, type SimulationResult } from "@/lib/mortgage";

const baseInput: SimulationInput = {
  propertyValue: 100_000,
  downPayment: 20_000,
  termMonths: 12,
  annualRate: 0,
  system: "price",
  useFgts: false,
  fgtsAmount: 0,
};

function expectAllNumbersToBeFinite(result: SimulationResult) {
  const summary = [
    result.loanAmount,
    result.firstInstallment,
    result.lastInstallment,
    result.totalPaid,
    result.totalInterest,
    result.totalInsurance,
    result.monthlyRate,
  ];
  const schedule = result.schedule.flatMap((installment) => [
    installment.month,
    installment.payment,
    installment.principal,
    installment.interest,
    installment.balance,
  ]);

  expect([...summary, ...schedule].every(Number.isFinite)).toBe(true);
}

describe("simulate", () => {
  it("simulates Price financing with a zero interest rate", () => {
    const result = simulate(baseInput);
    const principalPaid = result.schedule.reduce((total, item) => total + item.principal, 0);
    const payments = result.schedule.reduce((total, item) => total + item.payment, 0);

    expectAllNumbersToBeFinite(result);
    expect(result.loanAmount).toBe(80_000);
    expect(result.schedule).toHaveLength(12);
    expect(result.totalInterest).toBe(0);
    expect(result.schedule.every((item) => item.interest === 0)).toBe(true);
    expect(principalPaid).toBeCloseTo(80_000, 8);
    expect(result.schedule.at(-1)?.balance).toBeCloseTo(0, 8);
    expect(result.totalInsurance).toBeCloseTo(93.6, 8);
    expect(result.totalPaid).toBeCloseTo(80_000 + result.totalInsurance, 8);
    expect(result.totalPaid).toBeCloseTo(payments, 8);
  });

  it("preserves the Price invariants for a positive interest rate", () => {
    const result = simulate({ ...baseInput, annualRate: 12 });
    const basePayments = result.schedule.map((item) => item.principal + item.interest);

    expectAllNumbersToBeFinite(result);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.schedule.at(-1)?.balance).toBeCloseTo(0, 8);
    expect(basePayments.every((payment) => Math.abs(payment - basePayments[0]) < 1e-8)).toBe(true);
    expect(result.firstInstallment).toBeGreaterThan(result.lastInstallment);
  });

  it("creates decreasing SAC installments with constant amortization", () => {
    const result = simulate({ ...baseInput, annualRate: 12, system: "sac" });

    expectAllNumbersToBeFinite(result);
    expect(result.schedule.every((item) => item.principal === result.schedule[0].principal)).toBe(true);
    expect(result.schedule.every((item, index, items) => index === 0 || item.payment < items[index - 1].payment)).toBe(true);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.schedule.at(-1)?.balance).toBeCloseTo(0, 8);
  });

  it("uses FGTS only when requested", () => {
    const withoutFgts = simulate({ ...baseInput, fgtsAmount: 10_000 });
    const withFgts = simulate({ ...baseInput, useFgts: true, fgtsAmount: 10_000 });

    expect(withoutFgts.loanAmount).toBe(80_000);
    expect(withFgts.loanAmount).toBe(70_000);
  });

  it.each([
    { downPayment: 100_000 },
    { downPayment: 120_000 },
  ])("returns an empty result when there is no amount to finance", (override) => {
    const result = simulate({ ...baseInput, ...override });

    expectAllNumbersToBeFinite(result);
    expect(result.loanAmount).toBe(0);
    expect(result.schedule).toEqual([]);
    expect(result.totalPaid).toBe(0);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects an invalid term of %s months",
    (termMonths) => {
      expect(() => simulate({ ...baseInput, termMonths })).toThrow(RangeError);
    },
  );

  it.each([
    ["propertyValue", Number.NaN],
    ["propertyValue", Number.POSITIVE_INFINITY],
    ["downPayment", Number.NEGATIVE_INFINITY],
    ["annualRate", Number.NaN],
  ] as const)("rejects a non-finite %s", (field, value) => {
    expect(() => simulate({ ...baseInput, [field]: value })).toThrow(TypeError);
  });

  it("rejects a negative annual rate", () => {
    expect(() => simulate({ ...baseInput, annualRate: -1 })).toThrow(RangeError);
  });

  it("rejects a non-finite FGTS amount only when FGTS is used", () => {
    expect(() => simulate({ ...baseInput, useFgts: true, fgtsAmount: Number.NaN })).toThrow(TypeError);
    expect(() => simulate({ ...baseInput, useFgts: false, fgtsAmount: Number.NaN })).not.toThrow();
  });
});
