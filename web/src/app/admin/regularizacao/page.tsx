import { prisma } from "@/lib/db";
import { RegularizacaoClient } from "./_components/regularizacao-client";

export default async function RegularizacaoPage() {
  const regularizacoes = await prisma.regularizacao.findMany({
    orderBy: { criadoEm: "desc" },
    include: { documentos: true },
  });

  return <RegularizacaoClient regularizacoes={regularizacoes} />;
}
