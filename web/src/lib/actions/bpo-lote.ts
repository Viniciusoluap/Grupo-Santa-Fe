"use server";
// Lote 3, item 16 (29/10/2026): seleção em lote em Cobranças/Despesas — "Excluir", "Excluir tudo"
// (aba inteira, no servidor, com os filtros da tela) e "Combinar pagamentos". Protegidos (Asaas,
// extrato, baixa, obra, regularização, combinação) nunca são apagados; toda exclusão grava backup
// JSON (bpo_lancamento_exclusoes_backup) e histórico por lançamento, em transação. Só admin.
// Gêmeo da Prospecta: server/bpo-lote.ts.
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { exigirAdminAtivo, exigirModuloAcao } from "@/lib/auth/modulos";
import { TRANSFERENCIA_INTERNA, ehDespesa } from "@/lib/bpo-categorias";
import { CONFIRMACAO_EXCLUSAO, confirmacaoExclusaoValida, filtrarLancamentosLote, resumirExclusao, validarCombinacao, type FiltrosLote, type ResumoExclusao } from "@/lib/bpo-lote";

export type AbaLote = "cobrancas" | "despesas";
export type EntradaLote = { aba: AbaLote; modo: "selecionados" | "tudo"; ids?: string[]; filtros?: FiltrosLote };
type Tx = Prisma.TransactionClient | typeof prisma;

async function lancamentosDaAba(db: Tx, aba: AbaLote, ids?: string[]) {
  const linhas = await db.bpoLancamento.findMany({
    where: { combinadaEmId: null, OR: [{ categoria: null }, { categoria: { not: TRANSFERENCIA_INTERNA } }], ...(ids ? { id: { in: ids } } : {}) },
    include: {
      cliente: { select: { razaoSocial: true } },
      _count: { select: { baixas: true, movimentosObra: true, recebimentosRegularizacao: true } },
    },
  });
  const daAba = linhas.filter((l) => (aba === "despesas") === ehDespesa(l.tipo));
  const combinadas = daAba.length ? await db.bpoLancamento.groupBy({ by: ["combinadaEmId"], where: { combinadaEmId: { in: daAba.map((l) => l.id) } }, _count: { _all: true } }) : [];
  const filhos = new Map(combinadas.map((c) => [c.combinadaEmId!, c._count._all]));
  return daAba.map(({ _count, cliente, ...l }) => ({
    ...l,
    clienteNome: cliente?.razaoSocial ?? l.clienteNomeLivre ?? "—",
    transacaoBancaria: l.transacaoId,
    baixas: _count.baixas, movimentosObra: _count.movimentosObra, recebimentosRegularizacao: _count.recebimentosRegularizacao,
    combinadas: filhos.get(l.id) ?? 0,
  }));
}

async function alcance(db: Tx, input: EntradaLote) {
  const todos = await lancamentosDaAba(db, input.aba);
  const ids = new Set(input.ids ?? []);
  const base = input.modo === "tudo" ? filtrarLancamentosLote(todos, input.filtros ?? {}) : todos.filter((l) => ids.has(l.id));
  return resumirExclusao(todos.length, base, input.modo === "selecionados" ? ids.size : 0);
}

export async function previaExclusaoLote(input: EntradaLote): Promise<ResumoExclusao | { erro: string }> {
  try {
    await exigirAdminAtivo();
    return (await alcance(prisma, input)).resumo;
  } catch (e) { return { erro: e instanceof Error ? e.message : "Falha ao calcular a prévia." }; }
}

