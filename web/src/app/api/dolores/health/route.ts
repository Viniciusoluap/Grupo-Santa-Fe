import { NextResponse } from "next/server";
import { getTecnoSpeedStatus } from "@/lib/dolores/tecnospeed";

export async function GET() {
  return NextResponse.json({
    center: "Centro de Operações da Dolores 9A",
    sourceSystem: "grupo_santa_fe",
    companyCode: "SFE",
    canonicalDatabase: "Supabase: grupo-santa-fe",
    mode: "read_only",
    sourceWriteBack: false,
    bpoWriteBack: false,
    financialWriteBack: false,
    providers: {
      tecnospeed: getTecnoSpeedStatus(),
    },
  });
}
