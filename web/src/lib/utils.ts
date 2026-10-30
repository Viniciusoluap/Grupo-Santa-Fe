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
  // Padrão numérico global (lote 3): 1.000.000,00 — sempre 2 casas.
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

// Padrão numérico global (lote 3): sempre 2 casas ("6,00%"), igual ao
// `formatPercent` da Prospecta (`client/src/lib/format.ts`).
export function formatPercent(value: number): string {
  const numero = Number.isFinite(value) ? value : 0;
  return `${numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
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

/**
 * Pedido de 15/10 — dinheiro sempre no padrão "1.000.000,00": a máscara põe os
 * pontos de milhar enquanto a pessoa digita ("180000" -> "180.000"). Ponto
 * digitado é milhar; vírgula é decimal (máx. 2 casas); um ponto digitado no fim
 * vira vírgula. Gêmeo de `mascararDinheiro` da Prospecta (client/src/lib/numero-input.ts).
 */
export function mascararDinheiro(valorTexto: string): { texto: string; numero: number } {
  let bruto = valorTexto.replace(/[^\d.,]/g, "");
  if (bruto.endsWith(".") && !bruto.includes(",")) bruto = `${bruto.slice(0, -1)},`;
  const virgula = bruto.indexOf(",");
  const inteiroBruto = (virgula >= 0 ? bruto.slice(0, virgula) : bruto).replace(/\D/g, "");
  const decimais = virgula >= 0 ? bruto.slice(virgula + 1).replace(/\D/g, "").slice(0, 2) : "";
  const inteiro = inteiroBruto.replace(/^0+(?=\d)/, "");
  if (!inteiro && virgula < 0) return { texto: "", numero: 0 };
  const agrupado = (inteiro || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const texto = virgula >= 0 ? `${agrupado},${decimais}` : agrupado;
  return { texto, numero: Number(`${inteiro || "0"}.${decimais || "0"}`) };
}

/** Valor do campo de dinheiro ao sair dele: "1.000.000,00" (vazio para zero). */
export function dinheiroParaCampo(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor) || valor === 0) return "";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
 * valores vindos de integrações externas (ex.: agregadores), que podem chegar no
 * formato americano.
 *
 * Quando a vírgula decimal está presente, qualquer "." é tratado como
 * separador de milhar (padrão BR). Sem vírgula, um único "." seguido de 1 ou
 * 2 dígitos finais é tratado como separador decimal — ex.: "350000.00" →
 * 350000, "120.5" → 120.5 (formato americano, comum em integrações externas) —
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
