"use server";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { carregarLeadParaVinculo, clienteParaRegistro, registrarServicoNoLead } from "@/lib/crm/vinculo-lead";
import { dadosClienteDoLead } from "@/lib/crm/servicos-lead";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarDiarioObra(obraId: string, formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
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
  requireActionRole(session, "admin");
  // Vínculo real (EPIC-007): obra só nasce vinculada a um lead do CRM.
  const lead = await carregarLeadParaVinculo(formData.get("leadId") as string);
  const cliente = dadosClienteDoLead(lead);
  const leadId = lead.id;
  const latStr = formData.get("latitude") as string;
  const lngStr = formData.get("longitude") as string;

  await prisma.obra.create({
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      clienteNome: cliente.clienteNome,
      clienteTel: cliente.clienteTel,
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
  await registrarServicoNoLead(leadId, "obra");
  const nomeObra = formData.get("nome") as string;
  await notificarAdmins("nova_obra", "Nova obra cadastrada", `${nomeObra} — ${cliente.clienteNome}`, "/admin/obras").catch(() => {});
  revalidatePath("/admin/obras");
  redirect("/admin/obras");
}

export async function excluirObra(id: string) {
  const session = await auth();
  requireActionRole(session, "admin");
  await prisma.obra.delete({ where: { id } });
  revalidatePath("/admin/obras");
}

export async function editarObra(formData: FormData) {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = formData.get("id") as string;
  const atual = await prisma.obra.findUnique({ where: { id }, select: { leadId: true } });
  const cliente = await clienteParaRegistro(atual?.leadId, formData);
  await prisma.obra.update({
    where: { id },
    data: {
      nome: formData.get("nome") as string,
      tipo: formData.get("tipo") as string,
      status: formData.get("status") as string,
      clienteNome: cliente.clienteNome,
      clienteTel: cliente.clienteTel,
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
