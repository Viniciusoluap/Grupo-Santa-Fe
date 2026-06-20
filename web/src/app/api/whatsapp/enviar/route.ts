import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

interface Destinatario {
  id: string;
  nome: string;
  telefone: string;
  leadId?: string;
}

async function enviarBusiness(token: string, phoneNumberId: string, numero: string, texto: string): Promise<string | null> {
  const num = numero.replace(/\D/g, "");
  const numFinal = num.startsWith("55") ? num : `55${num}`;
  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to: numFinal, type: "text", text: { body: texto } }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ?? null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string; role?: string };
  const role = user.role;
  if (role === "cliente") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { mensagem, destinatarios } = await req.json() as { mensagem: string; destinatarios: Destinatario[] };

  let conexao = null;

  if (role === "admin" || role === "colaborador") {
    const adminUsuario = await prisma.usuario.findFirst({ where: { papel: "admin" }, select: { id: true } });
    if (adminUsuario) {
      conexao = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: adminUsuario.id } });
    }
  } else if (role === "corretor") {
    conexao = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: user.id } });
  }

  if (!conexao || conexao.status !== "conectado") {
    return NextResponse.json({ error: "Nenhuma conexão WhatsApp Business ativa" }, { status: 400 });
  }

  if (!conexao.token || !conexao.phoneNumberId) {
    return NextResponse.json({ error: "Credenciais da Business API não configuradas" }, { status: 400 });
  }

  let enviadas = 0;
  let falhas = 0;

  for (const dest of destinatarios) {
    try {
      const externalId = await enviarBusiness(conexao.token, conexao.phoneNumberId, dest.telefone, mensagem);
      await prisma.mensagemWhatsapp.create({
        data: { conexaoId: conexao.id, destinatario: dest.telefone, nomeDestinatario: dest.nome, mensagem, leadId: dest.leadId, externalId, status: "enviada" },
      });
      enviadas++;
    } catch {
      await prisma.mensagemWhatsapp.create({
        data: { conexaoId: conexao.id, destinatario: dest.telefone, nomeDestinatario: dest.nome, mensagem, leadId: dest.leadId, status: "falhou", erroMsg: "Erro ao enviar" },
      });
      falhas++;
    }
  }

  return NextResponse.json({ ok: true, enviadas, falhas });
}
