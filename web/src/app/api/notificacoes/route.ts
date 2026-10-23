import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { alertasCalculados } from "@/lib/notificacoes-calculadas";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string; role?: string };
  const usuarioId = user.id;
  const role = user.role;

  if (!usuarioId || role === "cliente") return NextResponse.json({ notificacoes: [], total: 0 });

  // Stored notifications for this user
  const stored = await prisma.notificacao.findMany({
    where: { usuarioId, lida: false },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });

  // Alertas calculados (cobranças e prazos próximos) — mesma fonte da página "Ver todas".
  const computed = role === "admin" || role === "colaborador" ? await alertasCalculados() : [];

  const all = [
    ...stored.map((n) => ({ ...n, criadoEm: n.criadoEm.toISOString() })),
    ...computed,
  ];

  return NextResponse.json({ notificacoes: all, total: all.length });
}
