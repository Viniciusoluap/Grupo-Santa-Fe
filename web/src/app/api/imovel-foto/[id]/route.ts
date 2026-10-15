import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth/modulos";
import { lerDocumentoRegistro } from "@/lib/incorporacao/registro-drive";

export const runtime = "nodejs";

// Pedido de 15/10: foto de imóvel guardada no Google Drive (ou no banco enquanto
// o Drive estiver fora). Imóvel publicado no site: foto pública (site/portais).
// Não publicado: só a equipe e o corretor responsável. Gêmeo de
// server/routes/imovel-fotos.ts da Prospecta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const foto = await prisma.imovelFoto.findUnique({
    where: { id },
    select: { mime: true, driveFileId: true, dados: true, imovel: { select: { publicadoSite: true, corretorId: true } } },
  });
  if (!foto) return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });
  const publica = foto.imovel.publicadoSite;
  if (!publica) {
    const u = await usuarioAtual();
    const pode = u?.ativo && (u.perfil === "admin" || u.perfil === "colaborador" || (u.perfil === "corretor" && u.corretorId && u.corretorId === foto.imovel.corretorId));
    if (!pode) return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });
  }
  let body: Uint8Array<ArrayBuffer>;
  try {
    body = foto.dados ? new Uint8Array(foto.dados) : new Uint8Array(await lerDocumentoRegistro(foto.driveFileId!));
  } catch {
    return NextResponse.json({ error: "Foto indisponível no Google Drive no momento." }, { status: 502 });
  }
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": foto.mime,
      "Cache-Control": publica ? "public, max-age=86400, s-maxage=86400" : "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
