import { prisma } from "@/lib/db";
import { FinanciamentosClient } from "./_components/financiamentos-client";

export default async function FinanciamentosPage() {
  const financiamentos = await prisma.financiamento.findMany({
    orderBy: { criadoEm: "desc" },
    include: { corretor: true, checklist: true },
  });

  return <FinanciamentosClient financiamentos={financiamentos} />;
}
