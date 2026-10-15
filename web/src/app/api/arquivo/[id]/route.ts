import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { lerDocumentoRegistro } from "@/lib/incorporacao/registro-drive";

export const runtime = "nodejs";

// Serve um arquivo armazenado no banco. Exige sessão autenticada (qualquer papel
// logado — inclui o cliente do portal, que baixa seus contratos). O id é um cuid
// não-adivinhável, então mesmo entre usuários logados o acesso é por posse do id.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const arquivo = await prisma.arquivo.findUnique({ where: { id } });
  if (!arquivo) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  // Contratos gravados no Google Drive são lidos de lá; os demais, do banco.
  let body: Uint8Array<ArrayBuffer>;
  try {
    body = arquivo.driveFileId ? new Uint8Array(await lerDocumentoRegistro(arquivo.driveFileId))
      : arquivo.dados ? new Uint8Array(arquivo.dados) : new Uint8Array();
  } catch {
    return NextResponse.json({ error: "Arquivo indisponível no Google Drive no momento." }, { status: 502 });
  }
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": arquivo.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(arquivo.nome)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
