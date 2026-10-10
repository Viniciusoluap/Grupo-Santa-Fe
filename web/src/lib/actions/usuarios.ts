"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { deveBloquearDesativacaoUltimoAdmin } from "@/lib/auth/admin-guard";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

const TOKEN_PRIMEIRO_ACESSO_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export async function criarUsuario(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const nome = formData.get("nome") as string;
  const email = formData.get("email") as string;
  const senha = formData.get("senha") as string;
  const papel = formData.get("papel") as string;
  const creci = (formData.get("creci") as string) || null;
  const telefone = (formData.get("telefone") as string) || null;

  if (!nome || !email || !senha || !papel) return { error: "Campos obrigatórios ausentes" };

  // Corretores precisam de um registro vinculado em Corretor (CRECI, telefone,
  // especialidades) que este formulário não coleta. Criar apenas o Usuario aqui
  // reproduziria o bug de identidade quebrada (login funciona, mas o corretor não
  // aparece em /admin/corretores nem pode receber leads/comissões/imóveis).
  if (papel === "corretor") {
    return { error: "Para cadastrar corretores, use Corretores → Novo Corretor (exige CRECI)" };
  }

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) return { error: "E-mail já cadastrado" };

  const hash = await bcrypt.hash(senha, 10);

  await prisma.usuario.create({
    data: { nome, email, senha: hash, papel, creci, telefone },
  });

  revalidatePath("/admin/configuracoes");
}

// Protege contra lockout administrativo: a UI ja desabilita o botao para
// usuarios com papel=admin, mas isso e so client-side (nao substitui
// autorizacao no servidor) - uma chamada direta a esta action sem essa guarda
// permitiria desativar/excluir o ultimo admin ativo e travar o acesso
// administrativo do sistema para sempre.
async function bloquearSeUltimoAdminAtivo(id: string): Promise<{ error: string } | null> {
  const alvo = await prisma.usuario.findUnique({ where: { id }, select: { papel: true, ativo: true } });
  const adminsAtivos = await prisma.usuario.count({ where: { papel: "admin", ativo: true } });
  if (deveBloquearDesativacaoUltimoAdmin(alvo, adminsAtivos)) {
    return { error: "Não é possível desativar/excluir o último administrador ativo" };
  }
  return null;
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const session = await auth();
  requireActionRole(session, "admin");
  if (!ativo) {
    const bloqueado = await bloquearSeUltimoAdminAtivo(id);
    if (bloqueado) return bloqueado;
  }
  await prisma.usuario.update({ where: { id }, data: { ativo } });
  revalidatePath("/admin/configuracoes");
}

export async function redefinirSenha(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  const novaSenha = formData.get("novaSenha") as string;
  if (!id || !novaSenha || novaSenha.length < 6) return { error: "Senha inválida (mín. 6 caracteres)" };

  const hash = await bcrypt.hash(novaSenha, 10);
  // Incrementa sessionVersion: qualquer sessao JWT ja emitida para este usuario
  // (por exemplo, de alguem que tinha acesso indevido) e invalidada no proximo
  // request - ver comentario em auth.ts sobre por que isso nao acontecia antes.
  await prisma.usuario.update({ where: { id }, data: { senha: hash, sessionVersion: { increment: 1 } } });
  revalidatePath("/admin/configuracoes");
}

export async function excluirUsuario(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  const bloqueado = await bloquearSeUltimoAdminAtivo(id);
  if (bloqueado) return bloqueado;
  await prisma.usuario.delete({ where: { id } });
  revalidatePath("/admin/configuracoes");
}

// Corretores cadastrados antes da correção do ciclo de identidade (S-01) ficaram
// sem Usuario vinculado — nenhum deles consegue logar. Esta action cria o Usuario
// com uma senha placeholder inutilizável (nunca entregue a ninguém) e um token de
// primeiro acesso: o próprio corretor define a senha real em /definir-senha/[token],
// em vez do admin ter que inventar e repassar uma senha.
export async function vincularUsuarioCorretor(corretorId: string) {
  const session = await auth();
  requireActionRole(session, "admin");

  const corretor = await prisma.corretor.findUnique({ where: { id: corretorId } });
  if (!corretor) return { error: "Corretor não encontrado" };
  if (corretor.usuarioId) return { error: "Este corretor já tem uma conta vinculada" };

  const existe = await prisma.usuario.findUnique({ where: { email: corretor.email } });
  if (existe) return { error: "Já existe um usuário com este e-mail" };

  const token = crypto.randomBytes(32).toString("hex");
  const senhaPlaceholder = crypto.randomBytes(32).toString("hex");
  const hash = await bcrypt.hash(senhaPlaceholder, 10);

  const usuario = await prisma.usuario.create({
    data: {
      nome: corretor.nome,
      email: corretor.email,
      senha: hash,
      papel: "corretor",
      creci: corretor.creci,
      telefone: corretor.telefone,
      tokenPrimeiroAcesso: token,
      tokenPrimeiroAcessoExpira: new Date(Date.now() + TOKEN_PRIMEIRO_ACESSO_VALIDADE_MS),
    },
  });

  await prisma.corretor.update({ where: { id: corretorId }, data: { usuarioId: usuario.id } });

  revalidatePath("/admin/corretores");
  return { success: true, token };
}

export async function salvarPermissoes(id: string, permissoes: string[]) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.usuario.update({
    where: { id },
    data: { permissoes: JSON.stringify(permissoes) },
  });
  revalidatePath("/admin/configuracoes");
}
