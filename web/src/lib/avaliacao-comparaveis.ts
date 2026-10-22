/** Recalcula as médias com os anúncios válidos, sem confiar em totais produzidos pela IA. */
export interface Comparavel { descricao: string; preco: number; area: number; precoPorM2: number }
export interface ComparaveisResult {
  comparaveis: Comparavel[];
  valorMedio: number;
  precoPorM2Medio: number;
  totalEncontrados: number;
  bairroConsultado: string;
  url: string;
}
export function normalizarComparaveis(raw: unknown, bairro: string, url: string): ComparaveisResult {
  const rows = raw && typeof raw === "object" && "comparaveis" in raw ? (raw as { comparaveis: unknown }).comparaveis : [];
  const comparaveis: Comparavel[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const { descricao, preco, area } = row as Record<string, unknown>;
    if (typeof descricao !== "string" || !descricao.trim() || typeof preco !== "number" || typeof area !== "number" || !Number.isFinite(preco) || !Number.isFinite(area) || preco <= 0 || area <= 0) continue;
    comparaveis.push({ descricao: descricao.trim(), preco, area, precoPorM2: Math.round(preco / area) });
    if (comparaveis.length === 6) break;
  }
  if (!comparaveis.length) throw new Error(`Nenhum anúncio com preço e área válidos encontrado para ${bairro}.`);
  return {
    comparaveis,
    valorMedio: Math.round(comparaveis.reduce((sum, row) => sum + row.preco, 0) / comparaveis.length),
    precoPorM2Medio: Math.round(comparaveis.reduce((sum, row) => sum + row.precoPorM2, 0) / comparaveis.length),
    totalEncontrados: comparaveis.length,
    bairroConsultado: bairro,
    url,
  };
}
