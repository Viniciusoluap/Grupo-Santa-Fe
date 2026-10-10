"use server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// Esta action é pública por natureza (quem ainda não tem senha não tem sessão
// para autenticar) — a segurança vem do token aleatório de 32 bytes e da
// expiração, não de RBAC.
export async function definirSenhaPrimeiroAcesso(token: string, novaSenha: string) {
  if (!token) return { error: "Link inválido" };
  if (!novaSenha || novaSenha.length < 6) return { error: "Senha inválida (mín. 6 caracteres)" };

  const usuario = await prisma.usuario.findUnique({ where: { tokenPrimeiroAcesso: token } });
  if (!usuario) return { error: "Link inválido ou já utilizado" };
  if (!usuario.tokenPrimeiroAcessoExpira || usuario.tokenPrimeiroAcessoExpira < new Date()) {
    return { error: "Link expirado. Peça ao administrador para gerar um novo." };
  }

  const hash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      senha: hash,
      tokenPrimeiroAcesso: null,
      tokenPrimeiroAcessoExpira: null,
      sessionVersion: { increment: 1 },
    },
  });

  return { success: true };
}
