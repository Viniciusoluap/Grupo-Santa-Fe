// LOTE C (25/10, paridade Prospecta): números do BPO Financeiro (DRE, Contabilidade, Relatórios)
// a partir de bpo_lancamentos — inclusive os gerados pelo extrato bancário. Regras puras.
// Transferência interna não é receita nem despesa; despesa = "despesa" e "despesa_*".
import { contaNoResultado, ehDespesa } from "@/lib/bpo-categorias";

export type LancamentoResultado = {
  tipo: string;
  valor: number;
  competencia: string;
  pago: boolean;
  categoria?: string | null;
};

export type LinhaDre = { competencia: string; receitas: number; despesas: number; resultado: number };

const centavos = (n: number) => Math.round(n * 100) / 100;

/** DRE por competência (mais recente primeiro), sem transferências internas. */
export function montarDre(lancamentos: LancamentoResultado[]): LinhaDre[] {
  const mapa = new Map<string, { receitas: number; despesas: number }>();
  for (const l of lancamentos) {
    if (!contaNoResultado(l)) continue;
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
    if (!l.pago || !contaNoResultado(l)) continue;
    if ((de && l.competencia < de) || (ate && l.competencia > ate)) continue;
    const nome = l.categoria || "Sem categoria";
    const e = cat.get(nome) ?? { receitas: 0, despesas: 0 };
    if (ehDespesa(l.tipo)) {
      despesasPagas += l.valor;
      e.despesas += l.valor;
      if (l.categoria === "Impostos" || l.tipo === "despesa_imposto") impostosPagos += l.valor;
    } else {
      receitaRealizada += l.valor;
      e.receitas += l.valor;
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
