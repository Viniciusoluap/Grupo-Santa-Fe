import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { podeVerFotosDaObra } from "@/lib/obras/fotos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";

export const runtime = "nodejs";

// EPIC-020 Lote 4 (item 28) — leitura da foto da obra com checagem de
// permissão (admin, equipe com o módulo Obras ou cliente da obra), igual à /api/obra-foto/:id da Prospecta.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fotoId: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; leadId?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { fotoId } = await params;
  const foto = await prisma.obraFoto.findUnique({
    where: { id: fotoId },
    select: { obra: { select: { leadId: true } }, arquivo: { select: { mime: true, dados: true } } },
  });
  const acessoObras = user.role === "admin" || user.role === "colaborador"
    ? podeAcessarModulo((await usuarioAtual()) ?? { perfil: null, ativo: false, permissoes: [] }, "obras")
    : false;
  const pode = foto && podeVerFotosDaObra({ id: user.id, papel: user.role ?? "", leadId: user.leadId ?? null, acessoObras }, { leadId: foto.obra.leadId });
  if (!foto || !pode) return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });
  const corpo = new Uint8Array(foto.arquivo.dados as unknown as Buffer);
  return new NextResponse(corpo, {
    status: 200,
    headers: {
      "Content-Type": foto.arquivo.mime,
      "Content-Length": String(corpo.length),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
