import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { lerDocumentoRegistro } from "@/lib/incorporacao/registro-drive";

export async function GET(_request: Request, { params }: { params: Promise<{ documentoId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasRole(session, "admin")) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const { documentoId } = await params;
  if (!documentoId || documentoId.length > 100) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const documento = await prisma.estudoDocumentoRegistro.findUnique({
    where: { id: documentoId }, select: { ativo: true, driveFileId: true, mime: true, nome: true },
  });
  if (!documento?.ativo) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  try {
    const data = await lerDocumentoRegistro(documento.driveFileId);
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
