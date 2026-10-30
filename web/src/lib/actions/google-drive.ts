"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { exigirAdminAtivo } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { origemDaRequisicao } from "@/lib/google-drive-oauth";
import { desconectarOAuth, estadoOAuth, salvarCredencialOAuth } from "@/lib/google-drive-conexao";
import { sincronizarDrive, ultimoRelatorioDrive } from "@/lib/drive-organizacao";

// Integrações → Google Drive (só administrador). O JSON do cliente OAuth chega
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
    revalidatePath("/admin/integracoes");
    return r;
  });
}

export async function desconectarGoogleDrive() {
  return capturarErroAcao(async () => {
    const admin = await exigirAdminAtivo();
    await desconectarOAuth(admin.id);
    revalidatePath("/admin/integracoes");
    return { ok: true };
  });
}

/** Pedido de 29/10: último relatório do "Organizar Drive" (cron diário ou botão). */
export async function relatorioOrganizacaoDrive() {
  return capturarErroAcao(async () => { await exigirAdminAtivo(); return ultimoRelatorioDrive(); });
}

/**
 * Botão "Organizar Drive agora": uma rodada com prazo (~45 s); o que faltar continua
 * na próxima rodada (botão de novo ou cron diário), de onde parou.
 */
export async function organizarDriveAgora() {
  return capturarErroAcao(async () => { await exigirAdminAtivo(); return sincronizarDrive({ prazoMs: 45_000 }); });
}
