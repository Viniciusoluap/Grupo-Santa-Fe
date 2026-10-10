import { NextRequest, NextResponse } from "next/server";
import { checkAndSendReminder } from "@/lib/mcmv-reminder";

// Chamada periodicamente pelo Vercel Cron (ver vercel.json). Next.js em
// produção na Vercel roda cada rota como função serverless — sem processo
// persistente, um setInterval não funcionaria aqui.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    await checkAndSendReminder();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[cron/mcmv-reminder]", err);
    return NextResponse.json({ error: "Erro interno", detail }, { status: 500 });
  }
}
