export type AmortizationSystem = "price" | "sac";

export interface SimulationInput {
  propertyValue: number;
  downPayment: number;
  termMonths: number;
  annualRate: number;
  system: AmortizationSystem;
  useFgts: boolean;
  fgtsAmount: number;
}

export interface Installment {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface SimulationResult {
  loanAmount: number;
  firstInstallment: number;
  lastInstallment: number;
  totalPaid: number;
  totalInterest: number;
  totalInsurance: number;
  monthlyRate: number;
  schedule: Installment[];
}

const MONTHLY_INSURANCE_RATE = 0.000180;

export function simulate(input: SimulationInput): SimulationResult {
  const numericInputs = [
    ["propertyValue", input.propertyValue],
    ["downPayment", input.downPayment],
    ["annualRate", input.annualRate],
  ] as const;

  for (const [name, value] of numericInputs) {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${name} deve ser um número finito`);
    }
  }

  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) {
    throw new RangeError("termMonths deve ser um inteiro positivo");
  }
  if (input.annualRate < 0) {
    throw new RangeError("annualRate não pode ser negativa");
  }
  if (input.useFgts && !Number.isFinite(input.fgtsAmount)) {
    throw new TypeError("fgtsAmount deve ser um número finito quando o FGTS estiver em uso");
  }

  const effectiveDown = input.downPayment + (input.useFgts ? input.fgtsAmount : 0);
  const loanAmount = input.propertyValue - effectiveDown;
  const monthlyRate = input.annualRate / 100 / 12;
  const n = input.termMonths;

  if (loanAmount <= 0) {
    return {
      loanAmount: 0,
      firstInstallment: 0,
      lastInstallment: 0,
      totalPaid: 0,
      totalInterest: 0,
      totalInsurance: 0,
      monthlyRate,
      schedule: [],
    };
  }

  const schedule: Installment[] = [];

  if (input.system === "price") {
    const payment = monthlyRate === 0
      ? loanAmount / n
      : (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
        (Math.pow(1 + monthlyRate, n) - 1);

    let balance = loanAmount;
    let totalInterest = 0;
    let totalInsurance = 0;

    for (let month = 1; month <= n; month++) {
      const interest = balance * monthlyRate;
      const principal = payment - interest;
      const insurance = balance * MONTHLY_INSURANCE_RATE;
      balance = Math.max(0, balance - principal);
      totalInterest += interest;
      totalInsurance += insurance;

      schedule.push({
        month,
        payment: payment + insurance,
        principal,
        interest,
        balance,
      });
    }

    return {
      loanAmount,
      firstInstallment: schedule[0]?.payment ?? 0,
      lastInstallment: schedule[n - 1]?.payment ?? 0,
      totalPaid: schedule.reduce((s, i) => s + i.payment, 0),
      totalInterest,
      totalInsurance,
      monthlyRate,
      schedule,
    };
  } else {
    const amortization = loanAmount / n;
    let balance = loanAmount;
    let totalInterest = 0;
    let totalInsurance = 0;

    for (let month = 1; month <= n; month++) {
      const interest = balance * monthlyRate;
      const insurance = balance * MONTHLY_INSURANCE_RATE;
      const payment = amortization + interest + insurance;
      balance = Math.max(0, balance - amortization);
      totalInterest += interest;
      totalInsurance += insurance;

      schedule.push({
        month,
        payment,
        principal: amortization,
        interest,
        balance,
      });
    }

    return {
      loanAmount,
      firstInstallment: schedule[0]?.payment ?? 0,
      lastInstallment: schedule[n - 1]?.payment ?? 0,
      totalPaid: schedule.reduce((s, i) => s + i.payment, 0),
      totalInterest,
      totalInsurance,
      monthlyRate,
      schedule,
    };
  }
}

export interface BankRate {
  bank: string;
  rate: number;
  rateLabel: string;
  index: string;
  notes: string;
}

/**
 * Taxas de referência pesquisadas em fontes públicas do mercado (jun/2026).
 * Servem como comparativo informativo — cada instituição define a taxa final
 * conforme relacionamento, renda e análise de crédito do cliente.
 */
export const BANK_RATES_REFERENCE_DATE = "Junho/2026";

export const BANK_RATES: BankRate[] = [
  {
    bank: "Caixa Econômica Federal",
    rate: 11.19,
    rateLabel: "a partir de 11,19% a.a. + TR",
    index: "TR",
    notes: "Menor taxa de balcão do mercado no SFH",
  },
  {
    bank: "Itaú",
    rate: 11.6,
    rateLabel: "a partir de 11,60% a.a. + TR",
    index: "TR",
    notes: "Condições melhores para correntistas",
  },
  {
    bank: "Santander",
    rate: 11.69,
    rateLabel: "a partir de 11,69% a.a. + TR",
    index: "TR",
    notes: "Reduziu taxas no fim de 2025/início de 2026",
  },
  {
    bank: "Bradesco",
    rate: 11.7,
    rateLabel: "a partir de 11,70% a.a. + TR",
    index: "TR",
    notes: "Taxa varia conforme relacionamento bancário",
  },
  {
    bank: "Banco Inter",
    rate: 9.5,
    rateLabel: "a partir de 9,50% a.a. + IPCA",
    index: "IPCA",
    notes: "100% digital — atenção: taxa indexada à inflação (IPCA)",
  },
];

// Limites vigentes desde 22/abril/2026 (Portaria MCID nº 333 de 01/04/2026 + aprovação CCFGTS de 24/03/2026)
export const MCMV_PROGRAMS = [
  {
    label: "Faixa 1 — Até R$ 3.200/mês",
    maxIncome: 3200,
    rate: 4.75,
    maxValue: 275000,
    description: "Taxa subsidiada para famílias de baixa renda — cotistas FGTS e Norte/Nordeste têm taxas menores (a partir de 4% a.a.)",
  },
  {
    label: "Faixa 2 — Até R$ 5.000/mês",
    maxIncome: 5000,
    rate: 5.25,
    maxValue: 275000,
    description: "Financiamento com subsídio parcial — taxa varia conforme FGTS e região",
  },
  {
    label: "Faixa 3 — Até R$ 9.600/mês",
    maxIncome: 9600,
    rate: 6.5,
    maxValue: 400000,
    description: "Teto do imóvel ampliado para R$ 400 mil — taxas reduzidas pelo MCMV com prazo de até 420 meses",
  },
  {
    label: "Faixa 4 (Classe Média) — Até R$ 13.000/mês",
    maxIncome: 13000,
    rate: 8.16,
    maxValue: 600000,
    description: "Faixa estendida até R$ 600 mil — taxas até 8,16% a.a. variando conforme FGTS e relacionamento bancário",
  },
  {
    label: "SBPE — Acima do MCMV",
    maxIncome: Infinity,
    rate: 10.5,
    maxValue: Infinity,
    description: "Financiamento convencional via sistema bancário — taxa de referência de mercado",
  },
];
