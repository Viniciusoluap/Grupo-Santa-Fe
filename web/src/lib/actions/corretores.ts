"use server";

import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function excluirCorretor(id: string) {
  await prisma.corretor.delete({ where: { id } });
  revalidatePath("/admin/corretores");
}

export async function editarCorretor(formData: FormData) {
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
  const especialidadesList: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "especialidades[]") {
      especialidadesList.push(value as string);
    }
  }

  const senhaRaw = (formData.get("senha") as string) || null;

  await prisma.corretor.create({
    data: {
      nome: formData.get("nome") as string,
      creci: formData.get("creci") as string,
      telefone: formData.get("telefone") as string,
      email: formData.get("email") as string,
      especialidades: JSON.stringify(especialidadesList),
      ativo: true,
      senhaAcesso: senhaRaw || null,
    },
  });
  const nome = formData.get("nome") as string;
  await notificarAdmins("novo_corretor", "Novo corretor cadastrado", `${nome} — CRECI ${formData.get("creci")}`, "/admin/corretores").catch(() => {});
  revalidatePath("/admin/corretores");
  redirect("/admin/corretores");
}
