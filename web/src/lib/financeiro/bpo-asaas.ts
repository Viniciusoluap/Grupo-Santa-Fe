// Paridade 17/11, bloco 3 (gêmeo de `creditoDaCobranca` em Prospecta/shared/financeiro/bpo-asaas.ts): quando o dinheiro
// de uma cobrança do Asaas entra, o crédito do extrato do Asaas e a cobrança são o MESMO lançamento — pelo id do
// pagamento que o extrato traz ou, sem ele, pelo valor (bruto ou líquido) e data próximos. Nunca dois lançamentos.
// Regra pura (sem banco/rede).

export type CreditoCandidatoAsaas = { transacaoId: string; valor: number; data: Date | string };
export type CobrancaParaCredito = { status: string; value: number; netValue?: number | null; dueDate: string; paymentDate?: string | null };

const PAGAS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const meioDia = (dia: string) => new Date(`${dia.slice(0, 10)}T12:00:00Z`);

/**
 * Crédito do extrato do Asaas que corresponde à cobrança PAGA sem id de pagamento no extrato: mesmo valor (bruto ou
 * líquido, em centavos) e data até 3 dias da data do pagamento; o mais próximo vence (empate: o primeiro da lista).
 * Cobrança não paga nunca liga. `usados` = créditos já ligados nesta rodada.
 */
export function creditoDaCobranca(c: CobrancaParaCredito, candidatos: CreditoCandidatoAsaas[], usados: Set<string>): string | null {
  if (!PAGAS.has(String(c.status ?? "").toUpperCase())) return null;
  const alvos = new Set([c.value, c.netValue].filter((v): v is number => v != null && Number.isFinite(v)).map((v) => Math.round(v * 100)));
  const ref = meioDia(c.paymentDate ?? c.dueDate).getTime();
  let melhor: { id: string; dist: number } | null = null;
  for (const k of candidatos) {
    if (usados.has(k.transacaoId) || !alvos.has(Math.round(Number(k.valor) * 100))) continue;
    const dia = (typeof k.data === "string" ? k.data : k.data.toISOString()).slice(0, 10);
    const dist = Math.abs(meioDia(dia).getTime() - ref) / 86400000;
    if (dist > 3) continue;
    if (!melhor || dist < melhor.dist) melhor = { id: k.transacaoId, dist };
  }
  return melhor?.id ?? null;
}
