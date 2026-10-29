// LOTE C (25/10, paridade Prospecta): números do BPO Financeiro (DRE, Contabilidade, Relatórios)
// a partir de bpo_lancamentos — inclusive os gerados pelo extrato bancário. Regras puras.
// Transferência interna não é receita nem despesa; despesa = "despesa" e "despesa_*".
import { CATEGORIAS_BPO, contaNoResultado, ehDespesa } from "@/lib/bpo-categorias";
import { valorRealizado } from "@/lib/bpo-parciais";

export type LancamentoResultado = {
  tipo: string;
  valor: number;
  competencia: string;
  pago: boolean;
  valorRecebido?: number;
  categoria?: string | null;
};

export type LinhaDre = { competencia: string; receitas: number; despesas: number; resultado: number };

const centavos = (n: number) => Math.round(n * 100) / 100;

// Lote 3, item 15 (29/10, paridade Prospecta): filtros Mês/Ano do DRE pela competência (AAAA-MM).
export type FiltroCompetencia = { mes?: string | null; ano?: string | null };
export const MESES_DRE = [
  ["01", "Janeiro"], ["02", "Fevereiro"], ["03", "Março"], ["04", "Abril"], ["05", "Maio"], ["06", "Junho"],
  ["07", "Julho"], ["08", "Agosto"], ["09", "Setembro"], ["10", "Outubro"], ["11", "Novembro"], ["12", "Dezembro"],
] as const;

/** `mes` "01".."12" (vazio = todos os meses) e `ano` "AAAA" (vazio = todos os anos). */
export function competenciaNoFiltro(competencia: string, f?: FiltroCompetencia | null): boolean {
  if (!f) return true;
  if (f.ano && !competencia.startsWith(`${f.ano}-`)) return false;
  if (f.mes && competencia.slice(5, 7) !== f.mes) return false;
  return true;
}

/** DRE por competência (mais recente primeiro), sem transferências internas; `filtro` opcional (Mês/Ano). */
export function montarDre(lancamentos: LancamentoResultado[], filtro?: FiltroCompetencia | null): LinhaDre[] {
  const mapa = new Map<string, { receitas: number; despesas: number }>();
  for (const l of lancamentos) {
    if (!contaNoResultado(l) || !competenciaNoFiltro(l.competencia, filtro)) continue;
    const e = mapa.get(l.competencia) ?? { receitas: 0, despesas: 0 };
    if (ehDespesa(l.tipo)) e.despesas += l.valor;
    else e.receitas += l.valor;
    mapa.set(l.competencia, e);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([competencia, v]) => ({
      competencia,
      receitas: centavos(v.receitas),
      despesas: centavos(v.despesas),
      resultado: centavos(v.receitas - v.despesas),
    }));
}

export type ResumoContabil = {
  receitaRealizada: number;
  despesasPagas: number;
  impostosPagos: number;
  resultado: number;
  porCategoria: { categoria: string; receitas: number; despesas: number }[];
};

/** Realizado (somente pago) no período informado por competência "AAAA-MM" (inclusive). */
export function resumoContabil(lancamentos: LancamentoResultado[], de?: string, ate?: string): ResumoContabil {
  let receitaRealizada = 0, despesasPagas = 0, impostosPagos = 0;
  const cat = new Map<string, { receitas: number; despesas: number }>();
  for (const l of lancamentos) {
    if (!contaNoResultado(l)) continue;
    const valor = valorRealizado(l);
    if (!valor) continue;
    if ((de && l.competencia < de) || (ate && l.competencia > ate)) continue;
    const nome = l.categoria || "Sem categoria";
    const e = cat.get(nome) ?? { receitas: 0, despesas: 0 };
    if (ehDespesa(l.tipo)) {
      despesasPagas += valor;
      e.despesas += valor;
      if (l.categoria === "Impostos" || l.tipo === "despesa_imposto") impostosPagos += valor;
    } else {
      receitaRealizada += valor;
      e.receitas += valor;
    }
    cat.set(nome, e);
  }
  return {
    receitaRealizada: centavos(receitaRealizada),
    despesasPagas: centavos(despesasPagas),
    impostosPagos: centavos(impostosPagos),
    resultado: centavos(receitaRealizada - despesasPagas),
    porCategoria: [...cat.entries()]
      .map(([categoria, v]) => ({ categoria, receitas: centavos(v.receitas), despesas: centavos(v.despesas) }))
      .sort((a, b) => b.receitas + b.despesas - (a.receitas + a.despesas)),
  };
}

