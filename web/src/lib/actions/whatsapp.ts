"use server";
import { auth } from "@/auth";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirModuloAcao, usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo, podeAdministrarSeguranca } from "@/lib/perfis-acesso";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";
import { configEvolution, urlServidorEvolution } from "@/lib/whatsapp/evolution-config";
import {
  enviarTextoEvolution, estadoInstancia, gerarQrCode, mesmoTelefone, numeroConectado, registrarWebhookEvolution,
} from "@/lib/evolution";
import { enviarWhatsappBusiness } from "@/lib/whatsapp/business";
import { valoresDosLeads } from "@/lib/whatsapp/valores-leads";
import { limparExtras, textosPorDestinatario } from "@/lib/whatsapp/variaveis";
import { URL_WEBHOOK_EVOLUTION, leadDoVinculo, leadPorTelefone, segredoWebhookEvolution } from "@/lib/whatsapp/webhook-evolution";
import {
  LEAD_ATIVO_WHATSAPP, PERIODOS_DASHBOARD, PERIODO_PADRAO, STATUS_ENVIO_SUCESSO, candidatosVinculo, chaveTelefone, inicioPeriodo, resolverLeadConversa, taxaLeitura,
  type LeadCandidato, type OrigemVinculo, type PeriodoDashboard,
} from "@/lib/whatsapp/conversas";
import { baixarEGuardarMidia, mensagemWhatsappAcessivel } from "@/lib/whatsapp/midia";
import { lixeiraDeArquivosSemUso } from "@/lib/drive-organizacao";
import { validarTemplateWhatsapp } from "@/lib/whatsapp/templates";

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

export async function salvarTemplateWhatsapp(input: { id?: string; nome: string; finalidade: string; conteudo: string }) {
  const u = await usuarioAtual();
  if (!u?.ativo || !podeAdministrarSeguranca(u)) throw new Error("Somente o administrador pode alterar templates.");
  const nome = input.nome.trim().slice(0, 120);
  const finalidade = input.finalidade.trim().slice(0, 80);
  const conteudo = input.conteudo.trim().slice(0, 4096);
  if (nome.length < 2 || finalidade.length < 2 || conteudo.length < 2) throw new Error("Preencha nome, finalidade e conteúdo.");
  validarTemplateWhatsapp(conteudo);
  if (input.id) {
    await prisma.whatsappTemplate.update({ where: { id: input.id }, data: { nome, finalidade, conteudo, atualizadoPorId: u.id } });
  } else {
    await prisma.whatsappTemplate.create({ data: { slug: `personalizado-${Date.now()}-${u.id}`, nome, finalidade, conteudo, criadoPorId: u.id, atualizadoPorId: u.id } });
  }
  revalidatePath("/admin/whatsapp");
}

/** Prévia por destinatário: mensagem final e variáveis que ainda faltam. */
export async function previaEnvioWhatsapp(mensagem: string, ids: string[], extras: Record<string, string> = {}, extrasPorLead: Record<string, Record<string, string>> = {}): Promise<{ itens: { id: string; texto: string; faltando: string[] }[]; erro?: string }> {
  try {
    const { u } = await atorWhatsapp();
    const pedidos = Array.from(new Set((Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === "string"))).slice(0, 200);
    // Lote 03, correção 03: lead excluído/arquivado no CRM some da prévia.
    const leads = await prisma.lead.findMany({
      where: { id: { in: pedidos }, ...LEAD_ATIVO_WHATSAPP, ...(u.perfil === "corretor" ? { corretorId: u.corretorId } : {}) },
      select: { id: true },
    });
    const permitidos = pedidos.filter((id) => leads.some((l) => l.id === id));
    const valores = await valoresDosLeads(permitidos, u.nome ?? null);
    return { itens: textosPorDestinatario(String(mensagem ?? "").slice(0, 4096), permitidos, valores, limparExtras(extras), extrasPorLead).previa };
  } catch (e) {
    return { itens: [], erro: motivo(e) };
  }
}

export async function imoveisParaEnvioWhatsapp(): Promise<{ id: string; texto: string }[]> {
  await atorWhatsapp();
  const itens = await prisma.imovel.findMany({ select: { id: true, titulo: true, rua: true, bairro: true, cidade: true }, orderBy: { titulo: "asc" }, take: 1000 });
  return itens.map((i) => ({ id: i.id, texto: [i.titulo, [i.rua, i.bairro, i.cidade].filter(Boolean).join(", ")].filter(Boolean).join(" — ") }));
}

