import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import type { ModuloServico } from "@/lib/crm/servicos-lead";

/** Módulo do painel onde cada serviço do CRM cria o registro. */
export const MODULO_PAINEL_DO_SERVICO: Record<ModuloServico, string> = {
  financiamento: "financiamentos", obra: "obras", projeto: "projetos", regularizacao: "regularizacao", avaliacao: "avaliacao",
};

/**
 * Revisão do Codex (Prospecta #130 e Santa Fé #198), mesma regra nos dois
 * sistemas: o colaborador só cria registro de serviço num módulo liberado para
 * ele. Admin e corretor seguem como antes.
 */
export async function exigirModuloDoServico(modulo: ModuloServico, servico?: string): Promise<void> {
  const u = await usuarioAtual();
  if (u?.perfil !== "colaborador") return;
  if (!podeAcessarModulo(u, MODULO_PAINEL_DO_SERVICO[modulo])) throw new Error(`Sem permissão para o módulo de "${servico ?? modulo}".`);
}
