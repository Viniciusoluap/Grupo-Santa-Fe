"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { deveBloquearDesativacaoUltimoAdmin } from "@/lib/auth/admin-guard";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

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

export async function salvarPermissoes(id: string, permissoes: string[]) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.usuario.update({
    where: { id },
    data: { permissoes: JSON.stringify(permissoes) },
  });
  revalidatePath("/admin/configuracoes");
}
