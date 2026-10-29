import { NextRequest, NextResponse } from "next/server";
import { enviarAvisosVencimentoCards } from "@/lib/crm/avisos-vencimento-card";
import { sincronizarTodasContas } from "@/lib/bancos";
import { sincronizarDrive } from "@/lib/drive-organizacao";

// Pedido de 29/10: o "Organizar Drive" roda no fim deste cron diário (sem cron novo
// na Vercel, mesmo padrão dos bancos), com prazo para caber no limite da função.
export const maxDuration = 60;
const LIMITE_FUNCAO_MS = 55_000;

export async function GET(req: NextRequest) {
  const inicio = Date.now();
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
    const restante = LIMITE_FUNCAO_MS - (Date.now() - inicio);
    const drive = restante < 10_000 ? { adiado: true } : await sincronizarDrive({ prazoMs: Math.min(45_000, restante - 5_000) })
      .then((r) => ({ enviados: r.enviados, movidos: r.movidos, pastasOrfas: r.pastasOrfas, falhas: r.falhas, cicloConcluido: r.cicloConcluido }))
      .catch((e) => {
        console.error("[cron/drive]", e instanceof Error ? e.message : "falha");
        return { erro: true };
      });
    return NextResponse.json({ ok: true, ...avisos, bancos, drive });
  }
  catch (error) { console.error("[cron/lead-card-due]", error); return NextResponse.json({ error: "Falha ao processar avisos" }, { status: 500 }); }
}
