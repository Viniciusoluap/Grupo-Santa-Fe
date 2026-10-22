import { exigirModuloPagina } from "@/lib/auth/modulos";
import { obterAtorCrm } from "@/lib/crm/acesso-lead";
import { escopoFinanciamentosDoAtor } from "@/lib/crm/acesso-financiamento";
import { prisma } from "@/lib/db";
import { FinanciamentosClient } from "./_components/financiamentos-client";

export default async function FinanciamentosPage() {
  await exigirModuloPagina("financiamentos");
  const ator = await obterAtorCrm("financiamentos");
  const financiamentos = await prisma.financiamento.findMany({
    where: escopoFinanciamentosDoAtor(ator),
    orderBy: { criadoEm: "desc" },
    include: { corretor: true, checklist: true, leadVinculado: { select: { orcamento: true, valorAprovado: true } } },
  });

  const valoresDoCrm = financiamentos.map(({ leadVinculado, ...f }) => ({ ...f,
    valorImovel: leadVinculado ? leadVinculado.orcamento : f.valorImovel,
    valorFinanciado: leadVinculado ? (leadVinculado.valorAprovado == null ? null : Number(leadVinculado.valorAprovado)) : f.valorFinanciado,
  }));
  return <FinanciamentosClient financiamentos={valoresDoCrm} podeArquivar={ator.papel === "admin" || ator.papel === "colaborador"} />;
}
