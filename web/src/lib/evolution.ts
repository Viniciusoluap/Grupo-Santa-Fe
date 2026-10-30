// Pedido de 25/10: WhatsApp por QR code via Evolution API (Baileys) hospedada pelo dono (Railway),
// até a integração da Lógyca. Gêmeo de Prospecta/server/_core/evolution.ts.
import { chaveTelefone } from "@/lib/whatsapp/conversas";
export type EvolutionConfig = { url: string; apiKey: string };
type Fetch = typeof fetch;

/** Pedido de 25/10: o Railway só aceita https (http redireciona e o POST vira GET → 404) e /manager é o painel. */
export function normalizarUrlEvolution(url: string): string {
  let u = url.trim().replace(/\/+$/, "").replace(/\/manager$/i, "");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/^http:\/\//i, "https://");
}
const base = (c: EvolutionConfig) => normalizarUrlEvolution(c.url);

/** Motivo legível devolvido pela Evolution ({ response: { message: [...] } } ou { message }). */
function motivo(data: unknown): string {
  const d = data as { response?: { message?: unknown }; message?: unknown; error?: unknown } | null;
  const m = d?.response?.message ?? d?.message ?? d?.error;
  const t = Array.isArray(m) ? m.flat().join("; ") : typeof m === "string" ? m : "";
  return t ? `: ${t.slice(0, 200)}` : "";
}
const headers = (c: EvolutionConfig) => ({ "Content-Type": "application/json", apikey: c.apiKey.trim() });

async function chamar<T>(c: EvolutionConfig, caminho: string, init: RequestInit = {}, fetchImpl: Fetch = fetch): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetchImpl(`${base(c)}${caminho}`, { ...init, headers: { ...headers(c), ...(init.headers ?? {}) } });
  let data: T | null = null;
  try { data = (await res.json()) as T; } catch { /* corpo vazio */ }
  return { ok: res.ok, status: res.status, data };
}

/** Confere se o servidor responde e aceita a chave (lista as instâncias). */
export async function testarEvolution(c: EvolutionConfig, fetchImpl: Fetch = fetch): Promise<void> {
  let r;
  try { r = await chamar(c, "/instance/fetchInstances", {}, fetchImpl); }
  catch { throw new Error("Não consegui falar com o servidor da Evolution. Confira o endereço."); }
  if (r.status === 401 || r.status === 403) throw new Error(`A Evolution recusou a chave (HTTP ${r.status})${motivo(r.data)}. Confira a AUTHENTICATION_API_KEY.`);
  if (!r.ok) throw new Error(`A Evolution respondeu com erro (HTTP ${r.status})${motivo(r.data)}.`);
  if (!Array.isArray(r.data)) throw new Error("Esse endereço não é a API da Evolution (use o endereço do serviço, sem /manager).");
}

export type EstadoConexao = "open" | "connecting" | "close";

export async function estadoInstancia(c: EvolutionConfig, instancia: string, fetchImpl: Fetch = fetch): Promise<EstadoConexao | "inexistente"> {
  const r = await chamar<{ instance?: { state?: string } }>(c, `/instance/connectionState/${encodeURIComponent(instancia)}`, {}, fetchImpl);
  if (r.status === 404) return "inexistente";
  if (!r.ok) throw new Error(`A Evolution não informou o estado da conexão (HTTP ${r.status})${motivo(r.data)}.`);
  const s = r.data?.instance?.state;
  return s === "open" ? "open" : s === "connecting" ? "connecting" : "close";
}

/** Cria a instância se não existir e devolve o QR code (imagem base64) para escanear. */
export async function gerarQrCode(c: EvolutionConfig, instancia: string, fetchImpl: Fetch = fetch): Promise<{ qrCode: string | null; estado: EstadoConexao }> {
  const estado = await estadoInstancia(c, instancia, fetchImpl);
  if (estado === "open") return { qrCode: null, estado };
  if (estado === "inexistente") {
    const r = await chamar<{ qrcode?: { base64?: string } }>(c, "/instance/create", {
      method: "POST",
      body: JSON.stringify({ instanceName: instancia, integration: "WHATSAPP-BAILEYS", qrcode: true }),
    }, fetchImpl);
    if (!r.ok) throw new Error(`A Evolution não criou a conexão (HTTP ${r.status})${motivo(r.data)}.`);
    if (r.data?.qrcode?.base64) return { qrCode: r.data.qrcode.base64, estado: "connecting" };
  }
  const r = await chamar<{ base64?: string }>(c, `/instance/connect/${encodeURIComponent(instancia)}`, {}, fetchImpl);
  if (!r.ok) throw new Error(`A Evolution não gerou o QR code (HTTP ${r.status})${motivo(r.data)}.`);
  return { qrCode: r.data?.base64 ?? null, estado: "connecting" };
}

/** Número conectado (ownerJid "5599...@s.whatsapp.net" → "5599..."). */
export async function numeroConectado(c: EvolutionConfig, instancia: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const r = await chamar<Array<{ ownerJid?: string; owner?: string; instance?: { owner?: string } }>>(
    c, `/instance/fetchInstances?instanceName=${encodeURIComponent(instancia)}`, {}, fetchImpl);
  const i = Array.isArray(r.data) ? r.data[0] : null;
  const jid = i?.ownerJid ?? i?.owner ?? i?.instance?.owner ?? "";
  return jid ? jid.split("@")[0] : null;
}

export async function removerInstancia(c: EvolutionConfig, instancia: string, fetchImpl: Fetch = fetch): Promise<void> {
  await chamar(c, `/instance/logout/${encodeURIComponent(instancia)}`, { method: "DELETE" }, fetchImpl).catch(() => undefined);
  await chamar(c, `/instance/delete/${encodeURIComponent(instancia)}`, { method: "DELETE" }, fetchImpl).catch(() => undefined);
}

