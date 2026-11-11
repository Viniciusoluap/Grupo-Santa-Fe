import { NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { tokenMapbox } from "@/lib/geo/mapbox-config";

export const runtime = "nodejs";

/** Configuração do mapa base: token público do Mapbox, se o admin tiver salvo um (opcional). Gêmeo do GET /api/incorporacao/mapa-base da Prospecta. */
export async function GET() {
  try { await exigirModuloAcao("incorporacao"); }
  catch { return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); }
  const t = await tokenMapbox().catch(() => null);
  return NextResponse.json({ mapboxToken: t?.token ?? null });
}
