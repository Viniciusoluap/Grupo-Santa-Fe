import { obterAtorCrm } from "@/lib/crm/acesso-lead";
import { escopoFinanciamentosDoAtor } from "@/lib/crm/acesso-financiamento";
import { prisma } from "@/lib/db";
import { FinanciamentosClient } from "./_components/financiamentos-client";

export default async function FinanciamentosPage() {
  const ator = await obterAtorCrm();
  const financiamentos = await prisma.financiamento.findMany({
    where: escopoFinanciamentosDoAtor(ator),
    orderBy: { criadoEm: "desc" },
    include: { corretor: true, checklist: true },
  });

  return <FinanciamentosClient financiamentos={financiamentos} podeArquivar={ator.papel === "admin"} />;
}
