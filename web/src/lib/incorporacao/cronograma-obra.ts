// Cronograma Físico-Financeiro (5.3 Projetos Executivos e Obras) — curva S
// física (medições reais em obra) x financeira (desembolso linear
// projetado a partir da duração de obra já definida na Viabilidade, 2.5).

export interface MedicaoMensal {
  id: string;
  mes: number; // mês desde o início da obra (0 = primeiro mês)
  avancoFisicoAcumuladoPct: number; // 0-100
  data?: string; // ISO yyyy-mm-dd
}

export interface ItemComparativoCronograma extends MedicaoMensal {
  avancoFinanceiroProjetadoPct: number | null;
  desvioPct: number | null; // físico - financeiro projetado (positivo = adiantado)
}

export interface ResumoCronogramaObra {
  itens: ItemComparativoCronograma[];
  avancoFisicoAtualPct: number;
  avancoFinanceiroProjetadoAtualPct: number | null;
  desvioAtualPct: number | null;
  obraConcluida: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Projeção financeira linear (mesma premissa de desembolso em linha reta usada no motor da Viabilidade). */
export function avancoFinanceiroProjetado(mes: number, duracaoObraMeses: number): number | null {
  if (!duracaoObraMeses || duracaoObraMeses <= 0) return null;
  return round1(Math.min(100, Math.max(0, ((mes + 1) / duracaoObraMeses) * 100)));
}

export function resumoCronogramaObra(
  medicoes: MedicaoMensal[],
  duracaoObraMeses?: number | null
): ResumoCronogramaObra {
  const ordenadas = [...medicoes].sort((a, b) => a.mes - b.mes);
  const itens: ItemComparativoCronograma[] = ordenadas.map((m) => {
    const financeiro = duracaoObraMeses ? avancoFinanceiroProjetado(m.mes, duracaoObraMeses) : null;
    return {
      ...m,
      avancoFinanceiroProjetadoPct: financeiro,
      desvioPct: financeiro != null ? round1(m.avancoFisicoAcumuladoPct - financeiro) : null,
    };
  });
  const ultima = itens.length > 0 ? itens[itens.length - 1] : null;
  return {
    itens,
    avancoFisicoAtualPct: ultima?.avancoFisicoAcumuladoPct ?? 0,
    avancoFinanceiroProjetadoAtualPct: ultima?.avancoFinanceiroProjetadoPct ?? null,
    desvioAtualPct: ultima?.desvioPct ?? null,
    obraConcluida: (ultima?.avancoFisicoAcumuladoPct ?? 0) >= 100,
  };
}

/** Lê o JSON salvo e diz se a última medição já indica obra concluída (100% físico). */
export function obraConcluidaDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as { medicoes?: MedicaoMensal[] };
    if (!Array.isArray(dados.medicoes) || dados.medicoes.length === 0) return false;
    const ultima = [...dados.medicoes].sort((a, b) => a.mes - b.mes).pop();
    return (ultima?.avancoFisicoAcumuladoPct ?? 0) >= 100;
  } catch {
    return false;
  }
}
