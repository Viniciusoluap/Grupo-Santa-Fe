import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";
import { removerInstancia } from "@/lib/evolution";
import { configEvolution } from "@/lib/whatsapp/evolution-config";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string; role?: string };
  if (!user.id || (user.role !== "admin" && user.role !== "corretor" && user.role !== "colaborador")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  // Pedido de 17/10/2026: o colaborador com WhatsApp desconecta a conexão da empresa (a do admin).
  if (user.role === "colaborador") {
    const u = await usuarioAtual();
    if (!u || !podeAcessarModulo(u, "whatsapp")) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const dono = await donoDaConexaoWhatsApp(user.id, user.role);
  if (dono) {
    // Pedido de 25/10: conexão por QR também sai da Evolution (logout + remoção da instância).
    const conn = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: dono } });
    if (conn?.provedor === "evolution" && conn.instancia) {
      const c = await configEvolution();
      if (c) await removerInstancia(c, conn.instancia);
    }
    await prisma.conexaoWhatsApp.deleteMany({ where: { usuarioId: dono } });
  }

  return NextResponse.json({ ok: true });
}
