import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin")
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const body = (await request.json()) as { value?: unknown };
  const value = Number(body.value);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000)
    return NextResponse.json({ error: "Meta inválida" }, { status: 400 });
  await prisma.configuracao.upsert({
    where: { chave: "dashboard_meta_mensal" },
    create: {
      chave: "dashboard_meta_mensal",
      valor: String(value),
      grupo: "dashboard",
    },
    update: { valor: String(value) },
  });
  return NextResponse.json({ success: true });
}
