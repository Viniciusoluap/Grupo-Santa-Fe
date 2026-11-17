import { NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { tokenMapbox } from "@/lib/geo/mapbox-config";

export const runtime = "nodejs";

/** Configuração do mapa base: token público do Mapbox, se o admin tiver salvo um (opcional). Gêmeo do GET /api/incorporacao/mapa-base da Prospecta. */
export async function GET() {
  // Paridade 17/11 (EPIC-023 S-B da Prospecta): o Mapa operacional usa a mesma base — quem tem o módulo "mapa"
  // também lê o token público. Sem nenhum dos dois, recusa (403); sem sessão, 401.
  try { await exigirModuloAcao(["incorporacao", "mapa"]); }
  catch (e) {
    const semSessao = e instanceof Error && e.message === "Não autorizado.";
    return NextResponse.json({ error: semSessao ? "Entre novamente." : "Sem permissão para o mapa." }, { status: semSessao ? 401 : 403 });
  }
  const t = await tokenMapbox().catch(() => null);
  return NextResponse.json({ mapboxToken: t?.token ?? null });
}
