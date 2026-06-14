import { prisma } from "@/lib/db";
import { ContabilidadeClient } from "./_components/contabilidade-client";

export default async function ContabilidadePage() {
  const lancamentos = await prisma.lancamento.findMany({
    orderBy: { data: "desc" },
  });
  return <ContabilidadeClient lancamentos={lancamentos} />;
}
