import { prisma } from "@/lib/db";
import { fetchAsaasCobrancas } from "./asaas-extrato";
import { candidatosContaAzul } from "@/lib/bpo-conta-azul";
import { conciliarComContaAzul, receitaEmAbertoDoContaAzul } from "@/lib/financeiro/conta-azul";
import { creditoDaCobranca, type CreditoCandidatoAsaas } from "@/lib/financeiro/bpo-asaas";

/**
 * Paridade 17/11 (bloco 3): créditos do extrato do Asaas SEM id de pagamento que ainda podem ser de uma cobrança —
 * com lançamento ativo que não tem cobrança (o crédito vira a cobrança) ou parados em "A classificar" sem lançamento
 * (o lançamento nasce ligado ao crédito). Fora: arquivados, combinados e créditos já usados numa divisão de pagamentos.
 * Mesma seleção de Prospecta/server/bpo-asaas.ts (lá também os créditos A classificar desde 12/11).
 */
async function creditosAsaasSemCobranca(): Promise<(CreditoCandidatoAsaas & { lancamentoId: string | null })[]> {
  const linhas = await prisma.transacaoBancaria.findMany({
    where: {
      tipo: "credito", asaasPaymentId: null, conta: { provedor: "asaas" },
      OR: [
        { lancamento: { asaasPaymentId: null, exclusaoLoteBackupId: null, combinadaEmId: null } },
        { aClassificar: true, lancamento: null, baixas: { none: {} } },
      ],
    },
    select: { id: true, valor: true, data: true, lancamento: { select: { id: true } } },
    orderBy: [{ data: "asc" }, { id: "asc" }],
  });
  return linhas.map((t) => ({ transacaoId: t.id, valor: t.valor, data: t.data, lancamentoId: t.lancamento?.id ?? null }));
}

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
  // Paridade 17/11 (bloco 3): créditos do Asaas sem id de pagamento (carregados só se houver cobrança paga sem crédito).
  let candidatosAsaas: Awaited<ReturnType<typeof creditosAsaasSemCobranca>> | null = null;
  const usadosAsaas = new Set<string>();
  for (const cobranca of cobrancas) {
    const paga = situacaoCobrancaAsaas(cobranca.status) === "pago";
    const credito = await prisma.transacaoBancaria.findFirst({
      where: { asaasPaymentId: cobranca.id, tipo: "credito" },
      select: { id: true, data: true, valor: true, aClassificar: true, lancamento: { select: { id: true, exclusaoLoteBackupId: true } } },
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
    // Paridade 17/11 (bloco 3, Prospecta): crédito com o id desta cobrança, sem lançamento e fora de "A classificar" =
    // marcado como transferência interna (não gera lançamento) ou já usado numa divisão de pagamentos: não vira receita.
    if (credito && !credito.lancamento && !credito.aClassificar) continue;
    // Paridade 17/11 (bloco 3, Prospecta): cobrança PAGA sem crédito com o id dela no extrato → o crédito do Asaas sem id
    // de pagamento, de mesmo valor (bruto ou líquido) e data até 3 dias, é o mesmo dinheiro: liga, não duplica.
    if (!credito && paga) {
      candidatosAsaas ??= await creditosAsaasSemCobranca();
      const alvoId = creditoDaCobranca(cobranca, candidatosAsaas, usadosAsaas);
      const alvo = alvoId ? candidatosAsaas.find((k) => k.transacaoId === alvoId) : undefined;
      if (alvo) {
        usadosAsaas.add(alvo.transacaoId);
        const ok = await prisma.$transaction(async (tx) => {
          // O extrato passa a levar o id do pagamento (a próxima sincronização acha pelo id, como sempre).
          const marcou = await tx.transacaoBancaria.updateMany({ where: { id: alvo.transacaoId, asaasPaymentId: null }, data: { asaasPaymentId: cobranca.id } });
          if (!marcou.count) return false;
          if (alvo.lancamentoId) {
            // O lançamento do crédito vira a cobrança (mesmo caminho do crédito com id, acima): valor e data ficam os do banco.
            const r = await tx.bpoLancamento.updateMany({ where: { id: alvo.lancamentoId, asaasPaymentId: null, exclusaoLoteBackupId: null, combinadaEmId: null }, data: { asaasPaymentId: cobranca.id, descricao, pago: true, aClassificar: false, version: { increment: 1 } } });
            if (!r.count) throw new Error("conflito");
            return true;
          }
          // Crédito que ficou "A classificar": o lançamento nasce ligado a ele, com o valor e a data do dinheiro que entrou.
          await tx.bpoLancamento.create({ data: {
            asaasPaymentId: cobranca.id, origemEfetiva: "asaas", tipo: "recebimento", categoria: "Recebimento de cliente", descricao,
            valor: alvo.valor, vencimento, pago: true, pagoEm: new Date(alvo.data), competencia: cobranca.dueDate.slice(0, 7), transacaoId: alvo.transacaoId,
          } });
          await tx.transacaoBancaria.update({ where: { id: alvo.transacaoId }, data: { aClassificar: false } });
          return true;
        }).catch(() => false);
        if (ok) { reconciliadas++; continue; }
      }
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
