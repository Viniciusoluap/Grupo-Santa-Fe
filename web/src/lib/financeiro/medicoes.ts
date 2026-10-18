// Pedido de 18/10 — valor estimado de cada medição do histórico.
// Mesmo arquivo em Prospecta/shared/financeiro/medicoes.ts.
//
//   Y = (valor financiado + FGTS + subsídio) − valor do terreno   (a "Base do PLS")
//   X = Y × (percentual desta medição − percentual da medição anterior)
//
// O percentual de cada medição é o acumulado da obra quando ela foi salva; a
// diferença para a anterior é o que avançou naquela medição (opção B do dono).
// Valores em centavos (inteiros), sem arredondamento intermediário.

export interface ValoresBaseMedicao {
  financiamento: number | null;
  fgts: number | null;
  subsidio: number | null;
  custoTerreno: number | null;
}

export type BaseMedicao = { ok: true; centavos: number } | { ok: false; motivo: string };

/** Y — os quatro valores precisam estar informados (zero vale; vazio não). */
export function baseDaMedicao(v: ValoresBaseMedicao): BaseMedicao {
  const faltando = (
    [["Valor financiado", v.financiamento], ["FGTS", v.fgts], ["Subsídio", v.subsidio], ["Custo do terreno", v.custoTerreno]] as const
  ).filter(([, valor]) => valor === null).map(([nome]) => nome);
  if (faltando.length) return { ok: false, motivo: `Dados incompletos: ${faltando.join(", ")}` };
  return { ok: true, centavos: v.financiamento! + v.fgts! + v.subsidio! - v.custoTerreno! };
}

export interface MedicaoParaEstimar {
  id: number | string;
  /** Percentual acumulado da obra quando a medição foi salva (0–100). */
  progresso: number;
  criadoEm: Date | string;
}

export interface EstimativaMedicao {
  /** Quanto a obra avançou nesta medição (pontos percentuais). */
  percentualDaMedicao: number;
  /** X em centavos; null quando a base (Y) está incompleta. */
  valorCentavos: number | null;
  /** Medição menor que a anterior: não há valor a receber. */
  aviso: string | null;
}

/** Estimativas por id, calculadas em ordem cronológica (independe da ordem recebida). */
export function estimarMedicoes(medicoes: MedicaoParaEstimar[], base: BaseMedicao): Map<MedicaoParaEstimar["id"], EstimativaMedicao> {
  const ordem = [...medicoes].sort((a, b) => {
    const t = new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
    return t !== 0 ? t : String(a.id).localeCompare(String(b.id), "en", { numeric: true });
  });
  const resultado = new Map<MedicaoParaEstimar["id"], EstimativaMedicao>();
  let anterior = 0;
  for (const m of ordem) {
    const delta = m.progresso - anterior;
    anterior = m.progresso;
    if (delta < 0) {
      resultado.set(m.id, { percentualDaMedicao: delta, valorCentavos: base.ok ? 0 : null, aviso: "Medição menor que a anterior: sem valor a receber." });
      continue;
    }
    resultado.set(m.id, {
      percentualDaMedicao: delta,
      valorCentavos: base.ok ? Math.round((base.centavos * delta) / 100) : null,
      aviso: null,
    });
  }
  return resultado;
}

export type SituacaoMedicao = "registrada" | "solicitada" | "recebida";

export function situacaoDaMedicao(m: { solicitadaEm?: Date | string | null; recebidaEm?: Date | string | null }): SituacaoMedicao {
  if (m.recebidaEm) return "recebida";
  if (m.solicitadaEm) return "solicitada";
  return "registrada";
}

/** Filtro da lista de obras por situação das medições. */
export type FiltroMedicao = "" | "solicitada" | "recebida";

export function obraPassaFiltroMedicao(o: { medicoesSolicitadas: number; medicoesRecebidas: number }, f: FiltroMedicao): boolean {
  if (f === "solicitada") return o.medicoesSolicitadas > 0;
  if (f === "recebida") return o.medicoesRecebidas > 0;
  return true;
}
