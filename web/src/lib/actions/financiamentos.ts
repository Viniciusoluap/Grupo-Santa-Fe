"use server";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarFinanciamento(formData: FormData) {
  const leadId = (formData.get("leadId") as string) || undefined;
  const imovelVinculadoId = (formData.get("imovelVinculadoId") as string) || undefined;

  const fin = await prisma.financiamento.create({
    data: {
      clienteNome: formData.get("clienteNome") as string,
      clienteTel: formData.get("clienteTel") as string,
      clienteEmail: (formData.get("clienteEmail") as string) || undefined,
      clienteCpf: (formData.get("clienteCpf") as string) || undefined,
      imovel: formData.get("imovel") as string,
      tipo: formData.get("tipo") as string,
      banco: formData.get("banco") as string,
      valorImovel: parseFloat(formData.get("valorImovel") as string) || 0,
      valorFinanciado: parseFloat(formData.get("valorFinanciado") as string) || 0,
      entrada: parseFloat(formData.get("entrada") as string) || 0,
      taxa: parseFloat(formData.get("taxa") as string) || 0,
      prazo: parseInt(formData.get("prazo") as string) || 360,
      leadId,
      imovelVinculadoId,
    },
  });
  await notificarAdmins("novo_financiamento", "Novo financiamento cadastrado", `${fin.clienteNome} — ${fin.banco}`, "/admin/financiamentos").catch(() => {});
  revalidatePath("/admin/financiamentos");
  redirect(`/admin/financiamentos/${fin.id}`);
}
