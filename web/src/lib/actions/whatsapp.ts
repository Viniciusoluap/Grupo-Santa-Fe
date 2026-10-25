"use server";
import { auth } from "@/auth";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirModuloAcao, usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";
import { configEvolution, urlServidorEvolution } from "@/lib/whatsapp/evolution-config";
import {
  enviarTextoEvolution, estadoInstancia, gerarQrCode, mesmoTelefone, numeroConectado, registrarWebhookEvolution,
} from "@/lib/evolution";
import { enviarWhatsappBusiness } from "@/lib/whatsapp/business";
import { valoresDosLeads } from "@/lib/whatsapp/valores-leads";
import { limparExtras, textosPorDestinatario } from "@/lib/whatsapp/variaveis";
import { URL_WEBHOOK_EVOLUTION, leadPorTelefone, segredoWebhookEvolution } from "@/lib/whatsapp/webhook-evolution";

// O parametro usuarioId recebido do cliente e' ignorado deliberadamente: a UI
// so chama esta action com o proprio usuarioId (session.user.id), mas a action
// em si nao validava isso - uma chamada direta com outro usuarioId conseguia
// sobrescrever o token/numero da conexao WhatsApp Business de qualquer outro
// usuario (inclusive um admin), ja que so checava `if (!session)`.
export async function salvarConexaoBusiness(_usuarioId: string, token: string, phoneNumberId: string, numero: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const sessao = session.user as { id?: string; role?: string };
  if (!sessao.id) throw new Error("Não autorizado");
  // Pedido de 17/10/2026: o colaborador com WhatsApp configura a conexão da empresa (a do admin).
  if (sessao.role === "colaborador") await exigirModuloAcao("whatsapp");
  const usuarioId = await donoDaConexaoWhatsApp(sessao.id, sessao.role);
  if (!usuarioId) throw new Error("Nenhum administrador para guardar a conexão da empresa.");
  await prisma.conexaoWhatsApp.upsert({
    where: { usuarioId },
    create: { usuarioId, provedor: "business", token, phoneNumberId, numero, status: "conectado" },
    update: { provedor: "business", token, phoneNumberId, numero, status: "conectado", instancia: null, qrCode: null },
  });
  revalidatePath("/admin/whatsapp");
}

// ── Pedido de 25/10: conexão por QR code (Evolution API). Gêmeo de Prospecta/server/whatsapp-router.ts ──

/** Dono da conexão para quem chama: colaborador (com módulo) usa a da empresa; corretor, a própria. */
async function donoParaQr(): Promise<{ dono: string; perfil: string }> {
  const session = await auth();
  const sessao = session?.user as { id?: string; role?: string } | undefined;
  if (!sessao?.id || !["admin", "colaborador", "corretor"].includes(sessao.role ?? "")) throw new Error("Não autorizado");
  if (sessao.role === "colaborador") await exigirModuloAcao("whatsapp");
  const dono = await donoDaConexaoWhatsApp(sessao.id, sessao.role);
  if (!dono) throw new Error("Nenhum administrador para guardar a conexão da empresa.");
  return { dono, perfil: sessao.role! };
}

async function exigirEvolution() {
  const c = await configEvolution();
  if (!c) throw new Error("Servidor do WhatsApp não configurado: informe o endereço e a chave em Configurações › Integrações.");
  return c;
}

export async function statusServidorEvolution(): Promise<{ configurado: boolean; url: string | null }> {
  await donoParaQr();
  const url = await urlServidorEvolution();
  return { configurado: Boolean(url), url };
}

// Em produção o Next esconde a mensagem de erros lançados em server actions; por isso as
// ações chamadas pela tela devolvem { erro } com o motivo legível.
const motivo = (e: unknown) => (e instanceof Error ? e.message : "Falha na Evolution.");

// LOTE B (25/10): endereço e chave da Evolution são salvos só em Configurações › Integrações
// (lib/actions/integracoes.ts → salvarEvolutionIntegracao).

export async function conectarWhatsappQr(): Promise<{ qrCode: string | null; status: string; erro?: string }> {
  try { return await conectarWhatsappQrInterno(); } catch (e) { return { qrCode: null, status: "erro", erro: motivo(e) }; }
}

async function conectarWhatsappQrInterno(): Promise<{ qrCode: string | null; status: string }> {
  const { dono } = await donoParaQr();
  const c = await exigirEvolution();
  const instancia = `santafe-${dono}`;
  const r = await gerarQrCode(c, instancia);
  const status = r.estado === "open" ? "conectado" : "aguardando_qr";
  const numero = r.estado === "open" ? await numeroConectado(c, instancia).catch(() => null) : null;
  const dados = { provedor: "evolution", instancia, status, token: null, phoneNumberId: null, qrCode: null, ...(numero ? { numero } : {}) };
  await prisma.conexaoWhatsApp.upsert({ where: { usuarioId: dono }, create: { usuarioId: dono, ...dados }, update: dados });
  return { qrCode: r.qrCode, status };
}

