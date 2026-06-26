import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Separate API route to avoid Next.js page re-render after server actions,
// which would send all base64 photos back in the response and crash iOS Safari.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { dados } = (await req.json()) as { dados: string };

  if (!id || !dados) {
    return NextResponse.json({ error: "Missing id or dados" }, { status: 400 });
  }

  await prisma.avaliacao.update({
    where: { id },
    data: { caracteristicas: dados },
  });

  return NextResponse.json({ ok: true });
}
