// 10 implementações, item 03 — Excluir não é Cancelar.
// Mesmo arquivo em Prospecta/shared/exclusao.ts.
//
// EXCLUIR remove o registro de vez (some das listas, pesquisas, filtros e
// totais), junto com o que só existe por causa dele (etapas, checklist, fotos,
// vínculo de serviço do CRM). O cliente/lead e os dados compartilhados ficam.
// CANCELAR mantém o registro e o histórico, só muda a situação.
//
// Registros com guarda obrigatória (contábil, jurídica ou contratual) não são
// excluídos: a função abaixo explica o impedimento e orienta a cancelar/estornar.

export type ModuloExclusao = "obra" | "financiamento" | "projeto" | "regularizacao" | "avaliacao" | "estudo" | "comissao";

const NAO_PODE_EXCLUIR: Record<ModuloExclusao, string> = {
  obra: "Esta obra não pode ser excluída",
  financiamento: "Este financiamento não pode ser excluído",
  projeto: "Este projeto não pode ser excluído",
  regularizacao: "Esta regularização não pode ser excluída",
  avaliacao: "Esta avaliação não pode ser excluída",
  estudo: "Este estudo de incorporação não pode ser excluído",
  comissao: "Esta comissão não pode ser excluída",
};

export interface DependenciasExclusao {
  /** Movimentos financeiros (custos, pagamentos, recebimentos), inclusive cancelados. */
  movimentosFinanceiros?: number;
  /** Recebimentos registrados (manuais ou do BPO), inclusive cancelados. */
  recebimentos?: number;
  /** Comissões geradas para o negócio. */
  comissoes?: number;
  /** Aportes de investidores vinculados. */
  investidores?: number;
  /** Contratos vinculados. */
  contratos?: number;
  /** Medições registradas. */
  medicoes?: number;
  /** Valor já pago registrado no próprio cadastro (legado), em reais. */
  valorPago?: number;
  /** Unidades vendidas ou reservadas (compromisso contratual com comprador). */
  unidadesComercializadas?: number;
  /** Comissão já paga (registro contábil). */
  comissaoPaga?: boolean;
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Motivos que impedem a exclusão definitiva; lista vazia = pode excluir. */
export function impedimentosExclusao(d: DependenciasExclusao): string[] {
  const motivos: string[] = [];
  if ((d.movimentosFinanceiros ?? 0) > 0) motivos.push(plural(d.movimentosFinanceiros!, "movimento financeiro", "movimentos financeiros"));
  if ((d.recebimentos ?? 0) > 0) motivos.push(plural(d.recebimentos!, "recebimento", "recebimentos"));
  if ((d.comissoes ?? 0) > 0) motivos.push(plural(d.comissoes!, "comissão", "comissões"));
  if ((d.investidores ?? 0) > 0) motivos.push(plural(d.investidores!, "aporte de investidor", "aportes de investidores"));
  if ((d.contratos ?? 0) > 0) motivos.push(plural(d.contratos!, "contrato", "contratos"));
  if ((d.medicoes ?? 0) > 0) motivos.push(plural(d.medicoes!, "medição", "medições"));
  if ((d.valorPago ?? 0) > 0) motivos.push("pagamento registrado");
  if ((d.unidadesComercializadas ?? 0) > 0) motivos.push(plural(d.unidadesComercializadas!, "unidade vendida ou reservada", "unidades vendidas ou reservadas"));
  if (d.comissaoPaga) motivos.push("pagamento já efetuado");
  return motivos;
}

/** Mensagem ao usuário quando a exclusão é impedida; null quando pode excluir. */
export function motivoBloqueioExclusao(modulo: ModuloExclusao, d: DependenciasExclusao): string | null {
  const motivos = impedimentosExclusao(d);
  if (!motivos.length) return null;
  return `${NAO_PODE_EXCLUIR[modulo]} definitivamente porque tem ${motivos.join(", ")}. ` +
    "Esses registros precisam ser guardados por razões contábeis e jurídicas. Use \"Cancelar\" para encerrar mantendo o histórico.";
}