export async function documentosParaEnvioWhatsapp(ids: string[]): Promise<{ id: string; pendentes: string[] }[]> {
  const { u } = await atorWhatsapp();
  const pedidos = Array.from(new Set(ids)).slice(0, 200);
  const leads = await prisma.lead.findMany({
    where: { id: { in: pedidos }, ...LEAD_ATIVO_WHATSAPP, ...(u.perfil === "corretor" ? { corretorId: u.corretorId } : {}) },
    select: { id: true },
  });
  const docs = await prisma.documentoCliente.findMany({ where: { leadId: { in: leads.map((l) => l.id) } }, select: { leadId: true, tipo: true, arquivoId: true } });
  const { DOCUMENTOS_CLIENTE } = await import("@/lib/documentos-cliente-padrao");
  return leads.map((l) => ({ id: l.id, pendentes: DOCUMENTOS_CLIENTE.filter((d) => d.chave !== "other" && !docs.some((x) => x.leadId === l.id && x.tipo === d.chave && x.arquivoId)).map((d) => d.chave) }));
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

export type ConversaWhatsapp = { numero: string; nome: string | null; leadId: string | null; vinculo: OrigemVinculo | null; ultima: string; quando: string; naoLidas: number };

const numeroValido = (n: unknown) => typeof n === "string" && n.replace(/\D/g, "").length >= 8 && n.length <= 20;

/** Ids dos leads de outro corretor (para esconder essas conversas de quem é corretor). */
async function leadsProibidos(u: { perfil: string | null | undefined; corretorId: string | null }, leadIds: string[]): Promise<Set<string>> {
  if (u.perfil !== "corretor" || !leadIds.length) return new Set();
  const outros = await prisma.lead.findMany({ where: { id: { in: leadIds }, NOT: { corretorId: u.corretorId } }, select: { id: true } });
  return new Set(outros.map((l) => l.id));
}

/** Lote 03, correção 02: vínculos manuais (botão "Vincular lead") da conexão, por chave do telefone. */
async function vinculosDaConexao(conexaoId: string): Promise<Map<string, string>> {
  const rows = await prisma.whatsappVinculoConversa.findMany({ where: { conexaoId }, select: { chaveTelefone: true, leadId: true } });
  return new Map(rows.map((r) => [r.chaveTelefone, r.leadId]));
}

async function vinculoManual(conexaoId: string, numero: string): Promise<string | null> {
  const v = await prisma.whatsappVinculoConversa.findUnique({ where: { conexaoId_chaveTelefone: { conexaoId, chaveTelefone: chaveTelefone(numero) } }, select: { leadId: true } });
  return v?.leadId ?? null;
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
        g = { numero: m.destinatario.replace(/\D/g, ""), nome: m.nomeDestinatario, leadId: m.leadId, vinculo: null, ultima: m.mensagem, quando: m.enviadaEm.toISOString(), naoLidas: 0 };
        grupos.push(g);
      }
      if (!g.nome && m.nomeDestinatario) g.nome = m.nomeDestinatario;
      if (!g.leadId && m.leadId) g.leadId = m.leadId;
      if (m.direcao === "entrada" && !m.lida) g.naoLidas++;
    }
    // Lote 03, correção 02: lead da conversa = vínculo manual > telefone > lead gravado (mesma regra da Prospecta).
    if (grupos.length) {
      const [contatos, vinculos] = await Promise.all([
        prisma.lead.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true, telefone: true }, orderBy: { criadoEm: "desc" } }),
        vinculosDaConexao(conn.id),
      ]);
      const porChave = new Map<string, string>();
      for (const l of contatos) { const k = chaveTelefone(l.telefone); if (k.length >= 10 && !porChave.has(k)) porChave.set(k, l.id); }
      const nomes = new Map(contatos.map((lead) => [lead.id, lead.nome]));
      for (const g of grupos) {
        const k = chaveTelefone(g.numero);
        const manual = vinculos.get(k);
        const r = resolverLeadConversa({ manual: manual && nomes.has(manual) ? manual : null, porTelefone: porChave.get(k), gravado: g.leadId });
        g.leadId = r.leadId;
        g.vinculo = r.origem;
        if (r.leadId && nomes.has(r.leadId)) g.nome = nomes.get(r.leadId)!;
      }
    }
    const proibidos = await leadsProibidos(u, grupos.flatMap((g) => (g.leadId ? [g.leadId] : [])));
    return { conversas: grupos.filter((g) => !g.leadId || !proibidos.has(g.leadId)) };
  } catch (e) {
    return { conversas: [], erro: motivo(e) };
  }
}

