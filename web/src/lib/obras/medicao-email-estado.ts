import type { Prisma } from "@/generated/prisma/client";
/** Executar na mesma transação da alteração de foto. */
export async function invalidarAnexosMedicao(tx: Prisma.TransactionClient, medicaoId: string) {
  await tx.$executeRaw`UPDATE obra_progresso_historico SET "editadaEm" = ${new Date()},
    "emailSolicitacaoStatus" = CASE WHEN "solicitadaEm" IS NOT NULL THEN 'pending' ELSE "emailSolicitacaoStatus" END WHERE id = ${medicaoId}`;
}
