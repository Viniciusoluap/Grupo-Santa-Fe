"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { revalidatePath } from "next/cache";
import { criarImovelCore, editarImovelCore, imovelDoCorretor } from "@/lib/imoveis/salvar";
import { excluirImovelDefinitivo } from "@/lib/imoveis/excluir";
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
 * o corretor exclui só o imóvel que ele cadastrou (pedido de 18/10, item 3).
 * Recusado excluído pela equipe deixa o aviso "Recusado" para o corretor (item 8).
 */
export async function excluirImovel(id: string) {
  const u = await exigirModuloAcao("imoveis");
  if (u.perfil === "corretor") {
    await imovelDoCorretor(id, u.id);
  } else if (u.perfil !== "admin" && u.perfil !== "colaborador") {
    throw new Error("Acesso não autorizado.");
  }
  await excluirImovelDefinitivo(id, { avisarCorretor: u.perfil !== "corretor" });
  revalidatePath("/admin/imoveis");
  revalidatePath("/corretor/imoveis");
}
