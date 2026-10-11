import type { Prisma } from "@/generated/prisma/client";
import { etapaDoLead, isLeadStage, leadNoPipelineAtivo } from "./pipeline";
import { LEAD_STAGE_CONFIG } from "@/lib/types/crm";

export type SnapshotEtapa = {
  id: string;
  status: string;
  etapaOperacional: string | null;
  atualizadoEm: Date;
  arquivadoEm: Date | null;
  excluidoEm: Date | null;
};

/** Chamado dentro da mesma transação do lead e do histórico. */
export async function registrarMudancaEtapa(
  tx: Prisma.TransactionClient,
  lead: SnapshotEtapa,
  etapa: string,
  ator: string,
) {
  if (!isLeadStage(etapa)) throw new Error("Etapa operacional inválida.");
  if (!leadNoPipelineAtivo(lead)) throw new Error("Lead arquivado, excluído ou perdido não pode ser movimentado no pipeline ativo.");
  if (lead.etapaOperacional === etapa) return;
  const alterados = await tx.lead.updateMany({
    where: {
      id: lead.id,
      etapaOperacional: lead.etapaOperacional,
      status: lead.status,
      atualizadoEm: lead.atualizadoEm,
      arquivadoEm: null,
      excluidoEm: null,
    },
    data: { etapaOperacional: etapa },
  });
  if (alterados.count !== 1) throw new Error("Este lead foi atualizado por outra pessoa. Recarregue e tente novamente.");
  const anterior = etapaDoLead(lead);
  await tx.interacao.create({ data: {
    leadId: lead.id,
    tipo: "nota",
    descricao: `Etapa operacional: ${anterior ? LEAD_STAGE_CONFIG[anterior].label : "A CLASSIFICAR"} → ${LEAD_STAGE_CONFIG[etapa].label}. Status comercial preservado: ${lead.status}.`,
    criadoPor: ator,
  } });
}
