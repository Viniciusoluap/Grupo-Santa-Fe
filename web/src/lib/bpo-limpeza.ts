/** Somente lançamentos comprovadamente criados pelo importador são elegíveis para remoção. */
export function preservarLancamentoNaLimpeza(l: { origemEfetiva?: string | null; asaasPaymentId?: string | null; vinculoOperacionalId?: string | null; movimentosObra: unknown[]; recebimentosRegularizacao: unknown[] }) {
  return l.origemEfetiva !== "extrato" || Boolean(l.asaasPaymentId || l.vinculoOperacionalId || l.movimentosObra.length || l.recebimentosRegularizacao.length);
}
