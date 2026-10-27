import { prisma } from "@/lib/db";
import { fetchAsaasCobrancas } from "./asaas-extrato";

const PAGAS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const ABERTAS = new Set(["PENDING", "AWAITING_RISK_ANALYSIS", "AUTHORIZED"]);
const VENCIDAS = new Set(["OVERDUE", "DUNNING_REQUESTED"]);

export function situacaoCobrancaAsaas(status: string) {
  const valor = status.toUpperCase();
  if (PAGAS.has(valor)) return "pago" as const;
  if (VENCIDAS.has(valor)) return "vencido" as const;
  if (ABERTAS.has(valor)) return "aberto" as const;
  return null;
}

/** Sincroniza cobranças emitidas no Asaas sem duplicar o crédito do extrato. */
export async function sincronizarCobrancasAsaas(apiKey: string, desde: string, fetchImpl: typeof fetch = fetch) {
  const cobrancas = (await fetchAsaasCobrancas(apiKey, desde, fetchImpl)).filter((c) => situacaoCobrancaAsaas(c.status));
  let criadas = 0, atualizadas = 0, reconciliadas = 0;
  for (const cobranca of cobrancas) {
    const paga = situacaoCobrancaAsaas(cobranca.status) === "pago";
    const credito = await prisma.transacaoBancaria.findFirst({
      where: { asaasPaymentId: cobranca.id },
      select: { id: true, data: true, valor: true, lancamento: { select: { id: true } } },
    });
    const existente = await prisma.bpoLancamento.findUnique({ where: { asaasPaymentId: cobranca.id } });
    const vencimento = new Date(`${cobranca.dueDate}T12:00:00Z`);
    const descricao = ["Cobrança Asaas", cobranca.customer, cobranca.description].filter(Boolean).join(" — ").slice(0, 500);
    if (existente) {
      await prisma.bpoLancamento.update({ where: { id: existente.id }, data: {
        pago: credito ? true : paga,
        pagoEm: credito?.data ?? (paga ? new Date(`${cobranca.paymentDate ?? cobranca.dueDate}T12:00:00Z`) : null),
        valor: credito?.valor ?? cobranca.value,
        vencimento,
        competencia: cobranca.dueDate.slice(0, 7),
        descricao,
        ...(credito && !existente.transacaoId ? { transacaoId: credito.id } : {}),
      } });
      atualizadas++;
      continue;
    }
    if (credito?.lancamento) {
      await prisma.bpoLancamento.update({ where: { id: credito.lancamento.id }, data: { asaasPaymentId: cobranca.id, descricao, pago: true } });
      reconciliadas++;
      continue;
    }
    await prisma.bpoLancamento.create({ data: {
      asaasPaymentId: cobranca.id,
      origemEfetiva: "asaas",
      tipo: "recebimento",
      categoria: "Recebimento de cliente",
      descricao,
      valor: cobranca.value,
      vencimento,
      pago: paga,
      pagoEm: paga ? new Date(`${cobranca.paymentDate ?? cobranca.dueDate}T12:00:00Z`) : null,
      competencia: cobranca.dueDate.slice(0, 7),
      ...(credito ? { transacaoId: credito.id } : {}),
    } });
    criadas++;
  }
  return { recebidas: cobrancas.length, criadas, atualizadas, reconciliadas };
}
