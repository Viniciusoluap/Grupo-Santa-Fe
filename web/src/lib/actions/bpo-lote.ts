"use server";
// Lote 3, item 16 (29/10/2026): seleção em lote em Cobranças/Despesas — "Excluir", "Excluir tudo"
// (aba inteira, no servidor, com os filtros da tela) e "Combinar pagamentos". Protegidos (Asaas,
// extrato, baixa, obra, regularização, combinação) nunca são apagados; toda exclusão grava backup
// JSON (bpo_lancamento_exclusoes_backup) e histórico por lançamento, em transação. Só admin.
// Gêmeo da Prospecta: server/bpo-lote.ts.
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { exigirAdminAtivo, exigirModuloAcao } from "@/lib/auth/modulos";
import { TRANSFERENCIA_INTERNA, ehDespesa } from "@/lib/bpo-categorias";
import { catalogoOperacionalBpo } from "@/lib/bpo-catalogo";
import { CONFIRMACAO_RESTAURACAO, confirmacaoRestauracaoValida, lerSnapshot, planejarRestauracao, type PlanoRestauracao } from "@/lib/bpo-restauracao";
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

// ─── Lote 4 (30/10/2026): "Restaurar" exclusões em lote (gêmeo da Prospecta server/bpo-restauracao.ts) ───

const COLUNAS_LANCAMENTO = Object.values(Prisma.BpoLancamentoScalarFieldEnum) as string[];
const COLUNAS_DATA_LANCAMENTO = ["vencimento", "pagoEm", "criadoEm", "atualizadoEm"];
const COLUNAS_UNICAS = ["requestKey", "origemTransacaoKey"] as const;

export type ExclusaoEmLoteResumo = {
  id: string; criadoEm: string; modo: string; aba: string; quantidade: number; protegidos: number;
  usuario: string | null; restauradoEm: string | null; restauradoPor: string | null;
  restauracao: { restaurados: number; jaExistiam: number; comAviso: number } | null;
};

async function nomesDeUsuarios(ids: (string | null)[]) {
  const unicos = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const us = unicos.length ? await prisma.usuario.findMany({ where: { id: { in: unicos } }, select: { id: true, nome: true } }) : [];
  return new Map(us.map((u) => [u.id, u.nome]));
}

/** Lista das exclusões em lote (data, usuário, aba, quantidade, se já foi restaurada). Só admin. */
export async function listarExclusoesEmLote(): Promise<ExclusaoEmLoteResumo[] | { erro: string }> {
  try {
    await exigirAdminAtivo();
    const bs = await prisma.bpoLancamentoExclusaoBackup.findMany({ orderBy: { criadoEm: "desc" }, take: 100, omit: { snapshotJson: true } });
    const nomes = await nomesDeUsuarios(bs.flatMap((b) => [b.criadoPorUsuarioId, b.restauradoPorUsuarioId]));
    return bs.map((b) => {
      let restauracao: ExclusaoEmLoteResumo["restauracao"] = null;
      try { restauracao = b.restauracaoJson ? JSON.parse(b.restauracaoJson) : null; } catch { restauracao = null; }
      return {
        id: b.id, criadoEm: b.criadoEm.toISOString(), modo: b.modo, aba: b.aba, quantidade: b.quantidade, protegidos: b.protegidos,
        usuario: b.criadoPorUsuarioId ? nomes.get(b.criadoPorUsuarioId) ?? "usuário removido" : null,
        restauradoEm: b.restauradoEm?.toISOString() ?? null,
        restauradoPor: b.restauradoPorUsuarioId ? nomes.get(b.restauradoPorUsuarioId) ?? "usuário removido" : null,
        restauracao,
      };
    });
  } catch (e) { return { erro: e instanceof Error ? e.message : "Falha ao listar as exclusões." }; }
}

