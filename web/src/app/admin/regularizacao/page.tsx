import { exigirModuloPagina } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { RegularizacaoClient } from "./_components/regularizacao-client";

export default async function RegularizacaoPage() {
  await exigirModuloPagina("regularizacao");

  const regularizacoes = await prisma.regularizacao.findMany({
    orderBy: { criadoEm: "desc" },
  });

  return <RegularizacaoClient regularizacoes={regularizacoes} />;
}
