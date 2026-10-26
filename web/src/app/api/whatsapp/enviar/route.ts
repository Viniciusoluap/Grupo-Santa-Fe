import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { prisma } from "@/lib/db";
import { filtrarDestinatariosValidos } from "@/lib/whatsapp/validacao";
import { enviarTextoEvolution } from "@/lib/evolution";
import { configEvolution } from "@/lib/whatsapp/evolution-config";
import { enviarWhatsappBusiness } from "@/lib/whatsapp/business";
import { valoresDosLeads } from "@/lib/whatsapp/valores-leads";
import { limparExtras, textosPorDestinatario } from "@/lib/whatsapp/variaveis";

interface Destinatario {
  id: string;
  nome: string;
  telefone: string;
  leadId?: string;
}

export async function POST(req: NextRequest) {
  // Item 06: perfil, situação e permissões vêm do banco; só quem tem o módulo
  // WhatsApp (admin, colaborador liberado ou corretor ativo) envia.
  const usuario = await usuarioAtual();
  if (!usuario?.ativo) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeAcessarModulo(usuario, "whatsapp")) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (usuario.perfil === "corretor" && !usuario.corretorId) return NextResponse.json({ error: "Cadastro de corretor inativo" }, { status: 403 });

  const user = { id: usuario.id, corretorId: usuario.corretorId ?? undefined };
  const role = usuario.perfil ?? undefined;

  const { mensagem, destinatarios, extras, extrasPorLead } = await req.json() as { mensagem: string; destinatarios: Destinatario[]; extras?: Record<string, string>; extrasPorLead?: Record<string, Record<string, string>> };
  if (typeof mensagem !== "string" || !mensagem.trim() || !Array.isArray(destinatarios)) {
    return NextResponse.json({ error: "Mensagem e destinatários são obrigatórios" }, { status: 400 });
  }

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
    const adminUsuario = await prisma.usuario.findFirst({ where: { papel: "admin" }, select: { id: true }, orderBy: { criadoEm: "asc" } });
    if (adminUsuario) {
      conexao = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: adminUsuario.id } });
    }
  } else if (role === "corretor") {
    conexao = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: user.id } });
  }

  if (!conexao || conexao.status !== "conectado") {
    return NextResponse.json({ error: "Nenhuma conexão WhatsApp ativa" }, { status: 400 });
  }

  // Pedido de 25/10: conexão por QR code (Evolution) ou API oficial do WhatsApp Business.
  const porQr = conexao.provedor === "evolution";
  const evolution = porQr ? await configEvolution() : null;
  if (porQr && (!evolution || !conexao.instancia)) {
    return NextResponse.json({ error: "Servidor da Evolution (QR code) não configurado" }, { status: 400 });
  }
  if (!porQr && (!conexao.token || !conexao.phoneNumberId)) {
    return NextResponse.json({ error: "Credenciais da Business API não configuradas" }, { status: 400 });
  }
  const conn = conexao;
  const enviarUm = (telefone: string, texto: string) => porQr
    ? enviarTextoEvolution(evolution!, conn.instancia!, telefone, texto)
    : enviarWhatsappBusiness(conn.token!, conn.phoneNumberId!, telefone, texto);

  if (destinatariosValidados.length === 0) {
    return NextResponse.json({ error: "Nenhum destinatário válido (lead inexistente ou não pertence a você)" }, { status: 400 });
  }

  // Pedido de 25/10: cada destinatário recebe o template já preenchido; nada sai com {{…}}.
  const valores = await valoresDosLeads(destinatariosValidados.map((d) => d.leadId), usuario.nome ?? null);
  const { textos, erro } = textosPorDestinatario(mensagem, destinatariosValidados.map((d) => d.leadId), valores, limparExtras(extras), extrasPorLead);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  let enviadas = 0;
  let falhas = 0;

  for (const dest of destinatariosValidados) {
    const texto = textos.get(dest.leadId)!;
    try {
      const externalId = await enviarUm(dest.telefone, texto);
      await prisma.mensagemWhatsapp.create({
        data: { conexaoId: conexao.id, destinatario: dest.telefone, nomeDestinatario: dest.nome, mensagem: texto, leadId: dest.leadId, externalId, status: externalId ? "enviada" : "falhou" },
      });
      if (externalId) enviadas++; else falhas++;
    } catch {
      await prisma.mensagemWhatsapp.create({
        data: { conexaoId: conexao.id, destinatario: dest.telefone, nomeDestinatario: dest.nome, mensagem: texto, leadId: dest.leadId, status: "falhou", erroMsg: "Erro ao enviar" },
      });
      falhas++;
    }
  }

  return NextResponse.json({ ok: true, enviadas, falhas });
}
