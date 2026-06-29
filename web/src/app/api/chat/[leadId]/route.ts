import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { leadId } = await params;

  // Clientes só podem ver sua própria conversa
  if (session.user.role === "cliente" && session.user.leadId !== leadId) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  const after = req.nextUrl.searchParams.get("after");
  const mensagens = await prisma.chatMensagem.findMany({
    where: {
      leadId,
      ...(after ? { criadoEm: { gt: new Date(after) } } : {}),
    },
    orderBy: { criadoEm: "asc" },
    take: after ? 100 : 50,
  });

  return NextResponse.json(mensagens);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { leadId } = await params;

  // Clientes só podem escrever na própria conversa
  if (session.user.role === "cliente" && session.user.leadId !== leadId) {
    return NextResponse.json({ error: "Proibido" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.texto || typeof body.texto !== "string" || body.texto.trim().length === 0) {
    return NextResponse.json({ error: "Texto inválido" }, { status: 400 });
  }

  const remetente = session.user.role === "cliente" ? "cliente" : "corretor";

  const mensagem = await prisma.chatMensagem.create({
    data: {
      leadId,
      remetente,
      texto: body.texto.trim().slice(0, 2000),
      lido: false,
    },
  });

  return NextResponse.json(mensagem, { status: 201 });
}