export async function statusWhatsappQr(): Promise<{ status: string; numero: string | null }> {
  const { dono } = await donoParaQr();
  const conn = await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: dono } });
  if (!conn || conn.provedor !== "evolution" || !conn.instancia) return { status: conn?.status ?? "desconectado", numero: conn?.numero ?? null };
  const c = await configEvolution();
  if (!c) return { status: conn.status, numero: conn.numero };
  const estado = await estadoInstancia(c, conn.instancia).catch(() => null);
  if (!estado) return { status: conn.status, numero: conn.numero };
  const status = estado === "open" ? "conectado" : estado === "connecting" ? "aguardando_qr" : "desconectado";
  let numero = conn.numero;
  if (status !== conn.status || (status === "conectado" && !numero)) {
    if (status === "conectado") {
      numero = (await numeroConectado(c, conn.instancia).catch(() => null)) ?? numero;
      // Pedido de 25/10 (Conversas): conectou → a Evolution passa a avisar as mensagens recebidas.
      await registrarWebhookEvolution(c, conn.instancia, URL_WEBHOOK_EVOLUTION(), segredoWebhookEvolution()).catch(() => undefined);
    }
    await prisma.conexaoWhatsApp.update({ where: { id: conn.id }, data: { status, numero } });
  }
  return { status, numero };
}

// ── Pedido de 25/10: templates preenchidos e Conversas (receber e responder) ──
// Gêmeo de previaEnvio/ativarAvisos/conversas/mensagensConversa/responder/criarLeadDaConversa em
// Prospecta/server/whatsapp-router.ts. Corretor: só conversas dos próprios leads (ou sem lead);
// colaborador precisa do módulo WhatsApp.

/** Quem usa as conversas e qual conexão (colaborador → a da empresa; corretor → a própria). */
async function atorWhatsapp() {
  const u = await usuarioAtual();
  if (!u?.ativo || !["admin", "colaborador", "corretor"].includes(u.perfil ?? "")) throw new Error("Não autorizado.");
  if (!podeAcessarModulo(u, "whatsapp")) throw new Error("Sem permissão para este módulo.");
  if (u.perfil === "corretor" && !u.corretorId) throw new Error("Cadastro de corretor inativo.");
  const dono = await donoDaConexaoWhatsApp(u.id, u.perfil);
  const conn = dono ? await prisma.conexaoWhatsApp.findUnique({ where: { usuarioId: dono } }) : null;
  return { u, conn };
}

/** Prévia por destinatário: mensagem final e variáveis que ainda faltam. */
export async function previaEnvioWhatsapp(mensagem: string, ids: string[], extras: Record<string, string> = {}): Promise<{ itens: { id: string; texto: string; faltando: string[] }[]; erro?: string }> {
  try {
    const { u } = await atorWhatsapp();
    const pedidos = Array.from(new Set((Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === "string"))).slice(0, 200);
    const leads = await prisma.lead.findMany({
      where: { id: { in: pedidos }, ...(u.perfil === "corretor" ? { corretorId: u.corretorId } : {}) },
      select: { id: true },
    });
    const permitidos = pedidos.filter((id) => leads.some((l) => l.id === id));
    const valores = await valoresDosLeads(permitidos, u.nome ?? null);
    return { itens: textosPorDestinatario(String(mensagem ?? "").slice(0, 4096), permitidos, valores, limparExtras(extras)).previa };
  } catch (e) {
    return { itens: [], erro: motivo(e) };
  }
}

/** Garante que a Evolution avise o sistema das mensagens (idempotente). Chamado ao abrir a aba Conversas. */
export async function ativarAvisosWhatsapp(): Promise<{ ok: boolean; mensagem?: string; erro?: string }> {
  try {
    const { conn } = await atorWhatsapp();
    if (!conn || conn.provedor !== "evolution" || !conn.instancia) return { ok: false, mensagem: "Conversas funcionam com a conexão por QR code." };
    const c = await exigirEvolution();
    await registrarWebhookEvolution(c, conn.instancia, URL_WEBHOOK_EVOLUTION(), segredoWebhookEvolution());
    return { ok: true, mensagem: "Recebimento de mensagens ativo." };
  } catch (e) {
    return { ok: false, erro: motivo(e) };
  }
}

export type ConversaWhatsapp = { numero: string; nome: string | null; leadId: string | null; ultima: string; quando: string; naoLidas: number };

const numeroValido = (n: unknown) => typeof n === "string" && n.replace(/\D/g, "").length >= 8 && n.length <= 20;

/** Ids dos leads de outro corretor (para esconder essas conversas de quem é corretor). */
async function leadsProibidos(u: { perfil: string | null | undefined; corretorId: string | null }, leadIds: string[]): Promise<Set<string>> {
  if (u.perfil !== "corretor" || !leadIds.length) return new Set();
  const outros = await prisma.lead.findMany({ where: { id: { in: leadIds }, NOT: { corretorId: u.corretorId } }, select: { id: true } });
  return new Set(outros.map((l) => l.id));
}

