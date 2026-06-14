import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { ComissoesClient } from "./_components/comissoes-client";

export default async function ComissoesPage() {
  const comissoes = await prisma.comissao.findMany({
    orderBy: { vencimento: "desc" },
    include: { corretor: true, contrato: true },
  });

  return <ComissoesClient comissoes={comissoes} />;
}
