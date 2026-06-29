"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
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

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) return { error: "E-mail já cadastrado" };

  const hash = await bcrypt.hash(senha, 10);

  await prisma.usuario.create({
    data: { nome, email, senha: hash, papel, creci, telefone },
  });

  revalidatePath("/admin/configuracoes");
}

export async function alternarAtivo(id: string, ativo: boolean) {
  const session = await auth();
  requireActionRole(session, "admin");
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
  await prisma.usuario.update({ where: { id }, data: { senha: hash } });
  revalidatePath("/admin/configuracoes");
}

export async function excluirUsuario(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
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