export async function enviarTextoEvolution(c: EvolutionConfig, instancia: string, numero: string, texto: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const num = numero.replace(/\D/g, "");
  const r = await chamar<{ key?: { id?: string } }>(c, `/message/sendText/${encodeURIComponent(instancia)}`, {
    method: "POST",
    body: JSON.stringify({ number: num.startsWith("55") ? num : `55${num}`, text: texto }),
  }, fetchImpl);
  return r.ok ? (r.data?.key?.id ?? null) : null;
}

/**
 * Pedido de 25/10 (Conversas): a Evolution passa a avisar o sistema de mensagens recebidas, status de
 * entrega/leitura e da conexão. Cabeçalho secreto para o sistema aceitar só avisos legítimos.
 */
export async function registrarWebhookEvolution(c: EvolutionConfig, instancia: string, url: string, segredo: string, fetchImpl: Fetch = fetch): Promise<void> {
  const r = await chamar(c, `/webhook/set/${encodeURIComponent(instancia)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url,
        headers: { "x-webhook-token": segredo },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
      },
    }),
  }, fetchImpl);
  if (!r.ok) throw new Error(`A Evolution não aceitou o aviso de mensagens (HTTP ${r.status})${motivo(r.data)}.`);
}

type MensagemEvolution = {
  conversation?: unknown;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string };
  videoMessage?: { caption?: string };
  documentMessage?: { fileName?: string };
  documentWithCaptionMessage?: { message?: { documentMessage?: { fileName?: string } } };
  audioMessage?: unknown;
  stickerMessage?: unknown;
  locationMessage?: unknown;
  contactMessage?: unknown;
};

/** Texto legível de uma mensagem recebida (texto, legenda ou tipo de mídia). */
export function textoDaMensagem(message: MensagemEvolution | undefined | null): string {
  if (!message) return "";
  if (typeof message.conversation === "string") return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage) return message.imageMessage.caption ? `[imagem] ${message.imageMessage.caption}` : "[imagem]";
  if (message.videoMessage) return message.videoMessage.caption ? `[vídeo] ${message.videoMessage.caption}` : "[vídeo]";
  if (message.documentMessage) return `[documento] ${message.documentMessage.fileName ?? ""}`.trim();
  if (message.documentWithCaptionMessage?.message?.documentMessage) return `[documento] ${message.documentWithCaptionMessage.message.documentMessage.fileName ?? ""}`.trim();
  if (message.audioMessage) return "[áudio]";
  if (message.stickerMessage) return "[figurinha]";
  if (message.locationMessage) return "[localização]";
  if (message.contactMessage) return "[contato]";
  return "[mensagem]";
}

/** Mesmo telefone? Compara DDD + 8 últimos dígitos (o WhatsApp às vezes omite o 9º dígito). */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = chaveTelefone(a), y = chaveTelefone(b);
  return Boolean(x) && x === y;
}

export type TipoMidia = "imagem" | "audio" | "video" | "documento" | "figurinha";
export const LIMITE_MIDIA = 10 * 1024 * 1024;

function tamanhoDeclarado(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  const l = v as { low?: number; high?: number } | null;
  if (l && typeof l.low === "number") return (l.high ?? 0) * 2 ** 32 + (l.low >>> 0);
  return null;
}

export function midiaDaMensagem(entrada: unknown): { tipo: TipoMidia; mime: string | null; nome: string | null; tamanho: number | null } | null {
  if (!entrada || typeof entrada !== "object") return null;
  const message = entrada as Record<string, unknown>;
  const pares: [string, TipoMidia, string][] = [
    ["imageMessage", "imagem", "image/jpeg"], ["audioMessage", "audio", "audio/ogg"], ["videoMessage", "video", "video/mp4"],
    ["documentMessage", "documento", "application/octet-stream"], ["stickerMessage", "figurinha", "image/webp"],
  ];
  const embrulho = message.documentWithCaptionMessage as { message?: { documentMessage?: unknown } } | undefined;
  const doc = embrulho?.message?.documentMessage;
  for (const [chave, tipo, padrao] of pares) {
    const bruto = chave === "documentMessage" ? (message.documentMessage ?? doc) : message[chave];
    if (!bruto || typeof bruto !== "object") continue;
    const m = bruto as { mimetype?: unknown; fileName?: unknown; fileLength?: unknown };
    const mime = typeof m.mimetype === "string" ? m.mimetype.split(";")[0].trim().slice(0, 120) : padrao;
    const nome = typeof m.fileName === "string" ? m.fileName.slice(0, 255) : null;
    return { tipo, mime: mime || padrao, nome, tamanho: tamanhoDeclarado(m.fileLength) };
  }
  return null;
}

export async function baixarMidiaEvolution(c: EvolutionConfig, instancia: string, externalId: string, fetchImpl: Fetch = fetch): Promise<{ base64: string; mime: string | null; nome: string | null } | null> {
  const r = await chamar<{ base64?: string; mimetype?: string; fileName?: string }>(c, `/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, {
    method: "POST",
    body: JSON.stringify({ message: { key: { id: externalId } }, convertToMp4: false }),
    signal: AbortSignal.timeout(20_000),
  }, fetchImpl);
  if (!r.ok) throw new Error(`A Evolution não entregou o arquivo (HTTP ${r.status})${motivo(r.data)}.`);
  const bruto = typeof r.data?.base64 === "string" ? r.data.base64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "") : "";
  if (!bruto) return null;
  return {
    base64: bruto,
    mime: typeof r.data?.mimetype === "string" ? r.data.mimetype.split(";")[0].trim().slice(0, 120) || null : null,
    nome: typeof r.data?.fileName === "string" ? r.data.fileName.slice(0, 255) : null,
  };
}
