export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { BpoClient } from "./_components/bpo-client";

export default async function BpoPage() {
  const [lancamentos, clientes, contasRaw] = await Promise.all([
    prisma.bpoLancamento.findMany({
      orderBy: { vencimento: "desc" },
      include: { cliente: { select: { razaoSocial: true } } },
    }),
    prisma.bpoCliente.findMany({
      where: { status: "ativo" },
      select: { id: true, razaoSocial: true },
      orderBy: { razaoSocial: "asc" },
    }),
    prisma.contaBancaria.findMany({
      where: { ativo: true },
      orderBy: { criadoEm: "desc" },
      include: { transacoes: { orderBy: { data: "desc" }, take: 100 } },
    }),
  ]);

  const mapped = lancamentos.map((l) => ({
    id: l.id,
    clienteId: l.clienteId,
    clienteNome: l.cliente.razaoSocial,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    vencimento: l.vencimento.toISOString(),
    pago: l.pago,
    pagoEm: l.pagoEm?.toISOString() ?? null,
    competencia: l.competencia,
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
    ultimaSincronizacao: c.ultimaSincronizacao?.toISOString() ?? null,
    transacoes: c.transacoes.map((t) => ({
      id: t.id,
      data: t.data.toISOString(),
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.tipo,
      categoria: t.categoria,
      status: t.status,
      externalId: t.externalId,
    })),
  }));

  return <BpoClient lancamentos={mapped} clientes={clientes} contas={contas} />;
}
