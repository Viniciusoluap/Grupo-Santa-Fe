import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { filtrarDestinatariosValidos } from "@/lib/whatsapp/validacao";

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

  const user = session.user as { id?: string; role?: string; corretorId?: string };
  const role = user.role;
  if (role === "cliente") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { mensagem, destinatarios } = await req.json() as { mensagem: string; destinatarios: Destinatario[] };

  // O corpo da requisicao e' controlado pelo cliente - antes, telefone/nome/leadId
  // eram usados como vieram, sem checar se o leadId existe ou pertence ao corretor
  // logado. Isso permitia enviar mensagem (usando a API paga/oficial do WhatsApp
  // Business da empresa) para qualquer numero de telefone informado no corpo da
  // requisicao, disfarcado de lead, e atribuir o historico a um leadId arbitrario
  // (inclusive de outro corretor). Revalidamos cada destinatario contra o banco:
  // o lead precisa existir e, para corretor, precisa pertencer a ele; telefone e
  // nome usados no envio e no historico vem do banco, nunca do corpo da requisicao.
  const leadIds = destinatarios
    .map((d) => d.leadId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const leadsEncontrados = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, nome: true, telefone: true, corretorId: true },
      })
    : [];

  const destinatariosValidados = filtrarDestinatariosValidos(destinatarios, leadsEncontrados, role, user.corretorId);

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

  if (destinatariosValidados.length === 0) {
    return NextResponse.json({ error: "Nenhum destinatário válido (lead inexistente ou não pertence a você)" }, { status: 400 });
  }

  let enviadas = 0;
  let falhas = 0;

  for (const dest of destinatariosValidados) {
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