export type MidiaConversa = { tipo: string; mime: string | null; nome: string | null; tamanho: number | null; baixada: boolean };
export type MensagemConversa = { id: string; direcao: string; mensagem: string; status: string; quando: string; midia: MidiaConversa | null };

export async function mensagensConversaWhatsapp(numero: string): Promise<{ mensagens: MensagemConversa[]; erro?: string }> {
  try {
    if (!numeroValido(numero)) return { mensagens: [], erro: "Número inválido." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { mensagens: [] };
    const todas = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id }, include: { midia: { select: { mensagemId: true } } }, orderBy: { enviadaEm: "desc" }, take: 3000 });
    const da = todas.filter((m) => mesmoTelefone(m.destinatario, numero)).reverse();
    const manual = await vinculoManual(conn.id, numero);
    const proibidos = await leadsProibidos(u, manual ? [manual] : Array.from(new Set(da.flatMap((m) => (m.leadId ? [m.leadId] : [])))));
    if (proibidos.size) return { mensagens: [], erro: "Conversa de outro corretor." };
    const naoLidas = da.filter((m) => m.direcao === "entrada" && !m.lida).map((m) => m.id);
    if (naoLidas.length) await prisma.mensagemWhatsapp.updateMany({ where: { id: { in: naoLidas } }, data: { lida: true } });
    return { mensagens: da.map((m) => ({
      id: m.id, direcao: m.direcao, mensagem: m.mensagem, status: m.status, quando: m.enviadaEm.toISOString(),
      midia: m.midiaTipo ? { tipo: m.midiaTipo, mime: m.midiaMime, nome: m.midiaNome, tamanho: m.midiaTamanho, baixada: Boolean(m.midia) } : null,
    })) };
  } catch (e) {
    return { mensagens: [], erro: motivo(e) };
  }
}

/** Exclui somente os registros locais da conversa; nada é apagado no celular. */
export async function excluirConversaWhatsapp(numero: string): Promise<{ apagadas: number; erro?: string }> {
  try {
    if (!numeroValido(numero)) return { apagadas: 0, erro: "Número inválido." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { apagadas: 0, erro: "WhatsApp não está conectado." };
    const todas = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id }, select: { id: true, destinatario: true, leadId: true } });
    const da = todas.filter((m) => mesmoTelefone(m.destinatario, numero));
    const manual = await vinculoManual(conn.id, numero);
    const proibidos = await leadsProibidos(u, manual ? [manual] : Array.from(new Set(da.flatMap((m) => m.leadId ? [m.leadId] : []))));
    if (proibidos.size) return { apagadas: 0, erro: "Conversa de outro corretor." };
    const copias = da.length ? await prisma.whatsappMidia.findMany({ where: { mensagemId: { in: da.map((m) => m.id) }, driveFileId: { not: null } }, select: { driveFileId: true } }) : [];
    if (da.length) await prisma.mensagemWhatsapp.deleteMany({ where: { conexaoId: conn.id, id: { in: da.map((m) => m.id) } } });
    // Pedido de 29/10: as cópias das mídias no Drive vão para a lixeira (depois da exclusão no banco).
    await lixeiraDeArquivosSemUso(copias.map((c) => c.driveFileId));
    return { apagadas: da.length };
  } catch (e) { return { apagadas: 0, erro: motivo(e) }; }
}

/**
 * Lote 03, correção 01: o que a exclusão em lote vai apagar — só mensagens (e mídias, por cascata) da conexão,
 * das conversas escolhidas. Corretor: só conversas dos próprios leads ou sem lead (mesma resolução da lista);
 * se alguma for de outro corretor, nada é apagado. Gêmeo de planoExclusaoConversas (Prospecta).
 */
