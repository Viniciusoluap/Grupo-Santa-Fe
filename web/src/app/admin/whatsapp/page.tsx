export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { WhatsAppClient } from "./_components/whatsapp-client";

type SessionUser = { id?: string; role?: string; corretorId?: string };

export default async function WhatsAppPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as SessionUser;
  const role = user.role ?? "cliente";
  const usuarioId = user.id;

  if (role === "cliente" || !usuarioId) redirect("/admin");

  const leads = await prisma.lead.findMany({
    where: role === "corretor" && user.corretorId ? { corretorId: user.corretorId } : {},
    select: { id: true, nome: true, telefone: true, servico: true },
    orderBy: { criadoEm: "desc" },
  });

  type ConexaoRow = {
    id: string; usuarioId: string; provedor: string; instancia: string | null;
    numero: string | null; status: string; qrCode: string | null;
  };

  let minhaConexao: ConexaoRow | null = null;
  let conexoesCorretores: Array<{ id: string; usuarioId: string; usuarioNome: string; provedor: string; numero: string | null; status: string }> = [];

  if (role === "admin") {
    const conn = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId } });
    if (conn) {
      minhaConexao = { id: conn.id, usuarioId: conn.usuarioId, provedor: conn.provedor, instancia: conn.instancia, numero: conn.numero, status: conn.status, qrCode: conn.qrCode };
    }
    const corretores = await prisma.usuario.findMany({
      where: { papel: "corretor" },
      select: { id: true, nome: true, conexaoWhatsApp: true },
      orderBy: { nome: "asc" },
    });
    conexoesCorretores = corretores.map((c) => ({
      id: c.conexaoWhatsApp?.id ?? "",
      usuarioId: c.id,
      usuarioNome: c.nome,
      provedor: c.conexaoWhatsApp?.provedor ?? "evolution",
      numero: c.conexaoWhatsApp?.numero ?? null,
      status: c.conexaoWhatsApp?.status ?? "desconectado",
    }));
  } else if (role === "colaborador") {
    const adminU = await prisma.usuario.findFirst({ where: { papel: "admin" }, select: { id: true } });
    if (adminU) {
      const conn = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: adminU.id } });
      if (conn) {
        minhaConexao = { id: conn.id, usuarioId: conn.usuarioId, provedor: conn.provedor, instancia: null, numero: conn.numero, status: conn.status, qrCode: null };
      }
    }
  } else if (role === "corretor") {
    const conn = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId } });
    if (conn) {
      minhaConexao = { id: conn.id, usuarioId: conn.usuarioId, provedor: conn.provedor, instancia: conn.instancia, numero: conn.numero, status: conn.status, qrCode: conn.qrCode };
    }
  }

  const historicoRaw = await prisma.mensagemWhatsapp.findMany({
    where: role === "admin" ? {} : minhaConexao ? { conexaoId: minhaConexao.id } : { id: "none" },
    orderBy: { enviadaEm: "desc" },
    take: 100,
  });

  const historico = historicoRaw.map((m) => ({
    id: m.id, destinatario: m.destinatario, nomeDestinatario: m.nomeDestinatario,
    mensagem: m.mensagem, status: m.status, enviadaEm: m.enviadaEm.toISOString(), erroMsg: m.erroMsg,
  }));

  return (
    <WhatsAppClient
      leads={leads}
      minhaConexao={minhaConexao}
      conexoesCorretores={conexoesCorretores}
      historico={historico}
      role={role}
      usuarioId={usuarioId}
    />
  );
}