/** Últimos 12 meses (mais antigo primeiro) para o gráfico do DRE em Relatórios. */
export function dreUltimos12Meses(lancamentos: LancamentoResultado[], hoje = new Date()): (LinhaDre & { mes: string })[] {
  const dre = new Map(montarDre(lancamentos).map((l) => [l.competencia, l]));
  const out: (LinhaDre & { mes: string })[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
    const comp = d.toISOString().slice(0, 7);
    const l = dre.get(comp);
    out.push({ mes: `${comp.slice(5, 7)}/${comp.slice(2, 4)}`, competencia: comp, receitas: l?.receitas ?? 0, despesas: l?.despesas ?? 0, resultado: l?.resultado ?? 0 });
  }
  return out;
}

export type CelulaDre = { competencia: string; categoria: string; receitas: number; despesas: number };
export type LinhaDreCategoria = { categoria: string; receitas: number; despesas: number; resultado: number };

/** Base compacta (competência × categoria) para a tela filtrar Mês/Ano sem receber todos os lançamentos. */
export function celulasDre(lancamentos: LancamentoResultado[]): CelulaDre[] {
  const mapa = new Map<string, CelulaDre>();
  for (const l of lancamentos) {
    if (!contaNoResultado(l)) continue;
    const categoria = l.categoria?.trim() || "Sem categoria";
    const chave = `${l.competencia}|${categoria}`;
    const e = mapa.get(chave) ?? { competencia: l.competencia, categoria, receitas: 0, despesas: 0 };
    if (ehDespesa(l.tipo)) e.despesas += Math.round(l.valor * 100); else e.receitas += Math.round(l.valor * 100);
    mapa.set(chave, e);
  }
  return [...mapa.values()].map((c) => ({ ...c, receitas: c.receitas / 100, despesas: c.despesas / 100 }));
}

/** DRE filtrado (Mês/Ano) nas duas visões: por competência e por categoria (centavos, sem arredondamento). */
export function dreFiltrado(celulas: CelulaDre[], filtro?: FiltroCompetencia | null) {
  const comp = new Map<string, { r: number; d: number }>();
  const cat = new Map<string, { r: number; d: number }>();
  for (const c of celulas) {
    if (!competenciaNoFiltro(c.competencia, filtro)) continue;
    const r = Math.round(c.receitas * 100), d = Math.round(c.despesas * 100);
    const a = comp.get(c.competencia) ?? { r: 0, d: 0 }; a.r += r; a.d += d; comp.set(c.competencia, a);
    const b = cat.get(c.categoria) ?? { r: 0, d: 0 }; b.r += r; b.d += d; cat.set(c.categoria, b);
  }
  const porCompetencia: LinhaDre[] = [...comp.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    .map(([competencia, v]) => ({ competencia, receitas: v.r / 100, despesas: v.d / 100, resultado: (v.r - v.d) / 100 }));
  const ordem = (c: string) => { const i = (CATEGORIAS_BPO as readonly string[]).indexOf(c); return i < 0 ? 999 : i; };
  const porCategoria: LinhaDreCategoria[] = [...cat.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]) || a[0].localeCompare(b[0], "pt-BR"))
    .map(([categoria, v]) => ({ categoria, receitas: v.r / 100, despesas: v.d / 100, resultado: (v.r - v.d) / 100 }));
  return { porCompetencia, porCategoria };
}
