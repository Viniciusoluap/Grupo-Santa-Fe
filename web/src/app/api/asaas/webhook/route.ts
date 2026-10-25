import { NextResponse } from "next/server";
import { segredoConfere, sincronizarPorEvento, tokenWebhookAsaas } from "@/lib/bancos";

// Pedido de 25/10 (avisos em tempo real): qualquer evento autenticado do Asaas atualiza na hora o
// extrato das contas Asaas do BPO (mesma regra de Prospecta/server/asaas-webhook.ts). O token vem da
// configuração salva na tela (BPO › Bancos) ou da env ASAAS_WEBHOOK_TOKEN. Sem token: 401 (fechado).
export async function POST(req: Request) {
  let esperado: string | null = null;
  try { esperado = await tokenWebhookAsaas(); } catch (e) { console.error("[Asaas Webhook] token", e instanceof Error ? e.message : e); }
  if (!segredoConfere(req.headers.get("asaas-access-token"), esperado)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  await sincronizarPorEvento({ provedor: "asaas" }).catch((e) =>
    console.error("[Asaas Webhook] Bank sync failed:", e instanceof Error ? e.message : e));
  return NextResponse.json({ received: true });
}
