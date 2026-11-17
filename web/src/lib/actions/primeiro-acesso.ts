"use server";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import {
  aceitesDoUsuario, aparelhoDoUserAgent, conferirAceite, ErroDoTermo, MENSAGEM_FALHA_AO_VERIFICAR, registrarAceite, situacaoNoLink,
} from "@/lib/consentimento";

// Esta action é pública por natureza (quem ainda não tem senha não tem sessão
// para autenticar) — a segurança vem do token aleatório de 32 bytes e da
// expiração, não de RBAC.
// Paridade 17/11 bloco 4 (termo de consentimento): o servidor exige o aceite quando ele é obrigatório e grava a senha
// e o aceite NA MESMA TRANSAÇÃO (se um falhar, o outro é desfeito). A senha só é gravada se o token ainda vale.
export async function definirSenhaPrimeiroAcesso(token: string, novaSenha: string, aceitouTermo?: boolean, versaoDoTermo?: string) {
  if (!token) return { error: "Link inválido" };
  if (!novaSenha || novaSenha.length < 6) return { error: "Senha inválida (mín. 6 caracteres)" };

  const usuario = await prisma.usuario.findUnique({ where: { tokenPrimeiroAcesso: token } });
  if (!usuario) return { error: "Link inválido ou já utilizado" };
  if (!usuario.tokenPrimeiroAcessoExpira || usuario.tokenPrimeiroAcessoExpira < new Date()) {
    return { error: "Link expirado. Peça ao administrador para gerar um novo." };
  }

  let gravarAceite: boolean;
  try {
    gravarAceite = conferirAceite(situacaoNoLink(await aceitesDoUsuario(usuario.id)), aceitouTermo, versaoDoTermo);
  } catch (erro) {
    if (erro instanceof ErroDoTermo) return { error: erro.message };
    console.error("[consentimento] falha do banco ao conferir o aceite:", erro);
    return { error: MENSAGEM_FALHA_AO_VERIFICAR };
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  const aparelho = aparelhoDoUserAgent((await headers()).get("user-agent"));
  try {
    const gravou = await prisma.$transaction(async (tx) => {
      const r = await tx.usuario.updateMany({
        where: { id: usuario.id, tokenPrimeiroAcesso: token, tokenPrimeiroAcessoExpira: { gt: new Date() } },
        data: { senha: hash, tokenPrimeiroAcesso: null, tokenPrimeiroAcessoExpira: null, sessionVersion: { increment: 1 } },
      });
      if (r.count !== 1) return false;
      if (gravarAceite) await registrarAceite(tx, { usuarioId: usuario.id, canal: "definir_senha", aparelho, comSenha: true });
      return true;
    });
    if (!gravou) return { error: "Link inválido ou já utilizado" };
  } catch (erro) {
    console.error("[consentimento] falha ao gravar senha e aceite:", erro);
    return { error: MENSAGEM_FALHA_AO_VERIFICAR };
  }

  return { success: true };
}
