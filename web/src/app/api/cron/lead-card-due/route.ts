import { NextRequest, NextResponse } from "next/server";
import { enviarAvisosVencimentoCards } from "@/lib/crm/avisos-vencimento-card";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await enviarAvisosVencimentoCards()) }); }
  catch (error) { console.error("[cron/lead-card-due]", error); return NextResponse.json({ error: "Falha ao processar avisos" }, { status: 500 }); }
}
