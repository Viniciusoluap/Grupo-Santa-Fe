import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTecnoSpeedStatus } from "@/lib/dolores/tecnospeed";

function authorized(request: NextRequest) {
  const expected = process.env.DOLORES_READ_TOKEN;
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-dolores-token") === expected;
}

async function count(model: { count: () => Promise<number> }) {
  try {
    return await model.count();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [imoveis, leads, obras, regularizacoes, incorporacoes, financiamentos, notificacoes] = await Promise.all([
    count(prisma.imovel),
    count(prisma.lead),
    count(prisma.obra),
    count(prisma.regularizacao),
    count(prisma.estudoIncorporacao),
    count(prisma.financiamento),
    count(prisma.notificacao),
  ]);

  return NextResponse.json({
    source: {
      system: "grupo_santa_fe",
      companyCode: "SFE",
      canonicalDatabase: "Supabase: grupo-santa-fe",
      capturedAt: new Date().toISOString(),
      mode: "read_only",
    },
    domains: {
      imoveis,
      leads,
      obras,
      regularizacoes,
      incorporacoes,
      financiamentos,
      notificacoes,
    },
    providers: {
      tecnospeed: getTecnoSpeedStatus(),
    },
    protections: {
      sourceWriteBack: false,
      bpoWriteBack: false,
      financialWriteBack: false,
      exclusiveUntouched: true,
    },
  });
}
