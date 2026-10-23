// Lote 23/10, etapa 4 — grava a conclusão no módulo (servidor). Gêmeo de
// Prospecta/server/conclusao-servico.ts. Fora de "use server": não é endpoint.
import type { prisma } from "@/lib/db";
import { STATUS_CANCELADO_DO_MODULO, STATUS_CONCLUIDO_DO_MODULO, moduloConcluivel, type ResultadoConclusao } from "@/lib/crm/conclusao-servico";
import type { ModuloServico } from "@/lib/crm/servicos-lead";

const TABELA = {
  obra: "obras", projeto: "projetos", regularizacao: "regularizacoes",
  financiamento: "financiamentos", avaliacao: "avaliacoes", tarefa: "tarefas_crm",
} as const satisfies Record<ModuloServico, string>;

/**
 * Conclui o registro `registroId` do módulo, só se pertencer ao lead (por ID) e
 * não estiver concluído nem cancelado. Grava apenas o status e a data de alteração.
 */
export async function concluirRegistroDoLead(tx: Pick<typeof prisma, "$queryRawUnsafe">, leadId: string, modulo: string, registroId: string): Promise<ResultadoConclusao> {
  if (!moduloConcluivel(modulo)) return { estado: "sem_modulo", modulo };
  const tabela = TABELA[modulo];
  const final = STATUS_CONCLUIDO_DO_MODULO[modulo];
  const cancelado = STATUS_CANCELADO_DO_MODULO[modulo];
  const linhas = await tx.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "${tabela}" SET status = $1, "atualizadoEm" = now() WHERE id = $2 AND "leadId" = $3 AND status NOT IN ($1, $4) RETURNING id`,
    final, registroId, leadId, cancelado,
  );
  if (linhas.length) return { estado: "concluido", modulo, registroId };
  const atual = await tx.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM "${tabela}" WHERE id = $1 AND "leadId" = $2`, registroId, leadId);
  if (!atual.length) return { estado: "sem_registro", modulo };
  return { estado: atual[0].status === cancelado ? "cancelado" : "ja_concluido", modulo, registroId };
}

