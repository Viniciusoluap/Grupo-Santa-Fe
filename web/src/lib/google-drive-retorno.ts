import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { origemDaRequisicao } from "@/lib/google-drive-oauth";

/** Volta para Integrações com o resultado da conexão do Google Drive (?drive=ok|erro&motivo=...). */
export function voltarIntegracoes(req: NextRequest, resultado: "ok" | "erro", motivo?: string) {
  const url = new URL("/admin/integracoes", origemDaRequisicao(req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? undefined));
  url.searchParams.set("drive", resultado);
  if (motivo) url.searchParams.set("motivo", motivo.slice(0, 300));
  return NextResponse.redirect(url, 302);
}
