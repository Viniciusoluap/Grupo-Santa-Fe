// Pedido de 18/10 (item 7): links curtos do Google Maps (maps.app.goo.gl,
// goo.gl/maps) não trazem as coordenadas — o servidor segue os
// redirecionamentos (só para domínios do Google) e lê o ponto do link final.
// Gêmeo de Prospecta/server/geo-router.ts.

import { hostDeMapaPermitido, interpretarLocalizacao, MENSAGEM_LOCALIZACAO_INVALIDA } from "./localizacao";

const MAX_SALTOS = 6;

export async function resolverLinkCurto(link: string, buscar: typeof fetch = fetch): Promise<{ lat: number; lng: number }> {
  let atual = link;
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    let url: URL;
    try {
      url = new URL(atual);
    } catch {
      break;
    }
    if (url.protocol !== "https:" || !hostDeMapaPermitido(url.hostname)) break;
    const lido = interpretarLocalizacao(url.toString());
    if (lido.ok) return { lat: lido.lat, lng: lido.lng };
    const resposta = await buscar(url, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0" } });
    const destino = resposta.headers.get("location");
    if (resposta.status >= 300 && resposta.status < 400 && destino) {
      atual = new URL(destino, url).toString();
      continue;
    }
    if (resposta.ok) {
      // Página final: o Google costuma trazer o link completo no HTML.
      const html = (await resposta.text()).slice(0, 500_000);
      const achado = html.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s<>]+/);
      if (achado) {
        const final = interpretarLocalizacao(achado[0].replace(/\\u0026/g, "&").replace(/&amp;/g, "&"));
        if (final.ok) return { lat: final.lat, lng: final.lng };
      }
    }
    break;
  }
  throw new Error("Não foi possível abrir este link curto. Abra o local no mapa e cole o link completo ou as coordenadas. " + MENSAGEM_LOCALIZACAO_INVALIDA);
}

