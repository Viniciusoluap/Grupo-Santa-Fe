const BASE = () => (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
const KEY = () => process.env.EVOLUTION_API_KEY ?? "";
const h = () => ({ "Content-Type": "application/json", apikey: KEY() });

export function evolutionConfigured(): boolean {
  return Boolean(BASE() && KEY());
}

export async function criarInstancia(instancia: string): Promise<boolean> {
  if (!evolutionConfigured()) return false;
  try {
    const res = await fetch(`${BASE()}/instance/create`, {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ instanceName: instancia, integration: "WHATSAPP-BAILEYS" }),
    });
    return res.ok;
  } catch { return false; }
}

export async function obterQrCode(instancia: string): Promise<string | null> {
  if (!evolutionConfigured()) return null;
  try {
    const res = await fetch(`${BASE()}/instance/connect/${instancia}`, { headers: h() });
    if (!res.ok) return null;
    const data = await res.json() as { base64?: string; code?: string };
    return data.base64 ?? null;
  } catch { return null; }
}

export async function verificarStatus(instancia: string): Promise<"open" | "close" | "connecting"> {
  if (!evolutionConfigured()) return "close";
  try {
    const res = await fetch(`${BASE()}/instance/connectionState/${instancia}`, { headers: h() });
    if (!res.ok) return "close";
    const data = await res.json() as { instance?: { state?: string } };
    const state = data.instance?.state;
    if (state === "open") return "open";
    if (state === "connecting") return "connecting";
    return "close";
  } catch { return "close"; }
}

export async function desconectarInstancia(instancia: string): Promise<void> {
  if (!evolutionConfigured()) return;
  try {
    await fetch(`${BASE()}/instance/delete/${instancia}`, { method: "DELETE", headers: h() });
  } catch { /* ignore */ }
}

export async function enviarTexto(instancia: string, numero: string, texto: string): Promise<string | null> {
  if (!evolutionConfigured()) return null;
  const num = numero.replace(/\D/g, "");
  const numFinal = num.startsWith("55") ? num : `55${num}`;
  try {
    const res = await fetch(`${BASE()}/message/sendText/${instancia}`, {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ number: numFinal, text: texto }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { key?: { id?: string } };
    return data.key?.id ?? null;
  } catch { return null; }
}
