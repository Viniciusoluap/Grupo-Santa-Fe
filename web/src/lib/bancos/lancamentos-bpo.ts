// LOTE C (25/10, paridade Prospecta): cada movimentação bancária (importada ou sincronizada) gera
// um lançamento PAGO em bpo_lancamentos, vínculo 1:1 (transacaoId único) e sem duplicar:
// crédito → receita (Cobranças), débito → despesa (Despesas); data/competência = data do banco.
// Também classifica (categoria + cliente BPO) e mantém o saldo das contas por importação.
import { prisma } from "@/lib/db";
import { categoriaValida, descricaoComTitular, normalizarTitular, sugerirCategoria, tipoLancamentoDaTransacao } from "@/lib/bpo-categorias";
import type { SaldoExtrato } from "@/lib/extrato-import";

const LOTE = 500;

/**
 * Cria os lançamentos que faltam (idempotente). Sem filtro: todas as movimentações (backfill).
 * Categoria vazia ou fora da lista padrão (ex.: categoria da Pluggy/Asaas) recebe a sugestão.
 */
export async function vincularTransacoesAoBpo(filtro: { contaId?: string; ids?: string[] } = {}) {
  let criados = 0, categorizadas = 0;
  for (;;) {
    const lote = await prisma.transacaoBancaria.findMany({
      where: {
        lancamento: { is: null },
        ...(filtro.contaId ? { contaId: filtro.contaId } : {}),
        ...(filtro.ids ? { id: { in: filtro.ids } } : {}),
      },
      orderBy: { id: "asc" },
      take: LOTE,
      select: { id: true, data: true, descricao: true, descricaoOriginal: true, titular: true, valor: true, tipo: true, categoria: true, bpoClienteId: true },
    });
    if (!lote.length) break;

    const regras = await prisma.bpoRegraTitular.findMany();
    const porTitular = new Map(regras.map((regra) => [regra.titularNormalizado, regra]));
    const clientes = await prisma.bpoCliente.findMany({ select: { id: true, razaoSocial: true, lead: { select: { nome: true } } } });
    const clientePorNome = new Map<string, string[]>();
    for (const cliente of clientes) for (const nome of [cliente.razaoSocial, cliente.lead?.nome]) {
      const chave = normalizarTitular(nome);
      if (chave) clientePorNome.set(chave, [...(clientePorNome.get(chave) ?? []), cliente.id]);
    }
    const comCategoria = lote.map((t) => {
      const chave = normalizarTitular(t.titular);
      const regra = chave ? porTitular.get(chave) : null;
      const candidatos = chave ? [...new Set(clientePorNome.get(chave) ?? [])] : [];
      return {
        ...t,
        categoriaFinal: categoriaValida(regra?.categoria) ? regra.categoria : categoriaValida(t.categoria) ? t.categoria : sugerirCategoria(t.descricao, t.tipo, t.categoria),
        clienteFinal: regra?.bpoClienteId ?? t.bpoClienteId ?? (candidatos.length === 1 ? candidatos[0] : null),
      };
    });
    const porCategoria = new Map<string, string[]>();
    for (const t of comCategoria) {
      if (t.categoria === t.categoriaFinal) continue;
      porCategoria.set(t.categoriaFinal, [...(porCategoria.get(t.categoriaFinal) ?? []), t.id]);
    }
    for (const [categoria, ids] of porCategoria) {
      const r = await prisma.transacaoBancaria.updateMany({ where: { id: { in: ids } }, data: { categoria } });
      categorizadas += r.count;
    }

    const r = await prisma.bpoLancamento.createMany({
      data: comCategoria.map((t) => ({
        transacaoId: t.id,
        tipo: tipoLancamentoDaTransacao(t.tipo),
        descricao: descricaoComTitular([t.descricao, t.titular, t.descricaoOriginal]),
        valor: t.valor,
        vencimento: t.data,
        pago: true,
        pagoEm: t.data,
        competencia: t.data.toISOString().slice(0, 7),
        categoria: t.categoriaFinal,
        clienteId: t.clienteFinal,
      })),
      skipDuplicates: true,
    });
    criados += r.count;
    // Concorrência: se outro processo vinculou este lote, não há o que fazer aqui.
    if (r.count === 0 || lote.length < LOTE) break;
  }
  return { criados, categorizadas };
}

/**
 * Saldo das contas alimentadas por importação: saldo informado pelo extrato (o mais recente) +
 * movimentações posteriores à data dele; sem saldo no arquivo, a soma das movimentações.
 * Contas por API (Asaas/Pluggy) usam o saldo devolvido pelo provedor na sincronização.
 */
