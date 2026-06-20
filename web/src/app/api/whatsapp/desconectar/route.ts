import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string; role?: string };
  if (user.role === "cliente" || user.role === "colaborador") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  await prisma.conexaoWhatsApp.deleteMany({ where: { usuarioId: user.id } });

  return NextResponse.json({ ok: true });
}
