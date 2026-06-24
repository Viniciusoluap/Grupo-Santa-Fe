import { prisma } from "@/lib/db";
import { ComissoesClient } from "./_components/comissoes-client";

export default async function ComissoesPage() {
  const [comissoes, corretores] = await Promise.all([
    prisma.comissao.findMany({
      orderBy: { vencimento: "desc" },
      include: { corretor: true, contrato: true },
    }),
    prisma.corretor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return <ComissoesClient comissoes={comissoes} corretores={corretores} />;
}
