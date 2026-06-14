"use client";

import { useState, useMemo } from "react";
import {
  Calculator,
  Info,
  TrendingDown,
  TrendingUp,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
  FileDown,
  Landmark,
} from "lucide-react";
import {
  simulate,
  MCMV_PROGRAMS,
  BANK_RATES,
  BANK_RATES_REFERENCE_DATE,
  type SimulationInput,
} from "@/lib/mortgage";
import { formatCurrency } from "@/lib/utils";
import { generateSimulationPdf, generateSimulationPdfWithSchedule } from "@/lib/simulation-pdf";

const TERM_OPTIONS = [60, 120, 180, 240, 300, 360, 420];

function InputField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
        {label}
        {hint && (
          <span title={hint} className="cursor-help">
            <Info size={11} className="text-gray-400" />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const cents = digits ? parseInt(digits, 10) : 0;
    onChange(cents / 100);
  }

  const displayValue =
    value > 0
      ? new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value)
      : "";

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder ?? "0,00"}
        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
      />
    </div>
  );
}

function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (pct: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  function handleFocus() {
    setEditing(true);
    setRaw(value > 0 ? value.toFixed(1).replace(".", ",") : "");
  }

  function handleBlur() {
    setEditing(false);
    const num = parseFloat(raw.replace(",", "."));
    if (!isNaN(num)) onChange(Math.min(100, Math.max(0, num)));
    else if (raw === "") onChange(0);
  }

  const displayValue = editing
    ? raw
    : value > 0
    ? value.toFixed(1).replace(".", ",")
    : "";

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="0,0"
        className="w-full pr-7 pl-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 text-right"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
        %
      </span>
    </div>
  );
}

