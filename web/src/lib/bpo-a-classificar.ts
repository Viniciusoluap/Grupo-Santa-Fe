// Paridade BPO (13/11): aba "A classificar" do BPO Financeiro e "Dar baixa / dividir" (split).
// Gêmeo de Prospecta/server/bpo-a-classificar.ts (mesma regra; aqui com Prisma e ids texto).
// - Movimentações do banco sem correspondência segura (transacoes_bancarias."aClassificar"): o usuário cria o
//   lançamento (categoria, cliente BPO, centro de custo), marca como transferência interna/ignora, ou dá baixa/divide.
// - Lançamentos em aberto a classificar (bpo_lancamentos."aClassificar", ex.: em aberto do Conta Azul): o usuário
//   confirma (vão para Cobranças/Despesas), registra o pagamento ou cancela (arquivamento reversível no lote).
// Regras puras em src/lib/financeiro/bpo-a-classificar.ts.
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { TRANSFERENCIA_INTERNA, categoriaValida, ehDespesa } from "@/lib/bpo-categorias";
import { vincularTransacoesAoBpo } from "@/lib/bancos/lancamentos-bpo";
import { centavosDe, chaveAlocacao, resultadoDaBaixa, saldoEmCentavos, sugestoesDeBaixa, validarDivisao, type Alocacao } from "@/lib/financeiro/bpo-a-classificar";
import { normalizarNomeCentro } from "@/lib/financeiro/centros-custo";

const ABERTO_A_CLASSIFICAR = { aClassificar: true, exclusaoLoteBackupId: null, combinadaEmId: null } as const;

/** Quantos itens esperam o usuário (rótulo da aba). */
export async function contagemAClassificar() {
  const [movimentacoes, lancamentos] = await Promise.all([
    prisma.transacaoBancaria.count({ where: { aClassificar: true } }),
    prisma.bpoLancamento.count({ where: ABERTO_A_CLASSIFICAR }),
  ]);
  return { movimentacoes, lancamentos, total: movimentacoes + lancamentos };
}

/** Movimentações do banco "A classificar", com a conta. */
export async function movimentacoesAClassificar() {
  const linhas = await prisma.transacaoBancaria.findMany({
    where: { aClassificar: true },
    orderBy: [{ data: "desc" }, { id: "desc" }],
    select: {
      id: true, data: true, descricao: true, valor: true, tipo: true, categoria: true, titular: true, bpoClienteId: true, descricaoOriginal: true,
      conta: { select: { id: true, banco: true, conta: true } },
    },
  });
  return linhas.map(({ conta, ...m }) => ({ ...m, contaId: conta.id, conta: [conta.banco, conta.conta && conta.conta !== "—" ? conta.conta : null].filter(Boolean).join(" · ") }));
}

/** Lançamentos em aberto "A classificar" (fora de Cobranças, Despesas e DRE). */
export async function lancamentosAClassificar() {
  const linhas = await prisma.bpoLancamento.findMany({
    where: ABERTO_A_CLASSIFICAR,
    orderBy: [{ vencimento: "asc" }, { id: "asc" }],
    include: { cliente: { select: { razaoSocial: true } } },
  });
  return linhas.map(({ cliente, ...l }) => ({ ...l, clienteNome: cliente?.razaoSocial ?? l.clienteNomeLivre ?? null }));
}

/** Só as que ainda estão "A classificar" (a tela pode estar desatualizada). */
async function idsAClassificar(ids: string[]) {
  if (!ids.length) return [];
  const r = await prisma.transacaoBancaria.findMany({ where: { id: { in: ids }, aClassificar: true }, select: { id: true } });
  return r.map((x) => x.id);
}

/** Classificação explícita: grava a escolha na movimentação, tira de "A classificar" e gera o lançamento. */
async function classificarMovimentacoes(ids: string[], categoria: string, bpoClienteId?: string | null) {
  await prisma.transacaoBancaria.updateMany({
    where: { id: { in: ids }, aClassificar: true },
    data: { categoria, aClassificar: false, ...(bpoClienteId !== undefined ? { bpoClienteId } : {}) },
  });
  await vincularTransacoesAoBpo({ ids }, "classificada");
  if (bpoClienteId !== undefined) {
    // Lançamento já existente (ex.: Asaas/Conta Azul ligado) mantém o cliente dele; os do extrato acompanham a escolha.
    await prisma.bpoLancamento.updateMany({ where: { transacaoId: { in: ids }, origemEfetiva: "extrato", exclusaoLoteBackupId: null }, data: { clienteId: bpoClienteId } });
  }
}

/**
 * "Criar lançamento" (individual ou em lote): cria o lançamento pago de cada movimentação com a categoria e o
 * cliente escolhidos e tira de "A classificar".
 */
