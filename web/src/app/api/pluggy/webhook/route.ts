import { NextResponse } from "next/server";
import { segredoConfere, segredoWebhookPluggy, sincronizarPorEvento } from "@/lib/bancos";

// Pedido de 25/10 (avisos em tempo real): a Pluggy avisa quando a conexão (item) tem dados novos
// e o sistema sincroniza na hora as contas daquela conexão. Cabeçalho secreto registrado por nós
// (HMAC do AUTH_SECRET). Gêmeo de Prospecta/server/pluggy-webhook.ts.
const EVENTOS = new Set(["item/updated", "item/created", "transactions/created", "transactions/updated", "transactions/deleted"]);

export async function POST(req: Request) {
  let esperado: string;
  try { esperado = segredoWebhookPluggy(); } catch { return NextResponse.json({ error: "Não autorizado" }, { status: 401 }); }
  if (!segredoConfere(req.headers.get("x-webhook-token"), esperado)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { event, itemId } = ((await req.json().catch(() => null)) ?? {}) as { event?: string; itemId?: string };
  if (!event || !itemId || !EVENTOS.has(event)) return NextResponse.json({ ignorado: true });
  try {
    const r = await sincronizarPorEvento({ provedor: "pluggy", itemId: String(itemId) });
    return NextResponse.json({ ok: true, contas: r.length });
  } catch (e) {
    console.error("[Pluggy Webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false });
  }
}
