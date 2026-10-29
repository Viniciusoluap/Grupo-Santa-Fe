import { NextResponse } from "next/server";
import { segredoConfere, sincronizarPorEvento, tokenWebhookAsaas } from "@/lib/bancos";

// Pedido de 25/10 (avisos em tempo real): qualquer evento autenticado do Asaas atualiza na hora o
// extrato das contas Asaas do BPO (mesma regra de Prospecta/server/asaas-webhook.ts). O token vem da
// env ASAAS_WEBHOOK_TOKEN (precedência) ou do salvo em Configurações › Integrações. Sem token: 401 (fechado).
export async function POST(req: Request) {
  let esperado: string | null = null;
  try { esperado = await tokenWebhookAsaas(); } catch (e) { console.error("[Asaas Webhook] token", e instanceof Error ? e.message : e); }
  if (!segredoConfere(req.headers.get("asaas-access-token"), esperado)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  let payload: unknown;
  try { payload = await req.json(); }
  catch { return NextResponse.json({ error: "Payload inválido" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || !("event" in payload) || typeof payload.event !== "string" || !payload.event.trim()) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED"].includes(payload.event)) {
    const payment = "payment" in payload ? payload.payment : null;
    if (!payment || typeof payment !== "object" || !("id" in payment)
      || typeof payment.id !== "string" || !payment.id.trim()) {
      return NextResponse.json({ error: "Pagamento inválido" }, { status: 400 });
    }
  }
  if (payload.event === "INTEGRATION_HEALTH_CHECK") return NextResponse.json({ received: true });
  await sincronizarPorEvento({ provedor: "asaas" }).catch((e) =>
    console.error("[Asaas Webhook] Bank sync failed:", e instanceof Error ? e.message : e));
  return NextResponse.json({ received: true });
}