export async function criarLancamentosDasMovimentacoes(ids: string[], escolha: { categoria: string; bpoClienteId?: string | null; centroCustos?: string | null }) {
  if (escolha.categoria === TRANSFERENCIA_INTERNA) throw new Error("Use \"Transferência interna / ignorar\" para tirar a movimentação do BPO.");
  if (!categoriaValida(escolha.categoria)) throw new Error("Escolha uma categoria válida.");
  const alvo = await idsAClassificar(ids);
  if (!alvo.length) throw new Error("Nenhuma das movimentações está mais em A classificar. Atualize a tela.");
  if (escolha.bpoClienteId) {
    const c = await prisma.bpoCliente.findUnique({ where: { id: escolha.bpoClienteId }, select: { id: true } });
    if (!c) throw new Error("Cliente BPO não encontrado.");
  }
  await classificarMovimentacoes(alvo, escolha.categoria, escolha.bpoClienteId);
  if (escolha.centroCustos !== undefined) {
    // Só nos lançamentos criados do extrato (um lançamento do Conta Azul ligado mantém o centro de custo dele).
    await prisma.bpoLancamento.updateMany({
      where: { transacaoId: { in: alvo }, origemEfetiva: "extrato", exclusaoLoteBackupId: null },
      data: { centroCustos: normalizarNomeCentro(escolha.centroCustos) || null },
    });
  }
  return { classificadas: alvo.length };
}

/** "Transferência interna / ignorar": fora de "A classificar" e fora de listas, DRE e totais. */
export async function ignorarMovimentacoes(ids: string[]) {
  const alvo = await idsAClassificar(ids);
  if (!alvo.length) throw new Error("Nenhuma das movimentações está mais em A classificar. Atualize a tela.");
  await classificarMovimentacoes(alvo, TRANSFERENCIA_INTERNA);
  return { ignoradas: alvo.length };
}

/** "Confirmar": o lançamento sai de "A classificar" e entra em Cobranças/Despesas (em aberto), com histórico. */
export async function confirmarLancamentos(ids: string[], usuarioId: string | null) {
  if (!ids.length) throw new Error("Selecione ao menos um lançamento.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM bpo_lancamentos WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
    const linhas = await tx.bpoLancamento.findMany({ where: { id: { in: ids }, ...ABERTO_A_CLASSIFICAR }, orderBy: { id: "asc" } });
    for (const l of linhas) {
      const g = await tx.bpoLancamento.updateMany({ where: { id: l.id, version: l.version }, data: { aClassificar: false, version: { increment: 1 } } });
      if (!g.count) throw new Error("Um dos lançamentos foi alterado por outra pessoa. Atualize a tela.");
      const depois = await tx.bpoLancamento.findUniqueOrThrow({ where: { id: l.id } });
      await tx.bpoLancamentoHistorico.create({ data: {
        lancamentoId: l.id, lancamentoReferencia: l.id, versaoAnterior: l.version, alteradoPorUsuarioId: usuarioId,
        motivo: "Confirmado na aba A classificar", antesJson: JSON.stringify(l), depoisJson: JSON.stringify(depois),
      } });
    }
    return { confirmados: linhas.length };
  });
}

/** Em aberto que podem receber baixa da movimentação (mesmo sentido), com as sugestões (máx. 5) primeiro. */
export async function abertosParaBaixa(movimentacaoId: string) {
  const m = await prisma.transacaoBancaria.findUnique({ where: { id: movimentacaoId } });
  if (!m) throw new Error("Movimentação não encontrada.");
  const linhas = await prisma.bpoLancamento.findMany({
    where: {
      pago: false, exclusaoLoteBackupId: null, combinadaEmId: null, asaasPaymentId: null, transacaoId: null,
      ...(m.tipo === "debito" ? { tipo: { startsWith: "despesa" } } : { NOT: { tipo: { startsWith: "despesa" } } }),
    },
    orderBy: [{ vencimento: "asc" }, { id: "asc" }],
    take: 1000,
    include: { cliente: { select: { razaoSocial: true } } },
  });
  const abertos = linhas
    .filter((l) => saldoEmCentavos(l) > 0 && (m.tipo === "debito") === ehDespesa(l.tipo))
    .map(({ cliente, ...l }) => ({
      id: l.id, tipo: l.tipo, descricao: l.descricao, valor: l.valor, valorRecebido: l.valorRecebido, vencimento: l.vencimento,
      competencia: l.competencia, clienteId: l.clienteId, clienteNome: cliente?.razaoSocial ?? l.clienteNomeLivre ?? null,
      pago: l.pago, aClassificar: l.aClassificar, centroCustos: l.centroCustos,
    }));
  const sugeridos = sugestoesDeBaixa(m, abertos).map((l) => l.id);
  return { movimentacao: { id: m.id, data: m.data, descricao: m.descricao, valor: m.valor, tipo: m.tipo, titular: m.titular }, abertos, sugeridos };
}

// ── Dividir pagamentos (split) ────────────────────────────────────────────────────────────────────
// Reaproveita bpo_baixas (as baixas do Santa Fé): uma linha por alocação ("transacaoId" + requestKey
// "bt:<mov>:<lanc>"); o lançamento acumula valorRecebido e só fica pago quando recebido = valor. A movimentação
// não ganha lançamento próprio (o dinheiro já está nos lançamentos que ela quitou), então nada é somado duas vezes.
// Tudo numa transação, com FOR UPDATE na movimentação e nos lançamentos, e checagem de version.

