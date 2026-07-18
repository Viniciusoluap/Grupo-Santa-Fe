// Lançamento Imobiliário (4.4 Lançamento, Marketing e Vendas) — painel do
// evento de lançamento: vendas realizadas comparadas ao mix projetado na
// Viabilidade/Estudo de Massa (velocidade de vendas real x projetada).

export interface VendaLancamento {
  id: string;
  unidade: string;
  comprador?: string;
  valorVenda: number;
  data?: string; // ISO yyyy-mm-dd
}

export interface ResumoLancamentoImobiliario {
  unidadesVendidas: number;
  vgvVendido: number;
  totalUnidadesProjetado: number | null;
  vgvProjetadoTotal: number | null;
  pctUnidadesVendidas: number | null; // vendidas / total projetado × 100
  pctVgvVendido: number | null; // vgv vendido / vgv total projetado × 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resumoLancamentoImobiliario(
  vendas: VendaLancamento[],
  totalUnidadesProjetado?: number | null,
  vgvProjetadoTotal?: number | null
): ResumoLancamentoImobiliario {
  const unidadesVendidas = vendas.length;
  const vgvVendido = round2(vendas.reduce((s, v) => s + v.valorVenda, 0));
  const totalProjetado = totalUnidadesProjetado && totalUnidadesProjetado > 0 ? totalUnidadesProjetado : null;
  const vgvProjetado = vgvProjetadoTotal && vgvProjetadoTotal > 0 ? vgvProjetadoTotal : null;
  return {
    unidadesVendidas,
    vgvVendido,
    totalUnidadesProjetado: totalProjetado,
    vgvProjetadoTotal: vgvProjetado,
    pctUnidadesVendidas: totalProjetado ? round1((unidadesVendidas / totalProjetado) * 100) : null,
    pctVgvVendido: vgvProjetado ? round1((vgvVendido / vgvProjetado) * 100) : null,
  };
}

/** Lê o JSON salvo e diz se já há ao menos uma venda registrada no evento de lançamento. */
export function lancamentoImobiliarioComVendasDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { vendas?: VendaLancamento[] };
    return Array.isArray(dados.vendas) && dados.vendas.length > 0;
  } catch {
    return false;
  }
}
