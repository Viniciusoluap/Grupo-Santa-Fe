"use server";
import { auth } from "@/auth";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { donoDaConexaoWhatsApp } from "@/lib/whatsapp/dono-conexao";
import { configEvolution, salvarConfigEvolution, urlServidorEvolution } from "@/lib/whatsapp/evolution-config";
import { estadoInstancia, gerarQrCode, numeroConectado, testarEvolution } from "@/lib/evolution";

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
  if (!c) throw new Error("Informe primeiro o endereço e a chave do servidor da Evolution (Railway).");
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

export async function salvarServidorEvolution(url: string, apiKey: string): Promise<{ erro?: string }> {
  try { await salvarServidorEvolutionInterno(url, apiKey); return {}; } catch (e) { return { erro: motivo(e) }; }
}

async function salvarServidorEvolutionInterno(url: string, apiKey: string): Promise<void> {
  const { perfil } = await donoParaQr();
  if (perfil === "corretor") throw new Error("Só a equipe configura o servidor.");
  if (!/^https?:\/\/\S+$/i.test(url.trim())) throw new Error("Endereço inválido (comece com https://).");
  if (apiKey.trim().length < 8) throw new Error("Chave de acesso muito curta.");
  await testarEvolution({ url, apiKey });
  await salvarConfigEvolution(url, apiKey);
  revalidatePath("/admin/whatsapp");
}

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
    if (status === "conectado") numero = (await numeroConectado(c, conn.instancia).catch(() => null)) ?? numero;
    await prisma.conexaoWhatsApp.update({ where: { id: conn.id }, data: { status, numero } });
  }
  return { status, numero };
}
