"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarDiarioObra(obraId: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.obraDiario.create({
    data: {
      obraId,
      data: new Date(formData.get("data") as string),
      descricao: formData.get("descricao") as string,
      responsavel: formData.get("responsavel") as string,
      clima: (formData.get("clima") as string) || null,
    },
  });
  revalidatePath(`/admin/obras/${obraId}`);
}

export async function criarObra(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const leadId = (formData.get("leadId") as string) || undefined;
  const latStr = formData.get("latitude") as string;
  const lngStr = formData.get("longitude") as string;

  await prisma.obra.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      endereco: formData.get("endereco") as string,
      area: parseFloat(formData.get("area") as string) || 0,
      valorTotal: parseFloat(formData.get("valorTotal") as string) || 0,
      engenheiroResp: formData.get("engenheiroResp") as string,
      descricao: (formData.get("descricao") as string) || "",
      leadId,
      latitude: latStr ? parseFloat(latStr) : null,
      longitude: lngStr ? parseFloat(lngStr) : null,
    },
  });
  const nomeObra = formData.get("nome") as string;
  await notificarAdmins("nova_obra", "Nova obra cadastrada", `${nomeObra} — ${formData.get("clienteNome")}`, "/admin/obras").catch(() => {});
  revalidatePath("/admin/obras");
  redirect("/admin/obras");
}

export async function excluirObra(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.obra.delete({ where: { id } });
  revalidatePath("/admin/obras");
}

export async function editarObra(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  await prisma.obra.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      status: formData.get("status") as string,
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      endereco: formData.get("endereco") as string,
      area: parseFloat(formData.get("area") as string) || 0,
      valorTotal: parseFloat(formData.get("valorTotal") as string) || 0,
      engenheiroResp: formData.get("engenheiroResp") as string,
      descricao: (formData.get("descricao") as string) || "",
    },
  });
  revalidatePath("/admin/obras");
  redirect(`/admin/obras/${id}`);
}
