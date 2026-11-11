// Token PÚBLICO do Mapbox (opcional) para o satélite do mapa do terreno — pedido de 11/11.
// Idêntico no Prospecta (shared/geo/mapbox-token.ts) e no Grupo Santa Fé
// (web/src/lib/geo/mapbox-token.ts). Sem token, o mapa usa a Esri World Imagery
// e tudo continua funcionando; com token, usa o satélite do Mapbox (Maxar, até z22).
// Só aceitamos token público (pk.) — ele vai para o navegador, como no próprio Mapbox.

export const ATRIBUICAO_MAPBOX = "© Mapbox © OpenStreetMap © Maxar";

/** Limpa e valida o formato (pk.xxxxx.yyyyy). Token secreto (sk.) é recusado. */
export function normalizarTokenMapbox(bruto: unknown): string {
  const t = typeof bruto === "string" ? bruto.trim() : "";
  if (!t) throw new Error("Cole o token público do Mapbox (começa com pk.).");
  if (t.startsWith("sk.")) throw new Error("Esse é um token SECRETO (sk.). Use o token público (pk.) da sua conta Mapbox.");
  if (!/^pk\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(t)) throw new Error("Token do Mapbox inválido — deve começar com pk.");
  return t;
}

/** Confere o token no próprio Mapbox (API de tokens). Devolve a mensagem legível. */
export async function verificarTokenMapbox(token: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; mensagem: string }> {
  try {
    const r = await fetchImpl(`https://api.mapbox.com/tokens/v2?access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(10_000) });
    const j = (await r.json().catch(() => ({}))) as { code?: string; message?: string };
    if (j.code === "TokenValid") return { ok: true, mensagem: "Token do Mapbox válido — o mapa do terreno usará o satélite do Mapbox." };
    return { ok: false, mensagem: j.code === "TokenExpired" ? "Token do Mapbox expirado." : j.code === "TokenRevoked" ? "Token do Mapbox revogado." : `O Mapbox recusou o token${j.message ? `: ${j.message}` : ""}.` };
  } catch {
    return { ok: false, mensagem: "O Mapbox não respondeu. Tente de novo em instantes." };
  }
}

/** Ladrilhos raster de satélite do Mapbox em @2x (512 px) — nítidos em tela retina. */
export function urlSateliteMapbox(token: string): string {
  return `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${encodeURIComponent(token)}`;
}
