export const dynamic = "force-dynamic";

import { exigirModuloPagina } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { dataIsoDaConta, statusPluggy } from "@/lib/bancos";
import { TRANSFERENCIA_INTERNA } from "@/lib/bpo-categorias";
import { dreUltimos12Meses, montarDre, resumoContabil } from "@/lib/financeiro/bpo-resultado";
import { BpoClient } from "./_components/bpo-client";

const PIE_COLORS = ["#F5C400", "#1A1A1A", "#6B7280", "#D1D5DB", "#4B5563", "#9CA3AF", "#374151", "#E5E7EB"];

export default async function BpoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await exigirModuloPagina("bpo");

  const [
    lancamentos,
    todosLancamentos,
    clientes,
    leads,
    contasRaw,
    totalImoveis,
    totalLeads,
    leadsPorStatus,
    comissoesPagas,
    imoveisPorTipo,
    totalFinanciamentos,
    corretores,
    pluggy,
  ] = await Promise.all([
    // LOTE C: o extrato gera lançamentos; transferência interna não aparece em Cobranças/Despesas.
    prisma.bpoLancamento.findMany({
      where: { OR: [{ categoria: null }, { categoria: { not: TRANSFERENCIA_INTERNA } }] },
      orderBy: { vencimento: "desc" },
      take: 2000,
      include: { cliente: { select: { razaoSocial: true } } },
    }),
    // DRE, Contabilidade e Relatórios somam todos os lançamentos (sem o limite da lista).
    prisma.bpoLancamento.findMany({ select: { tipo: true, valor: true, competencia: true, pago: true, categoria: true } }),
    prisma.bpoCliente.findMany({
      where: { status: "ativo" },
      select: { id: true, razaoSocial: true },
      orderBy: { razaoSocial: "asc" },
    }),
    prisma.lead.findMany({
      select: { id: true, nome: true, telefone: true, email: true },
      orderBy: { nome: "asc" },
      take: 300,
    }),
    prisma.contaBancaria.findMany({
      where: { ativo: true },
      orderBy: { criadoEm: "desc" },
      include: { transacoes: { orderBy: { data: "desc" }, take: 30 } },
    }),
    prisma.imovel.count(),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.comissao.findMany({ where: { status: "paga" }, orderBy: { pagamentoEm: "asc" }, take: 500 }),
    prisma.imovel.groupBy({ by: ["tipo"], _count: { id: true } }),
    prisma.financiamento.count(),
    prisma.corretor.findMany({
      where: { ativo: true },
      include: { comissoes: { where: { status: "paga" } } },
      take: 10,
    }),
    statusPluggy(),
  ]);
  // Pedido de 25/10: a notificação de movimentações novas abre direto a aba de bancos.
  const { aba } = await searchParams;

  // Build monthly commissions data (last 12 months)
  const now = new Date();
  const monthlySales: { month: string; receita: number; vendas: number; leads: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(". ", "/");
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const comissoesMes = comissoesPagas.filter(
      (c) => c.pagamentoEm && c.pagamentoEm >= monthStart && c.pagamentoEm <= monthEnd
    );
    monthlySales.push({
      month: label,
      receita: comissoesMes.reduce((s, c) => s + c.valor, 0),
      vendas: comissoesMes.length,
      leads: 0,
    });
  }

  const propertyTypeData = imoveisPorTipo.map((g, idx) => ({
    name: g.tipo.charAt(0).toUpperCase() + g.tipo.slice(1),
    value: g._count.id,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  const totalLeadsCount = totalLeads || 1;
  const statusMap: Record<string, string> = {
    novo: "Captados", contato: "Em Contato", visita: "Visitas",
    proposta: "Proposta", fechado: "Fechados", perdido: "Perdidos",
  };
  const leadFunnelData = leadsPorStatus.map((s) => ({
    stage: statusMap[s.status] ?? s.status,
    count: s._count.id,
    pct: Math.round((s._count.id / totalLeadsCount) * 100),
  }));

  const corretorRanking = corretores
    .map((c) => ({
      name: c.nome,
      comissoes: c.comissoes.reduce((s, com) => s + com.valor, 0),
      vendas: c.comissoes.length,
    }))
    .sort((a, b) => b.comissoes - a.comissoes)
    .slice(0, 5);

  const serviceRevenue = [
    { service: "Corretagem", receita: comissoesPagas.reduce((s, c) => s + c.valor, 0) },
  ];

  const anoAtual = String(now.getFullYear());
  const dre = montarDre(todosLancamentos);
  const contabilidade = { ano: anoAtual, ...resumoContabil(todosLancamentos, `${anoAtual}-01`, `${anoAtual}-12`) };

  const relatoriosData = {
    dreMensal: dreUltimos12Meses(todosLancamentos, now),
    totalImoveis,
    totalLeads,
    totalFinanciamentos,
    monthlySales,
    propertyTypeData,
    leadFunnelData,
    corretorRanking,
    serviceRevenue,
  };

  const mapped = lancamentos.map((l) => ({
    id: l.id,
    clienteId: l.clienteId,
    clienteNome: l.cliente?.razaoSocial ?? l.clienteNomeLivre ?? "—",
    clienteNomeLivre: l.clienteNomeLivre,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    vencimento: l.vencimento.toISOString(),
    pago: l.pago,
    pagoEm: l.pagoEm?.toISOString() ?? null,
    competencia: l.competencia,
    centroCustos: l.centroCustos,
    categoria: l.categoria,
    doExtrato: Boolean(l.transacaoId),
  }));

  const contas = contasRaw.map((c) => ({
    id: c.id,
    banco: c.banco,
    agencia: c.agencia,
    conta: c.conta,
    tipo: c.tipo,
    descricao: c.descricao,
    saldoAtual: c.saldoAtual,
    ativo: c.ativo,
    pluggyItemId: c.pluggyItemId,
    pluggyAccountId: c.pluggyAccountId,
    webhookUrl: c.webhookUrl,
    ultimaSincronizacao: c.ultimaSincronizacao?.toISOString() ?? null,
    // Pedido de 25/10: provedor, data inicial e último erro; a chave da API nunca vai para a tela.
    provedor: c.provedor,
    dataInicial: dataIsoDaConta(c.dataInicial),
    ultimoErro: c.ultimoErro,
    temCredencial: Boolean(c.credencialEncrypted),
    transacoes: c.transacoes.map((t) => ({
      id: t.id,
      data: t.data.toISOString(),
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.tipo,
      categoria: t.categoria,
      status: t.status,
      externalId: t.externalId,
      origem: t.origem,
    })),
    saldoExtratoData: dataIsoDaConta(c.saldoExtratoData),
  }));

  return <BpoClient lancamentos={mapped} dre={dre} contabilidade={contabilidade} clientes={clientes} leads={leads} contas={contas} pluggy={pluggy} abaInicial={aba === "bancos" ? "bancos" : undefined} relatorios={relatoriosData} />;
}