async function planoDoBackup(db: Tx, snapshotJson: string): Promise<PlanoRestauracao> {
  const snapshot = lerSnapshot(snapshotJson);
  const ids = snapshot.map((s) => String(s.id));
  const clienteIds = Array.from(new Set(snapshot.map((s) => s.clienteId).filter((x) => x != null).map(String)));
  const existentes = ids.length ? await db.bpoLancamento.findMany({ where: { id: { in: ids } }, select: { id: true } }) : [];
  const clientes = clienteIds.length ? await db.bpoCliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true } }) : [];
  const unicosEmUso: Record<string, Set<string>> = {};
  for (const coluna of COLUNAS_UNICAS) {
    const valores = Array.from(new Set(snapshot.map((s) => s[coluna]).filter((x): x is string => typeof x === "string" && !!x)));
    const usados = valores.length
      ? await db.bpoLancamento.findMany({ where: { [coluna]: { in: valores }, id: { notIn: ids } }, select: { [coluna]: true } as Record<string, true> })
      : [];
    unicosEmUso[coluna] = new Set(usados.map((u) => String((u as Record<string, unknown>)[coluna])));
  }
  const precisaCatalogo = snapshot.some((s) => s.vinculoOperacionalId);
  const catalogo = precisaCatalogo ? await catalogoOperacionalBpo() : null;
  return planejarRestauracao(snapshot, {
    idsExistentes: new Set(existentes.map((e) => e.id)),
    clientesExistentes: new Set(clientes.map((c) => c.id)),
    vinculoExiste: (tipo, categoria, id) => {
      const chave = tipo === "despesa" && categoria === "comissoes" ? "imoveis" : categoria;
      return !!catalogo?.[chave]?.some((r) => r.id === id);
    },
    unicosEmUso,
  }, COLUNAS_LANCAMENTO, COLUNAS_DATA_LANCAMENTO);
}

/** Prévia: o que volta, o que já existe (não duplica) e os avisos de vínculos que sumiram. Só admin. */
export async function previaRestauracaoExclusao(backupId: string) {
  try {
    await exigirAdminAtivo();
    const b = await prisma.bpoLancamentoExclusaoBackup.findUnique({ where: { id: backupId } });
    if (!b) return { erro: "Exclusão em lote não encontrada." };
    const plano = await planoDoBackup(prisma, b.snapshotJson);
    return {
      backupId: b.id, aba: b.aba, criadoEm: b.criadoEm.toISOString(), restauradoEm: b.restauradoEm?.toISOString() ?? null,
      restaurar: plano.restaurar, jaExistem: plano.jaExistem, comAviso: plano.comAviso,
      itens: plano.itens.map(({ dados: _dados, ...i }) => i),
    };
  } catch (e) { return { erro: e instanceof Error ? e.message : "Falha ao calcular a prévia." }; }
}

/**
 * Restaura, em transação, os lançamentos de uma exclusão em lote. Uma vez só por backup
 * (restauradoEm/restauradoPorUsuarioId); não recria lançamento que já existe; vínculo externo que
 * não existe mais volta vazio (com aviso). Grava histórico por lançamento. Só admin.
 */
export async function restaurarExclusaoEmLote(input: { backupId: string; confirmacao: string }) {
  try {
    const admin = await exigirAdminAtivo();
    await exigirModuloAcao("bpo");
    if (!confirmacaoRestauracaoValida(input.confirmacao)) return { erro: `Digite ${CONFIRMACAO_RESTAURACAO} para confirmar a restauração.` };
    const r = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext('bpo_exclusao_lote'))`;
      const b = await tx.bpoLancamentoExclusaoBackup.findUnique({ where: { id: input.backupId } });
      if (!b) throw new Error("Exclusão em lote não encontrada.");
      if (b.restauradoEm) throw new Error(`Esta exclusão já foi restaurada em ${b.restauradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
      const plano = await planoDoBackup(tx, b.snapshotJson);
      const avisos: string[] = [];
      for (const item of plano.itens) {
        if (item.acao !== "restaurar") continue;
        const versaoAnterior = Number(item.dados.version ?? 1) || 1;
        const dados = { ...item.dados, version: versaoAnterior + 1 } as Prisma.BpoLancamentoUncheckedCreateInput;
        await tx.bpoLancamento.create({ data: dados });
        await tx.bpoLancamentoHistorico.create({ data: {
          lancamentoId: item.id, lancamentoReferencia: item.id, versaoAnterior, alteradoPorUsuarioId: admin.id,
          motivo: `Restaurado da exclusão em lote (backup ${b.id})${item.avisos.length ? ` — ${item.avisos.join(" ")}` : ""}`,
          antesJson: JSON.stringify({ excluido: true, backupId: b.id }), depoisJson: JSON.stringify(dados),
        } });
        for (const a of item.avisos) avisos.push(`${item.descricao || item.id}: ${a}`);
      }
      const resumo = { restaurados: plano.restaurar, jaExistiam: plano.jaExistem, comAviso: plano.comAviso };
      const marcado = await tx.bpoLancamentoExclusaoBackup.updateMany({
        where: { id: b.id, restauradoEm: null },
        data: { restauradoEm: new Date(), restauradoPorUsuarioId: admin.id, restauracaoJson: JSON.stringify(resumo) },
      });
      if (marcado.count !== 1) throw new Error("Esta exclusão já foi restaurada por outra pessoa. Atualize a tela.");
      return { ...resumo, avisos };
    }, { timeout: 60000 });
    revalidatePath("/admin/bpo");
    return r;
  } catch (e) { return { erro: e instanceof Error ? e.message : "Falha ao restaurar." }; }
}
