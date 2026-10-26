import { NextResponse } from "next/server";
import { mensagemWhatsappAcessivel, tipoDeEntrega } from "@/lib/whatsapp/midia";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const msg = await mensagemWhatsappAcessivel(id);
  if (!msg?.midia?.conteudo) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const corpo = Buffer.from(msg.midia.conteudo);
  const { mime, inline } = tipoDeEntrega(msg.midiaMime, msg.midiaTipo);
  const nome = msg.midiaNome ?? `whatsapp-${id}`;
  const ascii = nome.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(corpo, { headers: {
    "Content-Type": mime,
    "Content-Length": String(corpo.length),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  } });
}
