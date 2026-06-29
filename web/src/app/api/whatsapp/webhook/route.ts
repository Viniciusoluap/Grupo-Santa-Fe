import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHmac, timingSafeEqual } from "crypto";

function verifyHmac(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const rawBody = await req.text();
    const sig = req.headers.get("x-hub-signature-256")?.replace("sha256=", "") ?? "";
    if (!verifyHmac(rawBody, sig, webhookSecret)) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
    try {
      const body = JSON.parse(rawBody) as {
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
    } catch { /* ignore malformed */ }
    return NextResponse.json({ ok: true });
  }

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

