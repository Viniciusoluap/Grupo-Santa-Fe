import { NextResponse } from "next/server";
import { processarEventoEvolution, webhookEvolutionAutorizado, type EventoEvolution } from "@/lib/whatsapp/webhook-evolution";

// Pedido de 25/10 (Conversas): avisos da Evolution (mensagens recebidas, status, conexão). Aceita só
// com o cabeçalho x-webhook-token = HMAC-SHA256(AUTH_SECRET, "evolution-webhook"), registrado pelo
// próprio sistema. Gêmeo de Prospecta/server/whatsapp-evolution-webhook.ts.
export async function POST(req: Request) {
  if (!webhookEvolutionAutorizado(req.headers.get("x-webhook-token"))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const corpo = ((await req.json().catch(() => null)) ?? {}) as EventoEvolution;
  try {
    return NextResponse.json({ ok: true, r: await processarEventoEvolution(corpo) });
  } catch (e) {
    console.error("[Evolution Webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false });
  }
}
