import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { criarInstancia, obterQrCode, evolutionConfigured } from "@/lib/evolution";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string; role?: string };
  const usuarioId = user.id;
  if (!usuarioId) return NextResponse.json({ error: "Sem ID" }, { status: 400 });

  const role = user.role;
  if (role === "cliente" || role === "colaborador") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  if (!evolutionConfigured()) {
    return NextResponse.json({ ok: false, configurado: false, mensagem: "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY nas variáveis de ambiente da Vercel." });
  }

  const instancia = `gsf-${usuarioId.slice(0, 12)}`;
  await criarInstancia(instancia);
  const qrCode = await obterQrCode(instancia);

  await prisma.conexaoWhatsApp.upsert({
    where: { usuarioId },
    create: { usuarioId, provedor: "evolution", instancia, status: qrCode ? "aguardando_qr" : "desconectado", qrCode },
    update: { provedor: "evolution", instancia, status: qrCode ? "aguardando_qr" : "desconectado", qrCode },
  });

  return NextResponse.json({ ok: true, qrCode, instancia });
}