async function planoExclusaoConversas(u: { perfil: string | null | undefined; corretorId: string | null }, conexaoId: string, numeros: string[]) {
  const chaves = new Set(numeros.filter(numeroValido).map(chaveTelefone).filter((c) => c.length >= 10));
  const todas = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId }, select: { id: true, destinatario: true, leadId: true } });
  const porChave = new Map<string, { ids: string[]; gravado: string | null }>();
  for (const m of todas) {
    const k = chaveTelefone(m.destinatario);
    if (!chaves.has(k)) continue;
    const g = porChave.get(k) ?? { ids: [], gravado: null };
    g.ids.push(m.id);
    if (!g.gravado && m.leadId) g.gravado = m.leadId;
    porChave.set(k, g);
  }
  if (u.perfil === "corretor" && porChave.size) {
    const [vinculos, contatos] = await Promise.all([
      vinculosDaConexao(conexaoId),
      prisma.lead.findMany({ where: { excluidoEm: null }, select: { id: true, telefone: true }, orderBy: { criadoEm: "desc" } }),
    ]);
    const ids: string[] = [];
    for (const [k, g] of porChave) {
      const manual = vinculos.get(k);
      const { leadId } = resolverLeadConversa({
        manual: manual && contatos.some((l) => l.id === manual) ? manual : null,
        porTelefone: contatos.find((l) => chaveTelefone(l.telefone) === k)?.id,
        gravado: g.gravado,
      });
      if (leadId) ids.push(leadId);
    }
    if ((await leadsProibidos(u, Array.from(new Set(ids)))).size) throw new Error("Há conversa de lead de outro corretor na seleção. Nada foi excluído.");
  }
  const ids = Array.from(porChave.values()).flatMap((g) => g.ids);
  return { conversas: porChave.size, mensagens: ids.length, ids };
}

const listaNumeros = (numeros: unknown) => (Array.isArray(numeros) ? numeros : []).filter((n): n is string => numeroValido(n)).slice(0, 500);

/** Lote 03, correção 01: prévia da exclusão em lote (quantas conversas e mensagens). */
export async function previaExclusaoConversasWhatsapp(numeros: string[]): Promise<{ conversas: number; mensagens: number; erro?: string }> {
  try {
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { conversas: 0, mensagens: 0 };
    const p = await planoExclusaoConversas(u, conn.id, listaNumeros(numeros));
    return { conversas: p.conversas, mensagens: p.mensagens };
  } catch (e) { return { conversas: 0, mensagens: 0, erro: motivo(e) }; }
}

/**
 * Lote 03, correção 01: exclusão em lote — numa transação, apaga só as mensagens (e mídias, por cascata; as cópias no Drive vão para a lixeira) das
 * conversas escolhidas, nesta conexão. Não apaga no celular (a integração não permite), não toca em leads,
 * documentos nem vínculos. Auditoria: log estruturado sem dados pessoais (quem, quantas, quando).
 */
