"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarCorretor(formData: FormData) {
  const especialidadesList: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "especialidades[]") {
      especialidadesList.push(value as string);
    }
  }

  await prisma.corretor.create({
    data: {
      nome: formData.get("nome") as string,
      creci: formData.get("creci") as string,
      telefone: formData.get("telefone") as string,
      email: formData.get("email") as string,
      especialidades: JSON.stringify(especialidadesList),
      ativo: true,
    },
  });
  revalidatePath("/admin/corretores");
  redirect("/admin/corretores");
}
