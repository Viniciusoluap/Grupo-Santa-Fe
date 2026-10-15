import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { prisma } from "@/lib/db";
import { lerDocumentoRegistro } from "@/lib/incorporacao/registro-drive";

export async function GET(_request: Request, { params }: { params: Promise<{ documentoId: string }> }) {
  // Item 06: mesma permissão das telas/actions do registro (módulo Incorporação).
  const usuario = await usuarioAtual();
  if (!usuario?.ativo) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!podeAcessarModulo(usuario, "incorporacao")) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const { documentoId } = await params;
  if (!documentoId || documentoId.length > 100) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const documento = await prisma.estudoDocumentoRegistro.findUnique({
    where: { id: documentoId }, select: { ativo: true, driveFileId: true, mime: true, nome: true, arquivo: { select: { dados: true } } },
  });
  if (!documento?.ativo) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  try {
    // Arquivo guardado no banco quando o Drive recusou a gravação; senão, no Drive.
    const data = documento.arquivo?.dados ? Buffer.from(documento.arquivo.dados)
      : documento.driveFileId ? await lerDocumentoRegistro(documento.driveFileId) : null;
    if (!data) throw new Error("Documento sem arquivo.");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": documento.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(documento.nome)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "Documento indisponível no armazenamento privado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