export async function conversasWhatsapp(): Promise<{ conversas: ConversaWhatsapp[]; erro?: string }> {
  try {
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { conversas: [] };
    const msgs = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id }, orderBy: { enviadaEm: "desc" }, take: 2000 });
    const grupos: ConversaWhatsapp[] = [];
    for (const m of msgs) {
      let g = grupos.find((x) => mesmoTelefone(x.numero, m.destinatario));
      if (!g) {
        g = { numero: m.destinatario.replace(/\D/g, ""), nome: m.nomeDestinatario, leadId: m.leadId, ultima: m.mensagem, quando: m.enviadaEm.toISOString(), naoLidas: 0 };
        grupos.push(g);
      }
      if (!g.nome && m.nomeDestinatario) g.nome = m.nomeDestinatario;
      if (!g.leadId && m.leadId) g.leadId = m.leadId;
      if (m.direcao === "entrada" && !m.lida) g.naoLidas++;
    }
    const proibidos = await leadsProibidos(u, grupos.flatMap((g) => (g.leadId ? [g.leadId] : [])));
    return { conversas: grupos.filter((g) => !g.leadId || !proibidos.has(g.leadId)) };
  } catch (e) {
    return { conversas: [], erro: motivo(e) };
  }
}

export type MensagemConversa = { id: string; direcao: string; mensagem: string; status: string; quando: string };

export async function mensagensConversaWhatsapp(numero: string): Promise<{ mensagens: MensagemConversa[]; erro?: string }> {
  try {
    if (!numeroValido(numero)) return { mensagens: [], erro: "Número inválido." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { mensagens: [] };
    const todas = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id }, orderBy: { enviadaEm: "desc" }, take: 3000 });
    const da = todas.filter((m) => mesmoTelefone(m.destinatario, numero)).reverse();
    const proibidos = await leadsProibidos(u, Array.from(new Set(da.flatMap((m) => (m.leadId ? [m.leadId] : [])))));
    if (proibidos.size) return { mensagens: [], erro: "Conversa de outro corretor." };
    const naoLidas = da.filter((m) => m.direcao === "entrada" && !m.lida).map((m) => m.id);
    if (naoLidas.length) await prisma.mensagemWhatsapp.updateMany({ where: { id: { in: naoLidas } }, data: { lida: true } });
    return { mensagens: da.map((m) => ({ id: m.id, direcao: m.direcao, mensagem: m.mensagem, status: m.status, quando: m.enviadaEm.toISOString() })) };
  } catch (e) {
    return { mensagens: [], erro: motivo(e) };
  }
}

/** Contato novo da conversa vira lead (nome do WhatsApp + telefone) e as mensagens passam a apontar para ele. */
export async function criarLeadDaConversaWhatsapp(numero: string, nome?: string): Promise<{ leadId?: string; erro?: string }> {
  try {
    if (!numeroValido(numero)) return { erro: "Número inválido." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { erro: "WhatsApp não está conectado." };
    const d = numero.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    const lead = await prisma.lead.create({
      data: {
        nome: (nome ?? "").trim().slice(0, 255) || `WhatsApp ${d}`, telefone: d, servico: "[]", origem: "whatsapp",
        ...(u.perfil === "corretor" && u.corretorId ? { corretorId: u.corretorId } : {}),
      },
      select: { id: true },
    });
    const msgs = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id }, select: { id: true, destinatario: true } });
    const ids = msgs.filter((m) => mesmoTelefone(m.destinatario, numero)).map((m) => m.id);
    if (ids.length) await prisma.mensagemWhatsapp.updateMany({ where: { id: { in: ids } }, data: { leadId: lead.id } });
    revalidatePath("/admin/leads");
    return { leadId: lead.id };
  } catch (e) {
    return { erro: motivo(e) };
  }
}

export async function responderWhatsapp(numero: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const corpo = String(texto ?? "").trim();
    if (!numeroValido(numero)) return { ok: false, erro: "Número inválido." };
    if (!corpo || corpo.length > 4096) return { ok: false, erro: "Escreva a mensagem (até 4096 caracteres)." };
    const { u, conn } = await atorWhatsapp();
    if (!conn || conn.status !== "conectado") return { ok: false, erro: "WhatsApp não está conectado." };
    const lead = await leadPorTelefone(numero);
    if (u.perfil === "corretor" && lead && lead.corretorId !== u.corretorId) return { ok: false, erro: "Conversa de outro corretor." };
    let externalId: string | null = null;
    if (conn.provedor === "evolution" && conn.instancia) {
      externalId = await enviarTextoEvolution(await exigirEvolution(), conn.instancia, numero, corpo);
    } else if (conn.token && conn.phoneNumberId) {
      externalId = await enviarWhatsappBusiness(conn.token, conn.phoneNumberId, numero, corpo);
    }
    await prisma.mensagemWhatsapp.create({
      data: {
        conexaoId: conn.id, leadId: lead?.id ?? null, destinatario: numero.replace(/\D/g, ""), nomeDestinatario: lead?.nome ?? null,
        mensagem: corpo, externalId, status: externalId ? "enviada" : "falhou", direcao: "saida", lida: true,
      },
    });
    if (!externalId) return { ok: false, erro: "O WhatsApp não aceitou a mensagem. Confira a conexão." };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: motivo(e) };
  }
}
