import { prisma } from "@/lib/db";
import { calcularFinanceiroRegularizacao, progressoDasEtapas } from "@/lib/financeiro/regularizacao";

// EPIC-020 Lote 6 — etapas, tabela financeira e recebimentos de um processo,
// tudo calculado na leitura (mesma composição de `carregarProcesso` da Prospecta).
export async function carregarProcessoRegularizacao(regularizacaoId: string) {
  const [etapas, itens, recebimentos] = await Promise.all([
    prisma.regularizacaoEtapa.findMany({
      where: { regularizacaoId },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: { id: true, nome: true, progresso: true, observacoes: true },
    }),
    prisma.regularizacaoItemFinanceiro.findMany({ where: { regularizacaoId } }),
    prisma.regularizacaoRecebimento.findMany({
      where: { regularizacaoId },
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
      include: { bpoLancamento: { select: { descricao: true } } },
    }),
  ]);
  const financeiro = calcularFinanceiroRegularizacao(
    itens.map((i) => ({ id: i.id, nome: i.nome, grupo: i.grupo, ordem: i.ordem, previsto: i.previsto.toString() })),
    recebimentos.map((r) => ({ itemId: r.itemId, valor: r.valor.toString(), status: r.status })),
  );
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]));
  return {
    etapas,
    progressoEtapas: progressoDasEtapas(etapas),
    financeiro,
    itensComRecebimento: Array.from(new Set(recebimentos.map((r) => r.itemId))),
    recebimentos: recebimentos.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      item: nomeItem.get(r.itemId) ?? "",
      valor: r.valor.toString(),
      data: r.data.toISOString().slice(0, 10),
      observacao: r.observacao,
      origem: r.origem,
      status: r.status,
      motivoCancelamento: r.motivoCancelamento,
      bpoDescricao: r.bpoLancamento?.descricao ?? null,
    })),
  };
}
