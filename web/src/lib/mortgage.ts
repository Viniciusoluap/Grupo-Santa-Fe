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
    const payment =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
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

export const MCMV_PROGRAMS = [
  {
    label: "Faixa 1 — Até R$ 2.640/mês",
    maxIncome: 2640,
    rate: 4.75,
    maxValue: 170000,
    description: "Taxa subsidiada para famílias de baixa renda",
  },
  {
    label: "Faixa 2 — Até R$ 4.400/mês",
    maxIncome: 4400,
    rate: 5.25,
    maxValue: 264000,
    description: "Financiamento facilitado com subsídio parcial",
  },
  {
    label: "Faixa 3 — Até R$ 8.000/mês",
    maxIncome: 8000,
    rate: 6.5,
    maxValue: 350000,
    description: "Financiamento pelo MCMV com taxas reduzidas",
  },
  {
    label: "Faixa 4 — Até R$ 12.000/mês",
    maxIncome: 12000,
    rate: 8.16,
    maxValue: 500000,
    description: "Faixa estendida com taxas reduzidas via FGTS",
  },
  {
    label: "SBPE — Acima do MCMV",
    maxIncome: Infinity,
    rate: 10.5,
    maxValue: Infinity,
    description: "Financiamento habitacional via sistema bancário convencional",
  },
];
