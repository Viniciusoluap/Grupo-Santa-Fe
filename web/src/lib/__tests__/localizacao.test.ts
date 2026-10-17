import { describe, expect, it } from "vitest";
import { decodificarPlusCode, interpretarLocalizacao } from "@/lib/geo/localizacao";

// Pedido de 18/10 (item 7): todos os formatos de localização aceitos.
const ALVO = { lat: -5.36861, lng: -49.11722 };

function perto(entrada: string, tolerancia = 0.001) {
  const r = interpretarLocalizacao(entrada);
  expect(r.ok, `${entrada} → ${JSON.stringify(r)}`).toBe(true);
  if (!r.ok) return;
  expect(Math.abs(r.lat - ALVO.lat)).toBeLessThan(tolerancia);
  expect(Math.abs(r.lng - ALVO.lng)).toBeLessThan(tolerancia);
}

describe("interpretarLocalizacao", () => {
  it("decimal com ponto ou vírgula", () => {
    perto("-5.36861, -49.11722");
    perto("-5.36861,-49.11722");
    perto("-5,36861, -49,11722");
    perto("-5,36861; -49,11722");
    perto("-5.36861 -49.11722");
    perto("lat: -5.36861 lng: -49.11722");
  });

  it("graus, minutos e segundos (S/W/O, com e sem espaços, letra antes ou depois)", () => {
    perto(`5°22'07"S 49°07'02"W`);
    perto(`5º 22' 07.0" S, 49º 07' 02.0" O`);
    perto(`S 5°22'07" W 49°07'02"`);
    perto(`-5°22'07" -49°07'02"`);
    perto(`5°22’07”S 49°07’02”W`);
  });

  it("graus e minutos decimais", () => {
    perto(`5°22.117'S 49°07.033'W`);
    perto(`S 5° 22,117' W 49° 07,033'`);
  });

  it("links do Google Maps (@, q=, !3d!4d, place, search)", () => {
    perto("https://www.google.com/maps/@-5.36861,-49.11722,17z");
    perto("https://www.google.com/maps/place/Marab%C3%A1/@-5.3,-49.0,12z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-5.36861!4d-49.11722");
    perto("https://maps.google.com/?q=-5.36861,-49.11722");
    perto("https://www.google.com/maps/search/?api=1&query=-5.36861%2C-49.11722");
    perto("https://www.google.com/maps/place/-5.36861,-49.11722");
  });

  it("Waze, Apple Maps, OpenStreetMap e geo:", () => {
    perto("https://waze.com/ul?ll=-5.36861,-49.11722&navigate=yes");
    perto("https://www.waze.com/live-map/directions?to=ll.-5.36861%2C-49.11722");
    perto("https://maps.apple.com/?ll=-5.36861,-49.11722&q=Casa");
    perto("https://maps.apple.com/?coordinate=-5.36861,-49.11722");
    perto("https://www.openstreetmap.org/#map=17/-5.36861/-49.11722");
    perto("https://www.openstreetmap.org/?mlat=-5.36861&mlon=-49.11722#map=17/-5.3/-49.1");
    perto("geo:-5.36861,-49.11722");
  });

  it("Plus Code completo", () => {
    perto("686GJVJM+H4", 0.0005);
    const zurique = decodificarPlusCode("8FVC9G8F+6X");
    expect(zurique!.lat).toBeCloseTo(47.3655, 3);
    expect(zurique!.lng).toBeCloseTo(8.5248, 3);
  });

  it("link curto do Google é resolvido no servidor", () => {
    expect(interpretarLocalizacao("https://maps.app.goo.gl/AbCdEf123")).toEqual({ ok: false, linkCurto: "https://maps.app.goo.gl/AbCdEf123" });
    expect(interpretarLocalizacao("https://goo.gl/maps/AbCdEf123")).toEqual({ ok: false, linkCurto: "https://goo.gl/maps/AbCdEf123" });
  });

  it("erros claros, com exemplos", () => {
    const vazio = interpretarLocalizacao("");
    expect(vazio.ok).toBe(false);
    const ruim = interpretarLocalizacao("rua sem número");
    expect(ruim.ok).toBe(false);
    if (!ruim.ok && "erro" in ruim) expect(ruim.erro).toContain("Exemplos aceitos");
    const fora = interpretarLocalizacao("-95, 200");
    expect(fora.ok).toBe(false);
    const curto = interpretarLocalizacao("JVJM+H4 Marabá");
    expect(curto.ok).toBe(false);
  });
});

describe("resolverLinkCurto", () => {
  it("segue o redirecionamento do Google e lê as coordenadas", async () => {
    const { resolverLinkCurto } = await import("@/lib/geo/link-curto");
    const buscar = (async (url: URL) => {
      if (url.hostname === "maps.app.goo.gl")
        return new Response(null, { status: 302, headers: { location: "https://www.google.com/maps/place/Casa/@-5.36861,-49.11722,17z" } });
      throw new Error("não deveria chegar aqui");
    }) as unknown as typeof fetch;
    await expect(resolverLinkCurto("https://maps.app.goo.gl/abc", buscar)).resolves.toEqual({ lat: -5.36861, lng: -49.11722 });
  });

  it("não segue redirecionamento para fora do Google", async () => {
    const { resolverLinkCurto } = await import("@/lib/geo/link-curto");
    const chamadas: string[] = [];
    const buscar = (async (url: URL) => {
      chamadas.push(url.hostname);
      return new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest" } });
    }) as unknown as typeof fetch;
    await expect(resolverLinkCurto("https://maps.app.goo.gl/abc", buscar)).rejects.toThrow(/link curto/);
    expect(chamadas).toEqual(["maps.app.goo.gl"]);
  });
});
