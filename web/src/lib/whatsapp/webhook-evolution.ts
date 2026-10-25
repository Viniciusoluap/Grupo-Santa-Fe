import "server-only";
// Pedido de 25/10 (Conversas): avisos da Evolution — mensagens recebidas/enviadas pelo celular, status de
// entrega/leitura e estado da conexão. Só aceita com o cabeçalho secreto registrado pelo próprio sistema.
// Gêmeo de Prospecta/server/whatsapp-evolution-webhook.ts.
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { mesmoTelefone, textoDaMensagem } from "@/lib/evolution";

const SITE = () => (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.gruposantafee.com.br").replace(/\/+$/, "");
export const URL_WEBHOOK_EVOLUTION = () => `${SITE()}/api/whatsapp/evolution-webhook`;

/** Segredo do webhook, derivado do AUTH_SECRET (nada a configurar). */
export function segredoWebhookEvolution(): string {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET ausente.");
  return createHmac("sha256", process.env.AUTH_SECRET).update("evolution-webhook").digest("hex");
}

/** Comparação em tempo constante do cabeçalho recebido com o segredo. */
export function webhookEvolutionAutorizado(recebido: unknown): boolean {
  if (typeof recebido !== "string") return false;
  let esperado: string;
  try { esperado = segredoWebhookEvolution(); } catch { return false; }
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Status de entrega/leitura da Evolution → status gravado (mesma regra da Prospecta). */
export function normalizarStatusEvolution(raw: string | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s === "delivery_ack" || s === "delivered") return "entregue";
  if (s === "read" || s === "played") return "lida";
  if (s === "failed" || s === "error") return "falhou";
  return "enviada";
}

type ItemEvolution = {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  keyId?: string;
  status?: string;
  pushName?: string;
  message?: Parameters<typeof textoDaMensagem>[0];
};
export type EventoEvolution = { event?: string; instance?: string; data?: ItemEvolution | ItemEvolution[] | { state?: string } };

/** Lead com o mesmo telefone (DDD + 8 últimos dígitos), ignorando os excluídos. */
export async function leadPorTelefone(numero: string) {
  const d = numero.replace(/\D/g, "");
  if (d.length < 8) return null;
  const candidatos = await prisma.lead.findMany({
    where: { telefone: { contains: d.slice(-4) }, excluidoEm: null },
    select: { id: true, nome: true, telefone: true, corretorId: true },
    orderBy: { criadoEm: "desc" },
  });
  return candidatos.find((l) => mesmoTelefone(l.telefone, d)) ?? null;
}

export async function processarEventoEvolution(ev: EventoEvolution): Promise<string> {
  const evento = (ev.event ?? "").toLowerCase().replace(/_/g, ".");
  if (!ev.instance) return "sem-instancia";
  const conn = await prisma.conexaoWhatsApp.findFirst({ where: { instancia: ev.instance } });
  if (!conn) return "conexao-desconhecida";

  if (evento === "connection.update") {
    const st = (ev.data as { state?: string } | undefined)?.state;
    const status = st === "open" ? "conectado" : st === "connecting" ? "aguardando_qr" : "desconectado";
    await prisma.conexaoWhatsApp.update({ where: { id: conn.id }, data: { status } });
    return "conexao";
  }

  const itens = (Array.isArray(ev.data) ? ev.data : [ev.data]) as (ItemEvolution | undefined)[];

  if (evento === "messages.update") {
    for (const d of itens) {
      const id = d?.keyId ?? d?.key?.id;
      if (!id || !d?.status) continue;
      await prisma.mensagemWhatsapp.updateMany({ where: { conexaoId: conn.id, externalId: id }, data: { status: normalizarStatusEvolution(String(d.status)) } });
    }
    return "status";
  }

  if (evento === "messages.upsert") {
    let novas = 0;
    for (const d of itens) {
      const jid = d?.key?.remoteJid ?? "";
      if (!jid.endsWith("@s.whatsapp.net")) continue; // ignora grupos, status e listas
      const id = d?.key?.id;
      if (id) {
        const ja = await prisma.mensagemWhatsapp.findFirst({ where: { conexaoId: conn.id, externalId: id }, select: { id: true } });
        if (ja) continue; // enviada pelo sistema (já gravada) ou repetida
      }
      const numero = jid.split("@")[0];
      const deMim = Boolean(d?.key?.fromMe);
      const lead = await leadPorTelefone(numero);
      const texto = textoDaMensagem(d?.message);
      await prisma.mensagemWhatsapp.create({
        data: {
          conexaoId: conn.id, leadId: lead?.id ?? null, destinatario: numero,
          nomeDestinatario: lead?.nome ?? d?.pushName ?? null, mensagem: texto.slice(0, 4000),
          externalId: id ?? null, status: deMim ? "enviada" : "recebida", direcao: deMim ? "saida" : "entrada", lida: deMim,
        },
      });
      if (!deMim) {
        novas++;
        await prisma.notificacao.create({
          data: {
            usuarioId: conn.usuarioId, tipo: "whatsapp_mensagem",
            titulo: `WhatsApp: nova mensagem de ${lead?.nome ?? d?.pushName ?? numero}`,
            mensagem: texto.slice(0, 300),
            link: `/admin/whatsapp?aba=conversas&numero=${numero}`,
          },
        });
      }
    }
    return `mensagens:${novas}`;
  }
  return "ignorado";
}
