"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

export async function excluirCorretor(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.visita.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.comissao.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.financiamento.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.imovel.updateMany({ where: { corretorId: id }, data: { corretorId: null } }),
    prisma.corretor.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/corretores");
}

export async function editarCorretor(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const especialidadesList: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "especialidades[]") especialidadesList.push(value as string);
  }
  await prisma.corretor.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      creci: formData.get("creci") as string,
      telefone: formData.get("telefone") as string,
      email: formData.get("email") as string,
      especialidades: JSON.stringify(especialidadesList),
      ativo: formData.get("ativo") === "true",
    },
  });
  revalidatePath("/admin/corretores");
  redirect("/admin/corretores");
}

export async function criarCorretor(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const especialidadesList: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "especialidades[]") {
      especialidadesList.push(value as string);
    }
  }

  const senhaRaw = (formData.get("senha") as string) || null;
  const senhaHash = senhaRaw ? await bcrypt.hash(senhaRaw, 10) : null;

  await prisma.corretor.create({
    data: {
      nome: formData.get("nome") as string,
      creci: formData.get("creci") as string,
      telefone: formData.get("telefone") as string,
      email: formData.get("email") as string,
      especialidades: JSON.stringify(especialidadesList),
      ativo: true,
      senhaAcesso: senhaHash,
    },
  });
  const nome = formData.get("nome") as string;
  await notificarAdmins("novo_corretor", "Novo corretor cadastrado", `${nome} — CRECI ${formData.get("creci")}`, "/admin/corretores").catch(() => {});
  revalidatePath("/admin/corretores");
  redirect("/admin/corretores");
}
