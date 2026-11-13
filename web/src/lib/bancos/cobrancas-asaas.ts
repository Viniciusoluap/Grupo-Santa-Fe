import { prisma } from "@/lib/db";
import { fetchAsaasCobrancas } from "./asaas-extrato";
import { candidatosContaAzul } from "@/lib/bpo-conta-azul";
import { conciliarComContaAzul, receitaEmAbertoDoContaAzul } from "@/lib/financeiro/conta-azul";

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
  // Paridade BPO (13/11): receitas importadas do Conta Azul (carregadas só se precisar) e as já usadas nesta rodada.
  let receitasContaAzul: Awaited<ReturnType<typeof candidatosContaAzul>> | null = null;
  const usadasContaAzul = new Set<string>();
  for (const cobranca of cobrancas) {
    const paga = situacaoCobrancaAsaas(cobranca.status) === "pago";
    const credito = await prisma.transacaoBancaria.findFirst({
      where: { asaasPaymentId: cobranca.id, tipo: "credito" },
      select: { id: true, data: true, valor: true, lancamento: { select: { id: true, exclusaoLoteBackupId: true } } },
    });
    const existente = await prisma.bpoLancamento.findUnique({ where: { asaasPaymentId: cobranca.id } });
    const vencimento = new Date(`${cobranca.dueDate}T12:00:00Z`);
    const descricao = ["Cobrança Asaas", cobranca.customer, cobranca.description].filter(Boolean).join(" — ").slice(0, 500);
    if (existente?.exclusaoLoteBackupId || credito?.lancamento?.exclusaoLoteBackupId) continue;
    if (existente) {
      await prisma.bpoLancamento.update({ where: { id: existente.id, exclusaoLoteBackupId: null }, data: {
        pago: credito ? true : paga,
        pagoEm: credito?.data ?? (paga ? new Date(`${cobranca.paymentDate ?? cobranca.dueDate}T12:00:00Z`) : null),
        valor: credito?.valor ?? cobranca.value,
        vencimento,
        competencia: cobranca.dueDate.slice(0, 7),
        descricao,
        ...(credito && !existente.transacaoId ? { transacaoId: credito.id } : {}),
        // Paridade BPO (13/11): pago no Asaas = recebeu baixa, sai de "A classificar".
        ...(credito || paga ? { aClassificar: false } : {}),
      } });
      if (credito && !existente.transacaoId) await prisma.transacaoBancaria.updateMany({ where: { id: credito.id, aClassificar: true }, data: { aClassificar: false } });
      atualizadas++;
      continue;
    }
    if (credito?.lancamento) {
      await prisma.bpoLancamento.update({ where: { id: credito.lancamento.id, exclusaoLoteBackupId: null }, data: { asaasPaymentId: cobranca.id, descricao, pago: true } });
      reconciliadas++;
      continue;
    }
    // Paridade BPO (13/11): a mesma receita importada do backup do Conta Azul assume a cobrança (não duplica), sem mudar
    // o status dela: (a) cobrança paga ↔ receita JÁ PAGA (mesmo valor, até 3 dias da quitação); (b) cobrança em aberto ↔
    // receita EM ABERTO do mesmo cliente BPO, mesmo valor e vencimento a até 3 dias, candidata única. Paga ↔ em aberto
    // NÃO liga: a cobrança entra nova e a receita do Conta Azul continua em "A classificar". O crédito do extrato que
    // ficou "A classificar" com o id desta cobrança tem prioridade (o lançamento nasce ligado a ele, abaixo).
    if (!credito) {
      receitasContaAzul ??= await candidatosContaAzul(prisma, "receita", true);
      const livres = receitasContaAzul.filter((r) => !usadasContaAzul.has(r.id));
      const pagoEm = paga ? new Date(`${cobranca.paymentDate ?? cobranca.dueDate}T12:00:00Z`) : null;
      const doContaAzul = paga
        ? conciliarComContaAzul([{ id: "cobranca", tipo: "receita", valor: cobranca.value, data: pagoEm! }], livres).get("cobranca") ?? null
        // No Santa Fé a cobrança do Asaas não traz o cliente BPO: sem cliente, a regra (b) não liga (fica para o dono).
        : receitaEmAbertoDoContaAzul({ clienteId: null, valor: cobranca.value, vencimento }, livres);
      if (doContaAzul) {
        usadasContaAzul.add(doContaAzul);
        const r = await prisma.bpoLancamento.updateMany({ where: { id: doContaAzul, asaasPaymentId: null, pago: paga }, data: { asaasPaymentId: cobranca.id, aClassificar: false, version: { increment: 1 } } });
        if (r.count) { reconciliadas++; continue; }
      }
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
    // Paridade BPO (13/11): o crédito que chegou antes da cobrança e ficou "A classificar" agora tem o seu lançamento.
    if (credito) await prisma.transacaoBancaria.updateMany({ where: { id: credito.id, aClassificar: true }, data: { aClassificar: false } });
    criadas++;
  }
  return { recebidas: cobrancas.length, criadas, atualizadas, reconciliadas };
}
