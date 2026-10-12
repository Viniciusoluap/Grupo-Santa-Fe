import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "Pendente de configuração";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatArea(value: number | null | undefined): string {
  if (value == null) return "Pendente de configuração";
  return `${value.toLocaleString("pt-BR")} m²`;
}

export function formatTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function currencyToFloat(masked: string): string {
  return masked.replace(/\./g, "").replace(",", ".");
}

/**
 * Converte um número digitado no padrão brasileiro (separador de milhar "."
 * e decimal ",") para `number` — ex.: "1.234,56" → 1234.56, "0,05" → 0.05,
 * "250" → 250. Diferente de `currencyToFloat` (que espera um valor já
 * mascarado em centavos), esta função aceita texto livre digitado pelo
 * usuário em campos numéricos comuns (áreas, percentuais, preços).
 *
 * Nunca lança exceção: entrada vazia, nula ou inválida retorna 0.
 */
export function parseNumeroBR(valor: string | null | undefined): number {
  if (typeof valor !== "string") return 0;
  const limpo = valor.trim().replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;
  const semSeparadorDeMilhar = limpo.replace(/\./g, "").replace(",", ".");
  const n = Number(semSeparadorDeMilhar);
  return Number.isFinite(n) ? n : 0;
}
