import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      event?: string;
      data?: { key?: { id?: string }; status?: string };
    };

    if (body.event === "messages.update" && body.data?.key?.id) {
      const externalId = body.data.key.id;
      const rawStatus = (body.data.status ?? "").toLowerCase();
      let dbStatus = "enviada";
      if (rawStatus === "delivery_ack" || rawStatus === "delivered") dbStatus = "entregue";
      else if (rawStatus === "read") dbStatus = "lida";
      else if (rawStatus === "failed" || rawStatus === "error") dbStatus = "falhou";

      await prisma.mensagemWhatsapp.updateMany({ where: { externalId }, data: { status: dbStatus } });
    }
  } catch { /* ignore malformed payloads */ }

  return NextResponse.json({ ok: true });
}