export async function recalcularSaldoConta(contaId: string, saldoArquivo?: SaldoExtrato | null) {
  const conta = await prisma.contaBancaria.findUnique({
    where: { id: contaId },
    select: { id: true, provedor: true, saldoExtrato: true, saldoExtratoData: true },
  });
  if (!conta) return null;
  let saldoExtrato = conta.saldoExtrato;
  let saldoData = conta.saldoExtratoData ? conta.saldoExtratoData.toISOString().slice(0, 10) : null;
  if (saldoArquivo && Number.isFinite(saldoArquivo.valor)) {
    const maisNovo = saldoExtrato === null || !saldoData || !saldoArquivo.data || saldoArquivo.data >= saldoData;
    if (maisNovo) { saldoExtrato = saldoArquivo.valor; saldoData = saldoArquivo.data; }
  }
  if (conta.provedor !== "manual") {
    if (saldoExtrato !== conta.saldoExtrato) {
      await prisma.contaBancaria.update({ where: { id: conta.id }, data: { saldoExtrato, saldoExtratoData: saldoData ? new Date(`${saldoData}T00:00:00Z`) : null } });
    }
    return null;
  }
  let saldo: number;
  if (saldoExtrato !== null) {
    if (!saldoData) saldo = saldoExtrato;
    else {
      const depois = new Date(`${saldoData}T00:00:00Z`);
      depois.setUTCDate(depois.getUTCDate() + 1);
      const g = await prisma.transacaoBancaria.groupBy({ by: ["tipo"], where: { contaId, data: { gte: depois } }, _sum: { valor: true } });
      saldo = saldoExtrato + somaAssinada(g);
    }
  } else {
    const g = await prisma.transacaoBancaria.groupBy({ by: ["tipo"], where: { contaId }, _sum: { valor: true } });
    saldo = somaAssinada(g);
  }
  saldo = Math.round(saldo * 100) / 100;
  await prisma.contaBancaria.update({
    where: { id: conta.id },
    data: { saldoAtual: saldo, saldoExtrato, saldoExtratoData: saldoData ? new Date(`${saldoData}T00:00:00Z`) : null },
  });
  return saldo;
}

function somaAssinada(g: { tipo: string; _sum: { valor: number | null } }[]) {
  return g.reduce((s, x) => s + (x.tipo === "credito" ? 1 : -1) * (x._sum.valor ?? 0), 0);
}

/** Backfill / botão "Reprocessar movimentações": vincula o que falta e recalcula os saldos. */
export async function reprocessarMovimentacoes() {
  const r = await vincularTransacoesAoBpo();
  const contas = await prisma.contaBancaria.findMany({ where: { provedor: "manual" }, select: { id: true } });
  for (const c of contas) await recalcularSaldoConta(c.id);
  return { ...r, contasRecalculadas: contas.length };
}

/** Categoria e cliente BPO de uma movimentação, refletidos no lançamento vinculado. */
export async function classificarTransacao(id: string, input: { categoria?: string; clienteId?: string | null }) {
  const t = await prisma.transacaoBancaria.findUnique({ where: { id }, select: { id: true, titular: true } });
  if (!t) throw new Error("Movimentação não encontrada.");
  if (input.categoria !== undefined && !categoriaValida(input.categoria)) throw new Error("Categoria inválida.");
  const clienteId = input.clienteId === undefined ? undefined : input.clienteId || null;
  if (clienteId) {
    const c = await prisma.bpoCliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!c) throw new Error("Cliente BPO não encontrado.");
  }
  await prisma.transacaoBancaria.update({ where: { id }, data: {
    ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
    ...(clienteId !== undefined ? { bpoClienteId: clienteId } : {}),
  } });
  await vincularTransacoesAoBpo({ ids: [id] });
  await prisma.bpoLancamento.update({
    where: { transacaoId: id },
    data: {
      ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
      ...(clienteId !== undefined ? { clienteId } : {}),
    },
  });
  const titularNormalizado = normalizarTitular(t.titular);
  if (titularNormalizado) {
    await prisma.bpoRegraTitular.upsert({
      where: { titularNormalizado },
      create: { titularNormalizado, categoria: input.categoria, bpoClienteId: clienteId },
      update: {
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(clienteId !== undefined ? { bpoClienteId: clienteId } : {}),
      },
    });
    const iguais = (await prisma.transacaoBancaria.findMany({ where: { titular: { not: null } }, select: { id: true, titular: true } }))
      .filter((mov) => normalizarTitular(mov.titular) === titularNormalizado).map((mov) => mov.id);
    if (iguais.length) {
      await prisma.transacaoBancaria.updateMany({ where: { id: { in: iguais } }, data: {
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(clienteId !== undefined ? { bpoClienteId: clienteId } : {}),
      } });
      await prisma.bpoLancamento.updateMany({ where: { transacaoId: { in: iguais } }, data: {
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(clienteId !== undefined ? { clienteId } : {}),
      } });
    }
  }
  return { ok: true };
}
