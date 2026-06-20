import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const targetUsuarioId = url.searchParams.get("usuarioId");
  const user = session.user as { id?: string };
  const usuarioId = targetUsuarioId ?? user.id;

  if (!usuarioId) return NextResponse.json({ status: "desconectado", numero: null });

  const conexao = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId } });
  if (!conexao) return NextResponse.json({ status: "desconectado", numero: null });

  return NextResponse.json({ status: conexao.status, numero: conexao.numero });
}
