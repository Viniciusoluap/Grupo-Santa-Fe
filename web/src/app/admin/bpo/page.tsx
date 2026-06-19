export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { BpoClient } from "./_components/bpo-client";

export default async function BpoPage() {
  const [lancamentos, clientes] = await Promise.all([
    prisma.bpoLancamento.findMany({
      orderBy: { vencimento: "desc" },
      include: { cliente: { select: { razaoSocial: true } } },
    }),
    prisma.bpoCliente.findMany({
      where: { status: "ativo" },
      select: { id: true, razaoSocial: true },
      orderBy: { razaoSocial: "asc" },
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

  return <BpoClient lancamentos={mapped} clientes={clientes} />;
}
