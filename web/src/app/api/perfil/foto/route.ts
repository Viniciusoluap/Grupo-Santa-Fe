import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string };
  if (!user.id) return NextResponse.json({ error: "Sem ID" }, { status: 400 });

  const body = await req.json() as { foto?: string };
  const { foto } = body;

  if (!foto || !foto.startsWith("data:image/")) {
    return NextResponse.json({ error: "Imagem inválida" }, { status: 400 });
  }

  // Limit size (base64 ~750KB limit → original ~562KB)
  if (foto.length > 800000) {
    return NextResponse.json(
      { error: "Imagem muito grande. Use uma imagem menor." },
      { status: 400 }
    );
  }

  await prisma.usuario.update({
    where: { id: user.id },
    data: { foto },
  });

  return NextResponse.json({ ok: true, foto });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ foto: null });

  const user = session.user as { id?: string };
  if (!user.id) return NextResponse.json({ foto: null });

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { foto: true },
    });
    return NextResponse.json({ foto: usuario?.foto ?? null });
  } catch {
    return NextResponse.json({ foto: null });
  }
}
