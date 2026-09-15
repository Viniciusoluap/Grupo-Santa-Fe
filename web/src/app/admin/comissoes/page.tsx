import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ComissoesClient } from "./_components/comissoes-client";

type SessionUser = { role?: string; corretorId?: string };

export default async function ComissoesPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const isAdmin = user?.role === "admin";
  const isCorretor = user?.role === "corretor";
  const corretorId = user?.corretorId;

  const [comissoes, corretores, imoveis, financiamentos, obras] = await Promise.all([
    prisma.comissao.findMany({
      where: isCorretor && corretorId ? { corretorId } : {},
      orderBy: { vencimento: "desc" },
      include: { corretor: true, contrato: true },
    }),
    prisma.corretor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.imovel.findMany({ select: { id: true, titulo: true, status: true }, orderBy: { titulo: "asc" } }),
    prisma.financiamento.findMany({ select: { id: true, clienteNome: true }, orderBy: { clienteNome: "asc" } }),
    prisma.obra.findMany({ select: { id: true, nome: true, clienteNome: true }, orderBy: { nome: "asc" } }),
  ]);

  const negociosPorTipo = {
    venda: imoveis
      .filter((i) => ["venda", "lancamento", "vendido"].includes(i.status))
      .map((i) => ({ id: i.id, label: i.titulo })),
    aluguel: imoveis
      .filter((i) => ["locacao", "locado"].includes(i.status))
      .map((i) => ({ id: i.id, label: i.titulo })),
    financiamento: financiamentos.map((f) => ({ id: f.id, label: f.clienteNome })),
    obra: obras.map((o) => ({ id: o.id, label: `${o.nome} — ${o.clienteNome}` })),
    extra: [] as { id: string; label: string }[],
  };

  return <ComissoesClient comissoes={comissoes} corretores={corretores} negociosPorTipo={negociosPorTipo} isAdmin={isAdmin} />;
}
