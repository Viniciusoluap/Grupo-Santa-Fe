export const dynamic = "force-dynamic";

import { exigirModuloPagina } from "@/lib/auth/modulos";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";
import { WhatsAppClient } from "./_components/whatsapp-client";
import { SERVICOS_LEAD } from "@/lib/crm/servicos-lead";
import { TEMPLATES_WHATSAPP_PADRAO } from "@/lib/whatsapp/templates";
import { LEAD_ATIVO_WHATSAPP } from "@/lib/whatsapp/conversas";

type SessionUser = { id?: string; role?: string; corretorId?: string };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirModuloPagina("whatsapp");
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as SessionUser;
  const role = user.role ?? "cliente";
  const usuarioId = user.id;

  if (role === "cliente" || !usuarioId) redirect("/admin");

  // Lote 03, correção 03: destinatários só de leads ativos do CRM (não excluídos nem arquivados).
  const leads = await prisma.lead.findMany({
    where: { ...LEAD_ATIVO_WHATSAPP, ...(role === "corretor" && user.corretorId ? { corretorId: user.corretorId } : {}) },
    select: { id: true, nome: true, telefone: true, servico: true },
    orderBy: { criadoEm: "desc" },
  });

  type ConexaoRow = {
    id: string; usuarioId: string; provedor: string; instancia: string | null;
    numero: string | null; status: string; qrCode: string | null;
  };

  let minhaConexao: ConexaoRow | null = null;
  let conexoesCorretores: Array<{ id: string; usuarioId: string; usuarioNome: string; provedor: string; numero: string | null; status: string }> = [];

  // Pedido de 17/10/2026: o colaborador com WhatsApp faz o mesmo que o admin,
  // sobre a conexão da empresa (a do admin).
  if (role === "admin" || role === "colaborador") {
    const dono = await donoDaConexaoWhatsApp(usuarioId, role);
    const conn = dono ? await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: dono } }) : null;
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
  } else if (role === "corretor") {
    const conn = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId } });
    if (conn) {
      minhaConexao = { id: conn.id, usuarioId: conn.usuarioId, provedor: conn.provedor, instancia: conn.instancia, numero: conn.numero, status: conn.status, qrCode: conn.qrCode };
    }
  }

  // Pedido de 25/10: o histórico mostra só as mensagens enviadas; as recebidas ficam na aba Conversas.
  const historicoRaw = await prisma.mensagemWhatsapp.findMany({
    where: role === "admin" || role === "colaborador" ? { direcao: "saida" } : minhaConexao ? { conexaoId: minhaConexao.id, direcao: "saida" } : { id: "none" },
    orderBy: { enviadaEm: "desc" },
    take: 100,
  });

  const historico = historicoRaw.map((m) => ({
    id: m.id, destinatario: m.destinatario, nomeDestinatario: m.nomeDestinatario,
    mensagem: m.mensagem, status: m.status, enviadaEm: m.enviadaEm.toISOString(), erroMsg: m.erroMsg,
  }));

  // Pedido de 25/10: ?aba=conversas&numero=… abre direto o chat (notificações e página do lead).
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const abaInicial = um(sp.aba) === "conversas" ? "conversas" : "conexao";
  const numeroInicial = um(sp.numero)?.replace(/\D/g, "").slice(0, 20) || null;
  const templates = await prisma.whatsappTemplate.findMany({ where: { ativo: true }, orderBy: [{ finalidade: "asc" }, { nome: "asc" }] })
    .then((rows) => rows.length ? rows.map((t) => ({ id: t.id, name: t.nome, category: t.finalidade, body: t.conteudo })) : TEMPLATES_WHATSAPP_PADRAO)
    .catch(() => TEMPLATES_WHATSAPP_PADRAO);

  return (
    <WhatsAppClient
      abaInicial={abaInicial}
      numeroInicial={numeroInicial}
      leads={leads}
      minhaConexao={minhaConexao}
      conexoesCorretores={conexoesCorretores}
      historico={historico}
      role={role}
      usuarioId={usuarioId}
      templates={templates}
      servicosDisponiveis={[...SERVICOS_LEAD]}
      podeGerenciarTemplates={role === "admin"}
    />
  );
}
