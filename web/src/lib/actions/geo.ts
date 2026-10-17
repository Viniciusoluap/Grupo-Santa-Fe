"use server";

import { usuarioAtual } from "@/lib/auth/modulos";
import { resolverLinkCurto } from "@/lib/geo/link-curto";

/** Item 7 (18/10): abre no servidor o link curto do Google Maps e devolve o ponto. */
export async function resolverLinkCurtoAction(url: string): Promise<{ ok: true; lat: number; lng: number } | { ok: false; erro: string }> {
  const u = await usuarioAtual();
  if (!u?.ativo) return { ok: false, erro: "Não autorizado." };
  if (typeof url !== "string" || url.length > 500) return { ok: false, erro: "Link inválido." };
  try {
    return { ok: true, ...(await resolverLinkCurto(url)) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível abrir o link." };
  }
}
