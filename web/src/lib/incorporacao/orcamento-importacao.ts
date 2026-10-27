import type { LinhaOrcamentoExcel } from "@/lib/orcamento/parametrizado";
export type MapeamentoOrcamento = Record<"descricao" | "unidade" | "quantidade" | "unitario" | "total", number>;
export function numeroOrcamento(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : 0;
  if (typeof v !== "string") return 0;
  const s = v.trim().replace(/R\$\s*/g, "").replace(/\s/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function colunaExcel(i: number): string {
  let result = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
/** Lê só a aba/mapeamento conferidos; resultados de fórmulas vêm do cache do arquivo. */
export function lerLinhasOrcamento(matriz: unknown[][], linhaCabecalho: number, m: MapeamentoOrcamento, formulas: Record<string, string> = {}): LinhaOrcamentoExcel[] {
  if (m.descricao < 0 || !Number.isInteger(linhaCabecalho) || linhaCabecalho < 1) return [];
  return matriz.slice(linhaCabecalho).flatMap((row, idx) => {
    const descricao = String(row[m.descricao] ?? "").trim();
    // Somatórios são conservados no original, sem duplicar os itens no orçamento.
    if (!descricao || /^(sub[\s-]?total(?:\s+.*)?|total(?:\s+geral)?|descri[cç][aã]o)$/i.test(descricao)) return [];
    const quantidade = numeroOrcamento(row[m.quantidade]); const unitario = numeroOrcamento(row[m.unitario]);
    const bruto = m.total >= 0 ? row[m.total] : null;
    const total = bruto !== null && bruto !== undefined && bruto !== "" ? numeroOrcamento(bruto) : Math.round(quantidade * unitario * 100) / 100;
    const formula = m.total >= 0 ? formulas[`${colunaExcel(m.total)}${idx + linhaCabecalho + 1}`] : undefined;
    return [{ descricao, unidade: String(row[m.unidade] ?? ""), quantidade, unitario, total, ...(formula ? { formula } : {}) }];
  });
}

/** Exporta os valores editados; o original e suas fórmulas continuam preservados separadamente. */
export function matrizOrcamentoAtualizado(linhas: LinhaOrcamentoExcel[]): (string | number)[][] {
  return [["Descrição", "Unidade", "Quantidade", "Preço unitário", "Total"],
    ...linhas.map((l) => [l.descricao, l.unidade, l.quantidade, l.unitario, l.total]),
    ["Total geral", "", "", "", Math.round(linhas.reduce((n, l) => n + l.total, 0) * 100) / 100]];
}
