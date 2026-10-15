import { exigirModuloAcao, usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";

// Portal do Empreiteiro (pedido de 15/10/2026). O empreiteiro usa o mesmo painel
// "Editar Obra" do admin, mas só nas obras em que é o empreiteiro vinculado e só
// nas partes liberadas: lê Informações, Valores e Custos previstos; usa
// Pagamentos, Progresso, Fotos e Relatórios. Gêmeo de server/obra-acesso.ts da
// Prospecta.

const NAO_VINCULADA = "Esta obra não está vinculada a você.";

/** Empreiteiro ativo da sessão, ou `null` quando o usuário é de outro perfil. */
export async function empreiteiroDaSessao(): Promise<{ id: string; nome: string } | null> {
  const u = await usuarioAtual();
  return u?.ativo && u.perfil === "empreiteiro" ? { id: u.id, nome: u.nome } : null;
}

/** A obra é do empreiteiro? (lido do banco a cada chamada). */
export async function obraEhDoEmpreiteiro(obraId: string, empreiteiroId: string): Promise<boolean> {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { empreiteiroId: true } });
  return !!obra && obra.empreiteiroId === empreiteiroId;
}

/**
 * Actions de obra liberadas ao empreiteiro: equipe com o módulo Obras passa como
 * antes; o empreiteiro passa só na obra vinculada a ele. Devolve o id do usuário.
 */
export async function exigirObraOuEmpreiteiro(obraId: string | null | undefined): Promise<string | null> {
  const emp = await empreiteiroDaSessao();
  if (emp) {
    if (!obraId || !(await obraEhDoEmpreiteiro(obraId, emp.id))) throw new Error(NAO_VINCULADA);
    return emp.id;
  }
  const u = await exigirModuloAcao("obras");
  return u.id;
}
