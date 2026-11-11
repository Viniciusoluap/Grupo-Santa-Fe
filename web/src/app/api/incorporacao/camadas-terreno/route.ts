import { NextRequest, NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { buscarCamadasTerreno, idsValidos, validarContorno } from "@/lib/geo/camadas-terreno-busca";

export const runtime = "nodejs";
export const maxDuration = 60;

// Mapa do terreno da Incorporação (pedido de 11/11): as camadas ambientais e de
// restrição são buscadas AQUI, no servidor (cache, timeout e espelho por fonte),
// e o navegador pede uma camada por vez para cada item da legenda ter estado próprio.
// Gêmeo de Prospecta/server/routes/camadas-terreno.ts.

export async function POST(req: NextRequest) {
  try { await exigirModuloAcao("incorporacao"); }
  catch (e) {
    const msg = e instanceof Error ? e.message : "Não autorizado.";
    return NextResponse.json({ error: msg }, { status: /permissão/i.test(msg) ? 403 : 401 });
  }
  const body = (await req.json().catch(() => null)) as { geojson?: unknown; ids?: unknown; novamente?: unknown } | null;
  let contorno;
  try { contorno = validarContorno(body?.geojson); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Contorno inválido." }, { status: 400 }); }
  try {
    const resposta = await buscarCamadasTerreno(contorno, idsValidos(body?.ids), { fetchImpl: (...a) => fetch(...a) }, { ignorarCache: body?.novamente === true });
    return NextResponse.json(resposta);
  } catch (erro) {
    console.error("[camadas-terreno]", erro);
    return NextResponse.json({ error: "Falha ao buscar as camadas." }, { status: 500 });
  }
}
