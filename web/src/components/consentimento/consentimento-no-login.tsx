// Paridade 17/11 bloco 4: decide no SERVIDOR se o termo aparece ao entrar numa área logada (admin, portal, corretor,
// empreiteiro). Aparece para conta criada a partir de 17/11/2026 sem aceite (ex.: conta que o admin criou já com senha),
// para quem retirou o consentimento, e — só com CONSENTIMENTO_PEDIR_NO_LOGIN=1 — para quem não aceitou a versão vigente.
// Falha do banco (ex.: migração ainda não aplicada) não derruba a área logada: o modal simplesmente não aparece.
import { prisma } from "@/lib/db";
import { situacaoNoLogin } from "@/lib/consentimento";
import { ModalDoTermo } from "./modal-do-termo";

export async function ConsentimentoNoLogin({ usuarioId }: { usuarioId: string }) {
  let situacao: { pedir: boolean; versao: string };
  try {
    const conta = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, criadoEm: true } });
    if (!conta) return null;
    situacao = await situacaoNoLogin(conta);
  } catch (erro) {
    console.error("[consentimento] não foi possível verificar o termo no login:", erro);
    return null;
  }
  return situacao.pedir ? <ModalDoTermo versao={situacao.versao} /> : null;
}
