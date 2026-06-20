import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string };
  if (!user.id) return NextResponse.json({ ok: false });

  await prisma.notificacao.updateMany({
    where: { usuarioId: user.id, lida: false },
    data: { lida: true },
  });

  return NextResponse.json({ ok: true });
}
