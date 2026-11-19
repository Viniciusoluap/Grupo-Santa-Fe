"use server";
// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-02: ações do logotipo do empreendimento (Dados Gerais do estudo).
import { revalidatePath } from "next/cache";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { guardarParte } from "@/lib/documentos-upload-partes";
import { TIPO_PARTES_LOGO, excluirLogoDoEstudo, logoAtivo, salvarLogoDoEnvio, type EntradaSalvarLogo } from "@/lib/incorporacao/logotipo-db";

export async function obterLogotipo(estudoId: string) {
  await exigirModuloAcao("incorporacao");
  return logoAtivo(estudoId);
}

/** Uma parte de 1 MiB do arquivo original (até 10 MB), em `documento_upload_partes` (tipo "inc-logo"). */
export async function enviarParteLogotipo(estudoId: string, uploadId: string, parte: number, total: number, nome: string, pedaco: Blob) {
  const usuario = await exigirModuloAcao("incorporacao");
  const chunk = Buffer.from(await pedaco.arrayBuffer()).toString("base64");
  await guardarParte({ uploadId, parte, total, nome, chunk }, usuario.id, TIPO_PARTES_LOGO, estudoId);
  return { ok: true as const };
}

/** Grava (ou troca) o logotipo. Devolve o erro como dado para a tela mostrar a mensagem. */
export async function salvarLogotipo(estudoId: string, input: EntradaSalvarLogo) {
  const usuario = await exigirModuloAcao("incorporacao");
  try {
    const logo = await salvarLogoDoEnvio(estudoId, usuario.id, input);
    revalidatePath("/admin/incorporacao");
    revalidatePath(`/admin/incorporacao/${estudoId}/editar`);
    return { ok: true as const, logo };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Falha ao salvar o logotipo." };
  }
}

export async function excluirLogotipo(estudoId: string) {
  await exigirModuloAcao("incorporacao");
  const r = await excluirLogoDoEstudo(estudoId);
  revalidatePath("/admin/incorporacao");
  revalidatePath(`/admin/incorporacao/${estudoId}/editar`);
  return r;
}