export async function excluirConversasWhatsapp(numeros: string[]): Promise<{ conversas: number; apagadas: number; erro?: string }> {
  try {
    const lista = listaNumeros(numeros);
    if (!lista.length) return { conversas: 0, apagadas: 0, erro: "Selecione ao menos uma conversa." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { conversas: 0, apagadas: 0, erro: "WhatsApp não está conectado." };
    const p = await planoExclusaoConversas(u, conn.id, lista);
    if (!p.ids.length) return { conversas: 0, apagadas: 0 };
    // Revisão do PR #242 (P2): como na exclusão unitária, as cópias das mídias no Drive são coletadas antes
    // (a cascata apaga whatsappMidia) e vão para a lixeira depois da transação (sem uso → lixeira; falha → fila).
    const copias = await prisma.$transaction(async (tx) => {
      const drive: (string | null)[] = [];
      for (let i = 0; i < p.ids.length; i += 1000) {
        const lote = p.ids.slice(i, i + 1000);
        drive.push(...(await tx.whatsappMidia.findMany({ where: { mensagemId: { in: lote }, driveFileId: { not: null } }, select: { driveFileId: true } })).map((c) => c.driveFileId));
        await tx.mensagemWhatsapp.deleteMany({ where: { conexaoId: conn.id, id: { in: lote } } });
      }
      return drive;
    });
    await lixeiraDeArquivosSemUso(copias);
    console.info(JSON.stringify({ evento: "whatsapp.conversas_excluidas", usuarioId: u.id, papel: u.perfil, conexaoId: conn.id, conversas: p.conversas, mensagens: p.mensagens, em: new Date().toISOString() }));
    return { conversas: p.conversas, apagadas: p.mensagens };
  } catch (e) { return { conversas: 0, apagadas: 0, erro: motivo(e) }; }
}

/**
 * Lote 03, correção 02: candidatos para vincular a conversa — leads não excluídos (corretor: os próprios), por
 * nome, telefone normalizado ou CPF. Sem termo, traz os que têm o mesmo telefone da conversa.
 */
export async function buscarLeadsParaVincularWhatsapp(numero: string, termo = ""): Promise<{ leads: (LeadCandidato & { mesmoTelefone: boolean })[]; erro?: string }> {
  try {
    if (!numeroValido(numero)) return { leads: [], erro: "Número inválido." };
    const { u } = await atorWhatsapp();
    const lista = await prisma.lead.findMany({
      where: { excluidoEm: null, ...(u.perfil === "corretor" ? { corretorId: u.corretorId } : {}) },
      select: { id: true, nome: true, telefone: true, cpf: true }, orderBy: { criadoEm: "desc" },
    });
    return { leads: candidatosVinculo(lista, String(termo ?? "").slice(0, 100), numero) };
  } catch (e) { return { leads: [], erro: motivo(e) }; }
}

/** Lote 03, correção 02: vincula (ou troca) o lead da conversa. Não altera o cadastro do lead. */
export async function vincularLeadWhatsapp(numero: string, leadId: string): Promise<{ leadId?: string; erro?: string }> {
  try {
    if (!numeroValido(numero) || typeof leadId !== "string" || !leadId) return { erro: "Dados inválidos." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { erro: "WhatsApp não está conectado." };
    const chave = chaveTelefone(numero);
    if (chave.length < 10) return { erro: "Número da conversa inválido." };
    const lead = await prisma.lead.findFirst({ where: { id: leadId, excluidoEm: null }, select: { id: true, corretorId: true } });
    if (!lead) return { erro: "Lead não encontrado ou excluído do CRM." };
    if (u.perfil === "corretor" && lead.corretorId !== u.corretorId) return { erro: "Esse lead é de outro corretor." };
    const msgs = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id }, select: { id: true, destinatario: true, leadId: true } });
    const da = msgs.filter((m) => chaveTelefone(m.destinatario) === chave);
    // Corretor não "toma" conversa já vinculada a lead de outro corretor.
    const atual = (await vinculoManual(conn.id, numero)) ?? da.find((m) => m.leadId)?.leadId ?? null;
    if (atual && (await leadsProibidos(u, [atual])).size) return { erro: "Conversa de outro corretor." };
    await prisma.$transaction(async (tx) => {
      await tx.whatsappVinculoConversa.upsert({
        where: { conexaoId_chaveTelefone: { conexaoId: conn.id, chaveTelefone: chave } },
        create: { conexaoId: conn.id, chaveTelefone: chave, leadId: lead.id, vinculadoPorId: u.id },
        update: { leadId: lead.id, vinculadoPorId: u.id, vinculadoEm: new Date() },
      });
      if (da.length) await tx.mensagemWhatsapp.updateMany({ where: { id: { in: da.map((m) => m.id) } }, data: { leadId: lead.id } });
    });
    return { leadId: lead.id };
  } catch (e) { return { erro: motivo(e) }; }
}

/** Lote 03, correção 02: desfaz o vínculo manual; a conversa volta a ser identificada pelo telefone. */
export async function desvincularLeadWhatsapp(numero: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    if (!numeroValido(numero)) return { ok: false, erro: "Número inválido." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { ok: false, erro: "WhatsApp não está conectado." };
    const chave = chaveTelefone(numero);
    const manual = await vinculoManual(conn.id, numero);
    if (!manual) return { ok: true };
    if ((await leadsProibidos(u, [manual])).size) return { ok: false, erro: "Conversa de outro corretor." };
    const msgs = await prisma.mensagemWhatsapp.findMany({ where: { conexaoId: conn.id, leadId: manual }, select: { id: true, destinatario: true } });
    const ids = msgs.filter((m) => chaveTelefone(m.destinatario) === chave).map((m) => m.id);
    await prisma.$transaction(async (tx) => {
      await tx.whatsappVinculoConversa.deleteMany({ where: { conexaoId: conn.id, chaveTelefone: chave } });
      if (ids.length) await tx.mensagemWhatsapp.updateMany({ where: { id: { in: ids } }, data: { leadId: null } });
    });
    return { ok: true };
  } catch (e) { return { ok: false, erro: motivo(e) }; }
}

