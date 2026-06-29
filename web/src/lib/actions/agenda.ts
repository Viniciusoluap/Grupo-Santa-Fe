"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function criarVisita(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const corretorId = (formData.get("corretorId") as string) || undefined;
  const colaboradorNome = (formData.get("colaboradorNome") as string) || undefined;
  const imovelId = (formData.get("imovelId") as string) || undefined;

  await prisma.visita.create({
    data: {
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      agendadaPara: new Date(formData.get("agendadaPara") as string),
      tipoVisita: (formData.get("tipoVisita") as string) || "imovel",
      imovelId: imovelId || null,
      corretorId: corretorId || null,
      colaboradorNome: colaboradorNome || null,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/agenda");
}

export async function editarVisita(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const corretorId = (formData.get("corretorId") as string) || null;
  const colaboradorNome = (formData.get("colaboradorNome") as string) || null;
  const imovelId = (formData.get("imovelId") as string) || null;

  await prisma.visita.update({
    where: { id },
    data: {
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      agendadaPara: new Date(formData.get("agendadaPara") as string),
      tipoVisita: (formData.get("tipoVisita") as string) || "imovel",
      imovelId,
      corretorId,
      colaboradorNome,
      notas: (formData.get("notas") as string) || "",
    },
  });
  revalidatePath("/admin/agenda");
}

export async function excluirVisita(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.visita.delete({ where: { id } });
  revalidatePath("/admin/agenda");
}

export async function atualizarStatusVisita(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.visita.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/agenda");
}
