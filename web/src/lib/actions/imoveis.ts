"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { criarImovelCore, editarImovelCore } from "@/lib/imoveis/salvar";
import { redirect } from "next/navigation";

export async function criarImovel(formData: FormData) {
  await criarImovelCore(formData);
  redirect("/admin/imoveis");
}

export async function editarImovel(formData: FormData) {
  await editarImovelCore(formData);
  redirect("/admin/imoveis");
}

/**
 * Exclusão definitiva: admin ou colaborador com o módulo (pedido de 17/10/2026);
 * o corretor exclui só o imóvel que é dele (pedido de 18/10, item 3).
 */
export async function excluirImovel(id: string) {
  const u = await exigirModuloAcao("imoveis");
  if (u.perfil === "corretor") {
    const atual = await prisma.imovel.findUnique({ where: { id }, select: { corretorId: true } });
    if (!atual || !u.corretorId || atual.corretorId !== u.corretorId) throw new Error("Imóvel não encontrado ou acesso não autorizado.");
  } else if (u.perfil !== "admin" && u.perfil !== "colaborador") {
    throw new Error("Acesso não autorizado.");
  }
  await prisma.imovel.delete({ where: { id } });
  revalidatePath("/admin/imoveis");
}
