import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatArea(value: number): string {
  return `${value.toLocaleString("pt-BR")} m²`;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
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
 * usuário em campos numéricos comuns (áreas, percentuais, preços) — e também
 * valores vindos de integrações externas (feeds XML), que podem chegar no
 * formato americano.
 *
 * Quando a vírgula decimal está presente, qualquer "." é tratado como
 * separador de milhar (padrão BR). Sem vírgula, um único "." seguido de 1 ou
 * 2 dígitos finais é tratado como separador decimal — ex.: "350000.00" →
 * 350000, "120.5" → 120.5 (formato americano, comum em feeds externos) —
 * enquanto um "." seguido de 3 dígitos (ou múltiplos pontos) continua sendo
 * tratado como separador de milhar — ex.: "1.234" → 1234.
 *
 * Nunca lança exceção: entrada vazia, nula ou inválida retorna 0.
 */
export function parseNumeroBR(valor: string | null | undefined): number {
  if (typeof valor !== "string") return 0;
  const limpo = valor.trim().replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;

  let normalizado: string;
  if (limpo.includes(",")) {
    // Padrão BR: "." é sempre separador de milhar, "," é o decimal.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    const pontos = limpo.match(/\./g);
    if (!pontos) {
      normalizado = limpo;
    } else {
      const ultimoTrecho = limpo.slice(limpo.lastIndexOf(".") + 1);
      const ehDecimalAmericano = pontos.length === 1 && ultimoTrecho.length > 0 && ultimoTrecho.length <= 2;
      normalizado = ehDecimalAmericano ? limpo : limpo.replace(/\./g, "");
    }
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}
