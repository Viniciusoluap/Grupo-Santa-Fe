import { exigirModuloPagina } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { RegularizacaoClient } from "./_components/regularizacao-client";
import { indicadoresRegularizacao } from "@/lib/financeiro/indicadores-regularizacao";

export default async function RegularizacaoPage() {
  await exigirModuloPagina("regularizacao");

  const [regularizacoes, itens, recebimentos] = await Promise.all([
    prisma.regularizacao.findMany({ orderBy: { criadoEm: "desc" } }),
    prisma.regularizacaoItemFinanceiro.findMany({ select: {
      id: true, regularizacaoId: true, chavePadrao: true, nome: true, previsto: true,
    } }),
    prisma.regularizacaoRecebimento.findMany({ select: {
      id: true, regularizacaoId: true, itemId: true, valor: true, status: true,
    } }),
  ]);
  const indicadores = indicadoresRegularizacao(
    regularizacoes, itens.map(i => ({ ...i, previsto: i.previsto.toString() })),
    recebimentos.map(r => ({ ...r, valor: r.valor.toString() })),
  );
  const totais = new Map<string, number>();
  for (const item of itens) totais.set(item.regularizacaoId, (totais.get(item.regularizacaoId) ?? 0) + Number(item.previsto));
  const processos = regularizacoes.map((regularizacao) => ({ ...regularizacao, valorTotalGeral: totais.get(regularizacao.id) ?? 0 }));

  return <RegularizacaoClient regularizacoes={processos} indicadores={indicadores} />;
}