export function MortgageSimulator() {
  const [form, setForm] = useState<SimulationInput>({
    propertyValue: 300000,
    downPayment: 60000,
    termMonths: 240,
    annualRate: 10.5,
    system: "price",
    useFgts: false,
    fgtsAmount: 0,
  });
  const [mcmvIndex, setMcmvIndex] = useState<number | null>(null);
  const [showFullTable, setShowFullTable] = useState(false);

  const result = useMemo(() => simulate(form), [form]);

  const bankComparison = useMemo(
    () =>
      BANK_RATES.map((b) => ({
        ...b,
        installment: simulate({ ...form, annualRate: b.rate }).firstInstallment,
      })),
    [form]
  );

  const maxFinancedPercent = 80;
  const minDownPayment = form.propertyValue * (1 - maxFinancedPercent / 100);

  function applyMcmv(idx: number) {
    setMcmvIndex(idx);
    setForm((f) => ({ ...f, annualRate: MCMV_PROGRAMS[idx].rate }));
  }

  const displaySchedule = showFullTable
    ? result.schedule
    : result.schedule.slice(0, 12);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Form */}
      <div className="xl:col-span-2 space-y-5">
        {/* MCMV quick select */}
        <div className="bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)]/30 p-4">
          <p className="text-xs font-bold text-[var(--brand-dark)] uppercase tracking-wide mb-3">
            Programas Habitacionais (MCMV)
          </p>
          <div className="space-y-2">
            {MCMV_PROGRAMS.map((p, i) => (
              <button
                key={i}
                onClick={() => applyMcmv(i)}
                className={`w-full text-left px-3 py-2 text-xs border transition-all ${
                  mcmvIndex === i
                    ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-bold"
                    : "border-gray-200 bg-white hover:border-[var(--brand-yellow)] text-gray-600"
                }`}
              >
                <span className="font-bold block">{p.label}</span>
                <span className="opacity-70">{p.rate}% a.a. — {p.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 space-y-4">
          <InputField label="Valor do Imóvel">
            <CurrencyInput
              value={form.propertyValue}
              onChange={(v) => setForm((f) => ({ ...f, propertyValue: v }))}
            />
          </InputField>

          <InputField
            label="Entrada"
            hint={`Mínimo recomendado: ${formatCurrency(minDownPayment)} (20%)`}
          >
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
                <CurrencyInput
                  value={form.downPayment}
                  onChange={(v) => setForm((f) => ({ ...f, downPayment: v }))}
                />
              </div>
              <div className="col-span-2">
                <PercentInput
                  value={
                    form.propertyValue > 0
                      ? (form.downPayment / form.propertyValue) * 100
                      : 0
                  }
                  onChange={(pct) =>
                    setForm((f) => ({
                      ...f,
                      downPayment: (f.propertyValue * pct) / 100,
                    }))
                  }
                />
              </div>
            </div>
          </InputField>

          {/* FGTS */}
          <div className="flex items-center gap-3 py-2 border-t border-gray-100">
            <input
              type="checkbox"
              id="fgts"
              checked={form.useFgts}
              onChange={(e) =>
                setForm((f) => ({ ...f, useFgts: e.target.checked }))
              }
              className="w-4 h-4 accent-[var(--brand-yellow)]"
            />
            <label htmlFor="fgts" className="text-sm font-medium text-gray-700 cursor-pointer">
              Usar FGTS na entrada
            </label>
          </div>

          {form.useFgts && (
            <InputField label="Valor do FGTS">
              <CurrencyInput
                value={form.fgtsAmount}
                onChange={(v) => setForm((f) => ({ ...f, fgtsAmount: v }))}
                placeholder="Saldo disponível"
              />
            </InputField>
          )}

          <InputField label="Prazo">
            <select
              value={form.termMonths}
              onChange={(e) =>
                setForm((f) => ({ ...f, termMonths: Number(e.target.value) }))
              }
              className="w-full py-2.5 px-3 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} meses ({t / 12} anos)
                </option>
              ))}
            </select>
          </InputField>

          <InputField label="Taxa de Juros (% a.a.)">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={3}
                max={16}
                step={0.25}
                value={form.annualRate}
                onChange={(e) => {
                  setMcmvIndex(null);
                  setForm((f) => ({ ...f, annualRate: Number(e.target.value) }));
                }}
                className="flex-1 accent-[var(--brand-yellow)]"
              />
              <span className="w-14 text-center font-bold text-[var(--brand-dark)] bg-[var(--brand-yellow)] px-2 py-1 text-sm">
                {form.annualRate}%
              </span>
            </div>
          </InputField>

          <InputField label="Sistema de Amortização">
            <div className="grid grid-cols-2 gap-2">
              {(["price", "sac"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm((f) => ({ ...f, system: s }))}
                  className={`py-2 text-sm font-bold uppercase border transition-all ${
                    form.system === s
                      ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)] border-[var(--brand-dark)]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-[var(--brand-dark)]"
                  }`}
                >
                  {s === "price" ? "Price" : "SAC"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {form.system === "price"
                ? "Parcelas iguais do início ao fim"
                : "Parcelas decrescentes — paga menos ao longo do tempo"}
            </p>
          </InputField>
        </div>
      </div>

      {/* Results */}
      <div className="xl:col-span-3 space-y-5">
        {result.loanAmount <= 0 ? (
          <div className="bg-white border border-gray-100 p-8 text-center">
            <Calculator size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">
              A entrada informada cobre o valor total do imóvel.
            </p>
          </div>
        ) : (
          <>
            {/* Generate PDF */}
            <div className="bg-white border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[var(--brand-dark)] text-sm">Sua simulação está pronta</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Gere um PDF com os resultados e o comparativo de taxas dos principais bancos.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  onClick={() => generateSimulationPdf(form, result)}
                  className="flex items-center gap-2 bg-[var(--brand-dark)] hover:bg-[var(--brand-dark)]/80 text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
                >
                  <FileDown size={15} />
                  PDF Simples
                </button>
                <button
                  onClick={() => generateSimulationPdfWithSchedule(form, result)}
                  className="flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow)]/80 text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
                >
                  <FileDown size={15} />
                  PDF Completo + Tabela
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--brand-dark)] p-5">
                <p className="text-gray-400 text-xs uppercase tracking-wide">
                  Valor Financiado
                </p>
                <p className="text-[var(--brand-yellow)] font-black text-2xl mt-1">
                  {formatCurrency(result.loanAmount)}
                </p>
              </div>
              <div className="bg-[var(--brand-yellow)] p-5">
                <p className="text-[var(--brand-dark)] text-xs uppercase tracking-wide font-bold">
                  {form.system === "price" ? "Parcela Fixa" : "1ª Parcela"}
                </p>
                <p className="text-[var(--brand-dark)] font-black text-2xl mt-1">
                  {formatCurrency(result.firstInstallment)}
                </p>
              </div>
              {form.system === "sac" && (
                <div className="bg-white border border-gray-100 p-5">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">
                    Última Parcela
                  </p>
                  <p className="text-[var(--brand-dark)] font-black text-2xl mt-1 flex items-center gap-1">
                    {formatCurrency(result.lastInstallment)}
                    <TrendingDown size={16} className="text-green-500" />
                  </p>
                </div>
              )}
              <div className={`bg-white border border-gray-100 p-5 ${form.system !== "sac" ? "col-span-2" : ""}`}>
                <p className="text-gray-400 text-xs uppercase tracking-wide">
                  Total Pago
                </p>
                <p className="text-[var(--brand-dark)] font-black text-2xl mt-1">
                  {formatCurrency(result.totalPaid)}
                </p>
              </div>
            </div>

            {/* Breakdown bar */}
            <div className="bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                Composição do Total Pago
              </p>
              <div className="flex h-4 overflow-hidden mb-3">
                <div
                  style={{
                    width: `${(result.loanAmount / result.totalPaid) * 100}%`,
                  }}
                  className="bg-[var(--brand-dark)] transition-all duration-500"
                  title="Principal"
                />
                <div
                  style={{
                    width: `${(result.totalInterest / result.totalPaid) * 100}%`,
                  }}
                  className="bg-[var(--brand-yellow)] transition-all duration-500"
                  title="Juros"
                />
                <div
                  style={{
                    width: `${(result.totalInsurance / result.totalPaid) * 100}%`,
                  }}
                  className="bg-gray-300 transition-all duration-500"
                  title="Seguros"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[var(--brand-dark)] shrink-0" />
                  <div>
                    <p className="text-gray-500">Principal</p>
                    <p className="font-bold">{formatCurrency(result.loanAmount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[var(--brand-yellow)] shrink-0" />
                  <div>
                    <p className="text-gray-500">Juros</p>
                    <p className="font-bold text-amber-600">
                      {formatCurrency(result.totalInterest)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-gray-300 shrink-0" />
                  <div>
                    <p className="text-gray-500">Seguros</p>
                    <p className="font-bold">{formatCurrency(result.totalInsurance)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank rate comparison */}
            <div className="bg-white border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Landmark size={15} className="text-[var(--brand-yellow)]" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Comparativo de Taxas — Principais Bancos
                </p>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Taxas de referência pesquisadas no mercado em {BANK_RATES_REFERENCE_DATE}. A parcela estimada usa o
                mesmo valor financiado, prazo e sistema de amortização desta simulação — apenas trocando a taxa de
                juros pela de cada banco. Os valores finais variam conforme análise de crédito, renda e
                relacionamento com cada instituição.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Banco</th>
                      <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Taxa de referência</th>
                      <th className="px-4 py-2 text-right font-bold text-gray-500 uppercase tracking-wide">
                        {form.system === "price" ? "Parcela estimada" : "1ª parcela estimada"}
                      </th>
                      <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Índice</th>
                      <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bankComparison.map((b) => (
                      <tr key={b.bank} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-bold text-[var(--brand-dark)]">{b.bank}</td>
                        <td className="px-4 py-2 text-gray-600">{b.rateLabel}</td>
                        <td className="px-4 py-2 text-right font-bold text-[var(--brand-dark)]">
                          {formatCurrency(b.installment)}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{b.index}</td>
                        <td className="px-4 py-2 text-gray-400">{b.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                * Comparativo meramente informativo. Parcela estimada calculada com base no valor financiado, prazo e
                sistema de amortização desta simulação. Confirme sempre as condições atualizadas diretamente com cada banco.
              </p>
            </div>

            {/* Amortization table */}
            <div className="bg-white border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Tabela de Amortização
                </p>
                <span className="text-xs text-gray-400">
                  {form.termMonths} parcelas
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Mês</th>
                      <th className="px-4 py-2 text-right font-bold text-gray-500 uppercase tracking-wide">Parcela</th>
                      <th className="px-4 py-2 text-right font-bold text-gray-500 uppercase tracking-wide">Amortização</th>
                      <th className="px-4 py-2 text-right font-bold text-gray-500 uppercase tracking-wide">Juros</th>
                      <th className="px-4 py-2 text-right font-bold text-gray-500 uppercase tracking-wide">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displaySchedule.map((row) => (
                      <tr key={row.month} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-600">{row.month}</td>
                        <td className="px-4 py-2 text-right font-bold text-[var(--brand-dark)]">
                          {formatCurrency(row.payment)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {formatCurrency(row.principal)}
                        </td>
                        <td className="px-4 py-2 text-right text-amber-600">
                          {formatCurrency(row.interest)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {formatCurrency(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.schedule.length > 12 && (
                <button
                  onClick={() => setShowFullTable((v) => !v)}
                  className="w-full py-3 text-xs font-bold uppercase tracking-wide text-gray-500 hover:bg-gray-50 hover:text-[var(--brand-dark)] border-t border-gray-100 flex items-center justify-center gap-1 transition-colors"
                >
                  {showFullTable ? (
                    <>
                      <ChevronUp size={13} /> Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown size={13} /> Ver todas as {form.termMonths} parcelas
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 leading-relaxed">
              * Simulação meramente ilustrativa. Valores de seguro estimados (MIP + DFI).
              Taxas e condições sujeitas à análise de crédito.
              Consulte um de nossos especialistas para uma proposta personalizada.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