const assinatura = (xs: { lancamentoId: string; valor: number }[]) =>
  xs.map((x) => `${x.lancamentoId}:${centavosDe(x.valor)}`).sort().join("|");

export type ResultadoBaixa = { movimentacaoId: string; repetida: boolean; alocacoes: { lancamentoId: string; valor: number; pago: boolean; saldo: number }[] };

/** Dá baixa (total ou parcial) em um ou vários lançamentos em aberto com uma movimentação do banco. Idempotente. */
export async function darBaixaComMovimentacao(input: { movimentacaoId: string; alocacoes: Alocacao[] }, usuarioId: string): Promise<ResultadoBaixa> {
  if (!Array.isArray(input.alocacoes)) throw new Error("Escolha ao menos um lançamento.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM transacoes_bancarias WHERE id = ${input.movimentacaoId} FOR UPDATE`;
    const m = await tx.transacaoBancaria.findUnique({ where: { id: input.movimentacaoId } });
    if (!m) throw new Error("Movimentação não encontrada.");
    const anteriores = await tx.bpoBaixa.findMany({ where: { transacaoId: m.id } });
    if (anteriores.length) {
      // Repetir a mesma chamada (duplo clique, retry) devolve o que já foi feito; outra divisão é recusada.
      if (assinatura(anteriores.map((r) => ({ lancamentoId: r.lancamentoId, valor: r.valor }))) !== assinatura(input.alocacoes)) {
        throw new Error("Esta movimentação já foi usada para dar baixa em outros lançamentos.");
      }
      const lancs = await tx.bpoLancamento.findMany({ where: { id: { in: anteriores.map((r) => r.lancamentoId) } } });
      const porId = new Map(lancs.map((l) => [l.id, l]));
      return {
        movimentacaoId: m.id, repetida: true,
        alocacoes: anteriores.map((r) => {
          const l = porId.get(r.lancamentoId);
          return { lancamentoId: r.lancamentoId, valor: r.valor, pago: Boolean(l?.pago), saldo: l ? (centavosDe(l.valor) - centavosDe(l.valorRecebido)) / 100 : 0 };
        }),
      };
    }
    if (!m.aClassificar) throw new Error("Esta movimentação não está em A classificar (já foi classificada ou conciliada). Atualize a tela.");
    const ligado = await tx.bpoLancamento.findUnique({ where: { transacaoId: m.id }, select: { id: true } });
    if (ligado) throw new Error("Esta movimentação já tem um lançamento próprio.");
    const ids = Array.from(new Set(input.alocacoes.map((a) => String(a.lancamentoId)))).sort();
    if (ids.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM bpo_lancamentos WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
    const lancs = ids.length ? await tx.bpoLancamento.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } }) : [];
    const erros = validarDivisao(m, input.alocacoes, lancs);
    if (erros.length) throw new Error(erros.join(" "));
    const porId = new Map(lancs.map((l) => [l.id, l]));
    const resultado: ResultadoBaixa["alocacoes"] = [];
    for (const a of input.alocacoes) {
      const l = porId.get(a.lancamentoId)!;
      const valor = Math.round(a.valor * 100) / 100;
      const r = resultadoDaBaixa(l, a.valor);
      await tx.bpoBaixa.create({ data: {
        lancamentoId: l.id, requestKey: chaveAlocacao(m.id, l.id), valor, data: m.data, usuarioId, transacaoId: m.id,
        motivo: `Baixa pela movimentação ${m.id} do banco (${m.descricao})`.slice(0, 500),
      } });
      const g = await tx.bpoLancamento.updateMany({
        where: { id: l.id, version: l.version, exclusaoLoteBackupId: null, combinadaEmId: null },
        data: { valorRecebido: Number(r.valorRecebido), pago: r.pago, pagoEm: r.pago ? m.data : null, version: { increment: 1 }, aClassificar: false },
      });
      if (!g.count) throw new Error("Um dos lançamentos foi alterado por outra pessoa. Atualize a tela.");
      const depois = await tx.bpoLancamento.findUniqueOrThrow({ where: { id: l.id } });
      await tx.bpoLancamentoHistorico.create({ data: {
        lancamentoId: l.id, lancamentoReferencia: l.id, versaoAnterior: l.version, alteradoPorUsuarioId: usuarioId,
        motivo: `${r.pago ? "Quitado" : "Baixa parcial"} pela movimentação ${m.id} do banco (${valor.toFixed(2)})`,
        antesJson: JSON.stringify(l), depoisJson: JSON.stringify(depois),
      } });
      resultado.push({ lancamentoId: l.id, valor, pago: r.pago, saldo: r.saldo });
    }
    await tx.transacaoBancaria.update({ where: { id: m.id }, data: { aClassificar: false, status: "conciliado" } });
    return { movimentacaoId: m.id, repetida: false, alocacoes: resultado };
  }, { timeout: 30_000 });
}
