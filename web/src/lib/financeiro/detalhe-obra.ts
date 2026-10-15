// Tela "Detalhes da obra": etapas, resumo financeiro e estatísticas espelham
// exatamente o que foi preenchido no editor da obra (progresso por incidência e
// Valores da Operação/Custos). Função pura — mesmo arquivo em
// Prospecta/shared/financeiro/detalhe-obra.ts.
import type { Indicador, ResultadoObra } from "./obra";
import type { ResultadoProgresso } from "./progresso";

export type SituacaoEtapa = "concluida" | "em_andamento" | "pendente";

export interface EtapaDetalhe {
  chave: string;
  nome: string;
  /** Peso do serviço na obra (%). */
  incidencia: number;
  /** Quanto do serviço foi executado (%). */
  execucao: number;
  /** Quanto o serviço já representa da obra inteira (%). */
  execucaoObra: number;
  situacao: SituacaoEtapa;
}

export interface DetalheObra {
  etapas: EtapaDetalhe[];
  financeiro: {
    orcamentoPrevisto: Indicador;
    receberBanco: Indicador;
    plsReal: ResultadoObra["plsReal"];
    gastoObraRealizado: Indicador;
    saldoRestante: Indicador;
  };
  estatisticas: { totalEtapas: number; etapasConcluidas: number; totalFotos: number };
}

/** Etapas = serviços com incidência na obra; concluída = 100% executada. */
export function montarDetalheObra(progresso: ResultadoProgresso, financeiro: ResultadoObra, totalFotos: number): DetalheObra {
  const etapas = progresso.itens
    .filter((i) => i.incidencia > 0)
    .map((i): EtapaDetalhe => ({
      chave: i.chave, nome: i.nome, incidencia: i.incidencia, execucao: i.execucao, execucaoObra: i.execucaoObra,
      situacao: i.execucao >= 100 ? "concluida" : i.execucao > 0 ? "em_andamento" : "pendente",
    }));
  return {
    etapas,
    financeiro: {
      orcamentoPrevisto: financeiro.custoConstrucao,
      receberBanco: financeiro.receberBanco,
      plsReal: financeiro.plsReal,
      gastoObraRealizado: financeiro.gastoObraRealizado,
      saldoRestante: financeiro.saldoRestante,
    },
    estatisticas: {
      totalEtapas: etapas.length,
      etapasConcluidas: etapas.filter((e) => e.situacao === "concluida").length,
      totalFotos,
    },
  };
}
