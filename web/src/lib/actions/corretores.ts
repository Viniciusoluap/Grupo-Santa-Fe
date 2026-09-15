"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { validarNovoCorretor } from "@/lib/corretores/validacao";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

export async function excluirCorretor(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  const corretor = await prisma.corretor.findUnique({ where: { id }, select: { usuarioId: true } });
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.visita.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.comissao.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.financiamento.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.imovel.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.corretor.delete({ where: { id } }),
    // Remove tambem o acesso de login vinculado - um corretor excluido nao deveria
    // continuar conseguindo entrar no sistema (antes, os dois registros eram
    // completamente desligados e o Usuario sobrevivia por conta propria).
    ...(corretor?.usuarioId ? [prisma.usuario.delete({ where: { id: corretor.usuarioId } })] : []),
  ]);
  revalidatePath("/admin/corretores");
}

export async function editarCorretor(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  const especialidadesList: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "especialidades[]") especialidadesList.push(value as string);
  }
  const email = formData.get("email") as string;
  const corretor = await prisma.corretor.findUnique({ where: { id }, select: { usuarioId: true } });
  await prisma.$transaction([
    prisma.corretor.update({
      where: { id },
      data: {
        nome: formData.get("nome") as string,
        creci: formData.get("creci") as string,
        telefone: formData.get("telefone") as string,
        email,
        especialidades: JSON.stringify(especialidadesList),
        ativo: formData.get("ativo") === "true",
      },
    }),
    // Mantem o e-mail de login em sincronia com o e-mail de perfil do corretor -
    // sao a mesma pessoa/identidade, nunca deveriam divergir silenciosamente.
    ...(corretor?.usuarioId
      ? [prisma.usuario.update({ where: { id: corretor.usuarioId }, data: { email } })]
      : []),
  ]);
  revalidatePath("/admin/corretores");
  redirect("/admin/corretores");
}

// Cria o corretor e o usuario de login ATOMICAMENTE, vinculados por usuarioId.
// Antes, este formulario coletava uma "Senha de Acesso" rotulada como "senha para
// login do corretor" mas gravava apenas em corretores.senhaAcesso - um campo que
// o fluxo de autenticacao (src/auth.ts) nunca leu. O corretor cadastrado por aqui
// simplesmente nao conseguia entrar no sistema ate um admin criar, manualmente e
// sem nenhuma orientacao na UI, um segundo registro em /admin/configuracoes com o
// mesmo e-mail.
export async function criarCorretor(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const especialidadesList: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "especialidades[]") {
      especialidadesList.push(value as string);
    }
  }

  const nome = formData.get("nome") as string;
  const email = formData.get("email") as string;
  const creci = formData.get("creci") as string;
  const telefone = formData.get("telefone") as string;
  const senha = (formData.get("senha") as string) || "";

  const erroValidacao = validarNovoCorretor({ nome, email, creci, telefone, senha });
  if (erroValidacao) {
    redirect("/admin/corretores/novo?erro=" + encodeURIComponent(erroValidacao));
  }

  const [usuarioExistente, corretorExistente] = await Promise.all([
    prisma.usuario.findUnique({ where: { email } }),
    prisma.corretor.findUnique({ where: { email } }),
  ]);
  if (usuarioExistente || corretorExistente) {
    redirect("/admin/corretores/novo?erro=" + encodeURIComponent("E-mail já cadastrado"));
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { nome, email, senha: senhaHash, papel: "corretor", creci, telefone },
    });
    await tx.corretor.create({
      data: {
        usuarioId: usuario.id,
        nome,
        creci,
        telefone,
        email,
        especialidades: JSON.stringify(especialidadesList),
        ativo: true,
      },
    });
  });

  await notificarAdmins("novo_corretor", "Novo corretor cadastrado", `${nome} — CRECI ${creci}`, "/admin/corretores").catch(() => {});
  revalidatePath("/admin/corretores");
  redirect("/admin/corretores");
}
