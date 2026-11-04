/** Somente lançamentos comprovadamente criados pelo importador são elegíveis para remoção. */
export function preservarLancamentoNaLimpeza(l: { exclusaoLoteBackupId?: string | null; origemEfetiva?: string | null; asaasPaymentId?: string | null; vinculoOperacionalId?: string | null; movimentosObra: unknown[]; recebimentosRegularizacao: unknown[] }) {
  return !!l.exclusaoLoteBackupId || l.origemEfetiva !== "extrato" || Boolean(l.asaasPaymentId || l.vinculoOperacionalId || l.movimentosObra.length || l.recebimentosRegularizacao.length);
}
