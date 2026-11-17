// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-02 (`server/routes/incorporacao-logo.ts`): imagem do logotipo do
// empreendimento. Os cartões recebem só o PNG de exibição (ETag pelo sha256, cache curto e privado).
import { NextRequest, NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { bytesDoLogo } from "@/lib/incorporacao/logotipo-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await exigirModuloAcao("incorporacao"); }
  catch (e) { return new NextResponse(null, { status: /permissão/i.test(e instanceof Error ? e.message : "") ? 403 : 401 }); }
  try {
    const { id } = await params;
    const logo = /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? await bytesDoLogo(id, "exibicao") : null;
    if (!logo) return new NextResponse(null, { status: 404 });
    const etag = `"${logo.etag}"`;
    const cabecalhos = { ETag: etag, "Cache-Control": "private, max-age=300, must-revalidate", "X-Content-Type-Options": "nosniff" };
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: cabecalhos });
    return new NextResponse(new Uint8Array(logo.dados), { status: 200, headers: { ...cabecalhos, "Content-Type": "image/png" } });
  } catch (erro) {
    console.error("[incorporacao-logo]", erro);
    return new NextResponse(null, { status: 500 });
  }
}
