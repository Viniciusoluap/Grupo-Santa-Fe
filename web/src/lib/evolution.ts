// Pedido de 25/10: WhatsApp por QR code via Evolution API (Baileys) hospedada pelo dono (Railway),
// até a integração da Lógyca. Gêmeo de Prospecta/server/_core/evolution.ts.
export type EvolutionConfig = { url: string; apiKey: string };
type Fetch = typeof fetch;

const base = (c: EvolutionConfig) => c.url.trim().replace(/\/+$/, "");
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
  if (r.status === 401 || r.status === 403) throw new Error("A Evolution recusou a chave (AUTHENTICATION_API_KEY).");
  if (!r.ok) throw new Error(`A Evolution respondeu com erro (HTTP ${r.status}).`);
}

export type EstadoConexao = "open" | "connecting" | "close";

export async function estadoInstancia(c: EvolutionConfig, instancia: string, fetchImpl: Fetch = fetch): Promise<EstadoConexao | "inexistente"> {
  const r = await chamar<{ instance?: { state?: string } }>(c, `/instance/connectionState/${encodeURIComponent(instancia)}`, {}, fetchImpl);
  if (r.status === 404) return "inexistente";
  if (!r.ok) throw new Error(`A Evolution não informou o estado da conexão (HTTP ${r.status}).`);
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
    if (!r.ok) throw new Error(`A Evolution não criou a conexão (HTTP ${r.status}).`);
    if (r.data?.qrcode?.base64) return { qrCode: r.data.qrcode.base64, estado: "connecting" };
  }
  const r = await chamar<{ base64?: string }>(c, `/instance/connect/${encodeURIComponent(instancia)}`, {}, fetchImpl);
  if (!r.ok) throw new Error(`A Evolution não gerou o QR code (HTTP ${r.status}).`);
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