export async function excluirLancamentosEmLote(input: EntradaLote & { confirmacao: string }) {
  try {
    const admin = await exigirAdminAtivo();
    await exigirModuloAcao("bpo");
    if (!confirmacaoExclusaoValida(input.confirmacao)) return { erro: `Digite ${CONFIRMACAO_EXCLUSAO} para confirmar a exclusão.` };
    if (input.modo === "selecionados" && !(input.ids ?? []).length) return { erro: "Selecione ao menos um lançamento." };
    const r = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext('bpo_exclusao_lote'))`;
      const { resumo, excluiveis } = await alcance(tx, input);
      if (!excluiveis.length) return { ...resumo, excluidos: 0, backupId: null as string | null };
      const ids = excluiveis.map((l) => l.id);
      const backup = await tx.bpoLancamentoExclusaoBackup.create({ data: {
        modo: input.modo, aba: input.aba, filtrosJson: JSON.stringify(input.modo === "tudo" ? input.filtros ?? {} : { ids: input.ids }),
        quantidade: ids.length, protegidos: resumo.protegidos, snapshotJson: JSON.stringify(excluiveis), criadoPorUsuarioId: admin.id,
      } });
      await tx.bpoLancamentoHistorico.createMany({ data: excluiveis.map((l) => ({
        lancamentoId: l.id, lancamentoReferencia: l.id, versaoAnterior: l.version, alteradoPorUsuarioId: admin.id,
        motivo: `Excluído em lote (${input.modo === "tudo" ? "Excluir tudo" : "Excluir selecionados"}; backup ${backup.id})`,
        antesJson: JSON.stringify(l), depoisJson: JSON.stringify({ excluido: true, backupId: backup.id }),
      })) });
      // Revalida a proteção no próprio DELETE: se algo mudou desde a leitura, nada é apagado.
      const apagados = await tx.bpoLancamento.deleteMany({ where: {
        id: { in: ids }, asaasPaymentId: null, transacaoId: null, combinadaEmId: null, pago: false, valorRecebido: 0,
        baixas: { none: {} }, movimentosObra: { none: {} }, recebimentosRegularizacao: { none: {} },
      } });
      if (apagados.count !== ids.length) throw new Error("Algum lançamento mudou durante a confirmação. Atualize a prévia e tente novamente.");
      return { ...resumo, excluidos: apagados.count, backupId: backup.id };
    }, { timeout: 60000 });
    revalidatePath("/admin/bpo");
    return r;
  } catch (e) { return { erro: e instanceof Error ? e.message : "Falha ao excluir." }; }
}

async function cobrancasParaCombinar(db: Tx, ids: string[]) {
  return lancamentosDaAba(db, "cobrancas", ids);
}

export async function previaCombinacao(ids: string[]) {
  try {
    await exigirModuloAcao("bpo");
    const linhas = await cobrancasParaCombinar(prisma, ids);
    if (linhas.length !== ids.length) return { ok: false as const, erros: ["Alguma cobrança não está mais disponível (excluída, combinada ou é despesa)."], bloqueados: [] };
    const r = validarCombinacao(linhas);
    return r.ok ? { ...r, vencimento: r.vencimento.toISOString() } : r;
  } catch (e) { return { ok: false as const, erros: [e instanceof Error ? e.message : "Falha ao validar."], bloqueados: [] }; }
}

/** Cria a cobrança combinada e marca as originais (combinadaEmId), sem apagar nada. */
export async function combinarPagamentos(input: { ids: string[]; requestKey: string }) {
  try {
    const u = await exigirModuloAcao("bpo");
    if (!input.requestKey || input.requestKey.length > 120) return { erro: "Identificador do formulário inválido. Reabra a tela." };
    const r = await prisma.$transaction(async (tx) => {
      const linhas = await cobrancasParaCombinar(tx, input.ids);
      if (linhas.length !== input.ids.length) throw new Error("Alguma cobrança não está mais disponível (excluída, combinada ou é despesa).");
      const v = validarCombinacao(linhas);
      if (!v.ok) throw new Error([...v.erros, ...v.bloqueados.map((b) => `#${b.id}: ${b.motivo}`)].join(" "));
      const nova = await tx.bpoLancamento.create({ data: {
        requestKey: input.requestKey, clienteId: v.clienteId as string | null, clienteNomeLivre: v.clienteNomeLivre,
        tipo: v.tipo, descricao: v.descricao, valor: v.total, vencimento: v.vencimento, competencia: v.competencia,
        categoria: v.categoria, categoriaContabil: v.categoria, categoriaOperacional: v.categoriaOperacional,
        vinculoOperacionalId: v.vinculoOperacionalId, vinculoOperacionalRotulo: v.vinculoOperacionalId ? linhas[0].vinculoOperacionalRotulo : null,
        origemEfetiva: "manual",
      } });
      for (const o of linhas) {
        const g = await tx.bpoLancamento.updateMany({ where: { id: o.id, version: o.version, combinadaEmId: null }, data: { combinadaEmId: nova.id, version: { increment: 1 } } });
        if (!g.count) throw new Error("Uma das cobranças foi alterada por outra pessoa. Atualize a tela.");
        const depois = await tx.bpoLancamento.findUniqueOrThrow({ where: { id: o.id } });
        await tx.bpoLancamentoHistorico.create({ data: { lancamentoId: o.id, lancamentoReferencia: o.id, versaoAnterior: o.version, alteradoPorUsuarioId: u.id, motivo: `Combinada na cobrança ${nova.id} (combinar pagamentos)`, antesJson: JSON.stringify(o), depoisJson: JSON.stringify(depois) } });
      }
      return { novaId: nova.id, total: v.total, combinadas: linhas.length };
    });
    revalidatePath("/admin/bpo");
    return r;
  } catch (e) { return { erro: e instanceof Error ? e.message : "Falha ao combinar." }; }
}
