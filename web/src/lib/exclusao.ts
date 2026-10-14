// Excluir é excluir (item 03 + pedido A6 de 14/10/2026).
// Mesmo arquivo em Prospecta/shared/exclusao.ts.
//
// EXCLUIR remove o registro de vez (some das listas, pesquisas, filtros e
// totais), junto com tudo o que só existe por causa dele: lançamentos
// financeiros, medições, aportes, comissões, etapas, checklist, fotos e o
// vínculo de serviço do CRM. O cliente/lead e os dados compartilhados ficam.
// Não existe mais "Cancelar": a situação "Cancelado" só aparece quando escolhida
// no próprio campo de situação do processo.

export type ModuloExclusao = "obra" | "financiamento" | "projeto" | "regularizacao" | "avaliacao" | "estudo" | "comissao";

export interface DependenciasExclusao {
  /** Movimentos financeiros (custos, pagamentos, recebimentos). */
  movimentosFinanceiros?: number;
  /** Recebimentos registrados (manuais ou do BPO). */
  recebimentos?: number;
  /** Comissões geradas para o negócio. */
  comissoes?: number;
  /** Aportes de investidores vinculados. */
  investidores?: number;
  /** Medições registradas. */
  medicoes?: number;
  /** Unidades do estudo (vendidas, reservadas ou disponíveis). */
  unidades?: number;
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** O que sai junto com o registro (para a confirmação); lista vazia = só o registro. */
export function itensExcluidosJunto(d: DependenciasExclusao): string[] {
  const itens: string[] = [];
  if ((d.movimentosFinanceiros ?? 0) > 0) itens.push(plural(d.movimentosFinanceiros!, "movimento financeiro", "movimentos financeiros"));
  if ((d.recebimentos ?? 0) > 0) itens.push(plural(d.recebimentos!, "recebimento", "recebimentos"));
  if ((d.comissoes ?? 0) > 0) itens.push(plural(d.comissoes!, "comissão", "comissões"));
  if ((d.investidores ?? 0) > 0) itens.push(plural(d.investidores!, "aporte de investidor", "aportes de investidores"));
  if ((d.medicoes ?? 0) > 0) itens.push(plural(d.medicoes!, "medição", "medições"));
  if ((d.unidades ?? 0) > 0) itens.push(plural(d.unidades!, "unidade", "unidades"));
  return itens;
}
