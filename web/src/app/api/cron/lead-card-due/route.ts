import { NextRequest, NextResponse } from "next/server";
import { enviarAvisosVencimentoCards } from "@/lib/crm/avisos-vencimento-card";
import { sincronizarTodasContas } from "@/lib/bancos";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const avisos = await enviarAvisosVencimentoCards();
    // Pedido de 25/10 (igual à Prospecta): sincronização diária das contas bancárias
    // (Asaas/Pluggy) no mesmo cron diário, sem criar cron novo.
    const bancos = await sincronizarTodasContas().catch((e) => {
      console.error("[cron/bancos]", e instanceof Error ? e.message : e);
      return { erro: true };
    });
    return NextResponse.json({ ok: true, ...avisos, bancos });
  }
  catch (error) { console.error("[cron/lead-card-due]", error); return NextResponse.json({ error: "Falha ao processar avisos" }, { status: 500 }); }
}
