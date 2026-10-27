export function valorRealizado(l: { valor: number; pago: boolean; valorRecebido?: number | null }) {
  return l.pago ? l.valor : Math.min(l.valor, Math.max(0, l.valorRecebido ?? 0));
}
export function saldoLancamento(l: { valor: number; pago: boolean; valorRecebido?: number | null }) {
  return Math.round((l.valor - valorRealizado(l)) * 100) / 100;
}
export function calcularBaixa(l: { valor: number; pago: boolean; valorRecebido?: number | null }, valor: number) {
  const baixa = Math.round(valor * 100);
  const saldo = Math.round(saldoLancamento(l) * 100);
  if (!Number.isFinite(valor) || baixa <= 0 || baixa > saldo) throw new Error("Informe um valor positivo até o saldo restante.");
  const valorRecebido = (Math.round(valorRealizado(l) * 100) + baixa) / 100;
  return { valorRecebido, pago: baixa === saldo };
}
