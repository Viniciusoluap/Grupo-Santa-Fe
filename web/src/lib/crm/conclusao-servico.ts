// Lote 23/10, etapa 4 — "Concluir" um serviço no CRM conclui o registro do módulo
// vinculado. Gêmeo de Prospecta/shared/conclusao-servico.ts: mesmas regras e
// mensagens; os valores de status são os de cada stack.
//
// No Santa Fé o card "Serviços do Cliente" já mostra o status do próprio registro
// do módulo (uma única fonte), então concluir no CRM = concluir o registro pelo ID
// dele, conferindo que pertence ao lead. Só o status muda: etapas, documentos,
// valores e histórico ficam intactos. Mão única, sem recursão.
import type { ModuloServico } from "@/lib/crm/servicos-lead";

/** Status "concluído" de cada módulo (valor gravado no banco). */
export const STATUS_CONCLUIDO_DO_MODULO: Record<ModuloServico, string> = {
  obra: "concluida",
  projeto: "entregue",
  regularizacao: "concluido",
  financiamento: "liberado", // exibido como "Concluído" (etapa 5)
  avaliacao: "entregue",
  tarefa: "concluida",
};

/** Status de cancelamento: registro cancelado não é reaberto como concluído. */
export const STATUS_CANCELADO_DO_MODULO: Record<ModuloServico, string> = {
  obra: "cancelada",
  projeto: "cancelado",
  regularizacao: "cancelado",
  financiamento: "cancelado",
  avaliacao: "cancelada",
  tarefa: "cancelada",
};

/** Módulo de permissão exigido para concluir cada tipo de registro. */
export const PERMISSAO_DO_MODULO: Record<ModuloServico, string> = {
  obra: "obras", projeto: "projetos", regularizacao: "regularizacao",
  financiamento: "financiamentos", avaliacao: "avaliacao", tarefa: "agenda",
};

export function moduloConcluivel(modulo: string | null | undefined): modulo is ModuloServico {
  return !!modulo && Object.hasOwn(STATUS_CONCLUIDO_DO_MODULO, modulo);
}

export function podeConcluir(modulo: ModuloServico, status: string): boolean {
  return status !== STATUS_CONCLUIDO_DO_MODULO[modulo] && status !== STATUS_CANCELADO_DO_MODULO[modulo];
}

export type ResultadoConclusao =
  | { estado: "concluido"; modulo: ModuloServico; registroId: string }
  | { estado: "ja_concluido"; modulo: ModuloServico; registroId: string }
  | { estado: "cancelado"; modulo: ModuloServico; registroId: string }
  | { estado: "sem_registro"; modulo: string | null }
  | { estado: "sem_modulo"; modulo: string | null };

/** Aviso exibido ao concluir no CRM (nunca diz que concluiu o que não concluiu). */
export function mensagemConclusao(r: ResultadoConclusao): string {
  switch (r.estado) {
    case "concluido": return "Serviço concluído no CRM e no módulo vinculado.";
    case "ja_concluido": return "Serviço concluído no CRM; o registro do módulo já estava concluído.";
    case "cancelado": return "Serviço concluído no CRM, mas o registro do módulo está cancelado e não foi alterado.";
    case "sem_registro": return "Serviço concluído no CRM; não há registro vinculado no módulo para concluir.";
    case "sem_modulo": return "Serviço concluído no CRM.";
  }
}