/**
 * Lote 03, correção 04: indicadores do dashboard contados no banco (não sobre o histórico de 100).
 * Enviadas = saída com status enviada/entregue/lida (falhas fora); lidas e falhas no mesmo período.
 * Mesmo escopo do histórico: admin/colaborador veem tudo; corretor, a própria conexão.
 */
export async function resumoEnviosWhatsapp(periodo: PeriodoDashboard = PERIODO_PADRAO): Promise<{ periodo: PeriodoDashboard; desde: string | null; enviadas: number; lidas: number; falhas: number; taxaLeitura: number; erro?: string }> {
  const p: PeriodoDashboard = (PERIODOS_DASHBOARD as readonly string[]).includes(periodo) ? periodo : PERIODO_PADRAO;
  const desde = inicioPeriodo(p);
  const vazio = { periodo: p, desde: desde?.toISOString() ?? null, enviadas: 0, lidas: 0, falhas: 0, taxaLeitura: 0 };
  try {
    const { u, conn } = await atorWhatsapp();
    const todos = u.perfil === "admin" || u.perfil === "colaborador";
    if (!todos && !conn) return vazio;
    const base = { direcao: "saida", ...(todos ? {} : { conexaoId: conn!.id }), ...(desde ? { enviadaEm: { gte: desde } } : {}) };
    const [enviadas, lidas, falhas] = await Promise.all([
      prisma.mensagemWhatsapp.count({ where: { ...base, status: { in: [...STATUS_ENVIO_SUCESSO] } } }),
      prisma.mensagemWhatsapp.count({ where: { ...base, status: "lida" } }),
      prisma.mensagemWhatsapp.count({ where: { ...base, status: "falhou" } }),
    ]);
    return { ...vazio, enviadas, lidas, falhas, taxaLeitura: taxaLeitura(enviadas, lidas) };
  } catch (e) { return { ...vazio, erro: motivo(e) }; }
}

export async function baixarMidiaWhatsappDeNovo(id: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const msg = await mensagemWhatsappAcessivel(id);
    if (!msg?.midiaTipo) return { ok: false, erro: "Mensagem sem arquivo." };
    if (!msg.instancia || !msg.externalId) return { ok: false, erro: "Só dá para baixar de novo pela conexão por QR code." };
    const r = await baixarEGuardarMidia(msg.id, msg.instancia, msg.externalId, msg.midiaTamanho);
    return r.ok ? { ok: true } : { ok: false, erro: r.motivo };
  } catch (e) { return { ok: false, erro: motivo(e) }; }
}

/** Contato novo da conversa vira lead (nome do WhatsApp + telefone) e as mensagens passam a apontar para ele. */
// Lote 03, correção 02: antes de criar, avisa se já há lead não excluído com o mesmo telefone (evita
// duplicado); a tela oferece "Vincular lead" e só cria com `forcar`. O lead criado já fica vinculado.
export async function criarLeadDaConversaWhatsapp(numero: string, nome?: string, forcar = false): Promise<{ leadId?: string; erro?: string; duplicados?: number }> {
  try {
    if (!numeroValido(numero)) return { erro: "Número inválido." };
    const { u, conn } = await atorWhatsapp();
    if (!conn) return { erro: "WhatsApp não está conectado." };
    if (forcar !== true) {
      const d4 = numero.replace(/\D/g, "").slice(-4);
      const candidatos = await prisma.lead.findMany({ where: { excluidoEm: null, telefone: { contains: d4 } }, select: { telefone: true } });
      const iguais = candidatos.filter((l) => mesmoTelefone(l.telefone, numero)).length;
      if (iguais) return { duplicados: iguais, erro: `Já existe ${iguais === 1 ? "um lead" : `${iguais} leads`} com este telefone no CRM. Use "Vincular lead" para não duplicar.` };
    }
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
    const chave = chaveTelefone(numero);
    if (chave.length >= 10) {
      await prisma.whatsappVinculoConversa.upsert({
        where: { conexaoId_chaveTelefone: { conexaoId: conn.id, chaveTelefone: chave } },
        create: { conexaoId: conn.id, chaveTelefone: chave, leadId: lead.id, vinculadoPorId: u.id },
        update: { leadId: lead.id, vinculadoPorId: u.id, vinculadoEm: new Date() },
      });
    }
    revalidatePath("/admin/leads");
    revalidatePath("/admin/whatsapp");
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
    const lead = (await leadDoVinculo(conn.id, numero)) ?? await leadPorTelefone(numero);
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
