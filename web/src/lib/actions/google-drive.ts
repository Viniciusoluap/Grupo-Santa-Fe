"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { exigirAdminAtivo } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { origemDaRequisicao } from "@/lib/google-drive-oauth";
import { desconectarOAuth, estadoOAuth, salvarCredencialOAuth } from "@/lib/google-drive-conexao";

// Configurações → Google Drive (só administrador). O JSON do cliente OAuth chega
// aqui, é validado e guardado criptografado; o arquivo nunca é devolvido à tela.
// Mesmas operações do router `googleDrive` da Prospecta.

async function origem() {
  const h = await headers();
  return origemDaRequisicao(h.get("x-forwarded-host") ?? h.get("host") ?? undefined);
}

export async function statusGoogleDrive() {
  return capturarErroAcao(async () => { await exigirAdminAtivo(); return estadoOAuth(await origem()); });
}

export async function salvarCredencialGoogleDrive(json: string) {
  return capturarErroAcao(async () => {
    const admin = await exigirAdminAtivo();
    if (typeof json !== "string" || json.length < 2 || json.length > 20_000) throw new Error("Arquivo inválido para ser o JSON do cliente OAuth.");
    const r = await salvarCredencialOAuth(json, admin.id, await origem());
    revalidatePath("/admin/configuracoes");
    return r;
  });
}

export async function desconectarGoogleDrive() {
  return capturarErroAcao(async () => {
    const admin = await exigirAdminAtivo();
    await desconectarOAuth(admin.id);
    revalidatePath("/admin/configuracoes");
    return { ok: true };
  });
}
