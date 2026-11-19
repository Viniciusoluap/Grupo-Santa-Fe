// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-02: o arquivo original do logotipo só sai como download.
import { NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { bytesDoLogo } from "@/lib/incorporacao/logotipo-db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await exigirModuloAcao("incorporacao"); }
  catch (e) { return new NextResponse(null, { status: /permissão/i.test(e instanceof Error ? e.message : "") ? 403 : 401 }); }
  try {
    const { id } = await params;
    const logo = /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? await bytesDoLogo(id, "original") : null;
    if (!logo) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(logo.dados), {
      status: 200,
      headers: {
        "Content-Type": logo.mime,
        "Content-Disposition": `attachment; filename="logotipo"; filename*=UTF-8''${encodeURIComponent(logo.nome)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (erro) {
    console.error("[incorporacao-logo]", erro);
    return new NextResponse(null, { status: 500 });
  }
}
