// Token público do Mapbox (opcional) — 11/11. Sem rede: o fetch do Mapbox é simulado.
// Gêmeo de Prospecta/server/mapbox-token.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { normalizarTokenMapbox, urlSateliteMapbox, verificarTokenMapbox } from "@/lib/geo/mapbox-token";
import { CHAVE_SEGREDO_MAPBOX, limparCacheMapbox, removerTokenMapbox, salvarTokenMapbox, tokenMapbox, type MapboxDeps } from "@/lib/geo/mapbox-config";

const TOKEN = "pk.eyJ1IjoiZXhlbXBsbyIsImEiOiJjbGFiY2RlZmcifQ.AbCdEfGhIjKlMnOpQrStUv";
const respostaMapbox = (code: string) => (async () => new Response(JSON.stringify({ code }))) as unknown as typeof fetch;

function deps(code = "TokenValid", env?: string): MapboxDeps & { banco: Map<string, string> } {
  const banco = new Map<string, string>();
  return { banco, lerBanco: async k => banco.get(k), gravarBanco: async (k, v) => { banco.set(k, v); }, fetchImpl: respostaMapbox(code), env: () => env };
}

beforeEach(() => { limparCacheMapbox(); process.env.AUTH_SECRET ??= "segredo-de-teste"; });

describe("token do Mapbox", () => {
  it("aceita só token público (pk.) e recusa o secreto (sk.)", () => {
    expect(normalizarTokenMapbox(`  ${TOKEN} `)).toBe(TOKEN);
    expect(() => normalizarTokenMapbox("sk.abcdefghijkl.abcdefghijkl")).toThrow(/SECRETO/);
    expect(() => normalizarTokenMapbox("")).toThrow(/pk\./);
    expect(() => normalizarTokenMapbox("abc")).toThrow(/inválido/);
  });
  it("confere no Mapbox e traduz a recusa", async () => {
    expect((await verificarTokenMapbox(TOKEN, respostaMapbox("TokenValid"))).ok).toBe(true);
    expect((await verificarTokenMapbox(TOKEN, respostaMapbox("TokenExpired"))).mensagem).toMatch(/expirado/);
    const fora = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect((await verificarTokenMapbox(TOKEN, fora)).ok).toBe(false);
  });
  it("salva criptografado (nunca em texto puro), lê de volta e remove", async () => {
    const d = deps();
    await salvarTokenMapbox(TOKEN, d);
    expect(d.banco.get(CHAVE_SEGREDO_MAPBOX)).not.toContain(TOKEN);
    expect((await tokenMapbox(d))?.token).toBe(TOKEN);
    await removerTokenMapbox(d);
    expect(await tokenMapbox(d)).toBeNull();
  });
  it("token recusado pelo Mapbox não é salvo; variável de ambiente tem precedência; sem nada → null (Esri)", async () => {
    const d = deps("TokenInvalid");
    await expect(salvarTokenMapbox(TOKEN, d)).rejects.toThrow(/recusou/);
    expect(d.banco.size).toBe(0);
    expect(await tokenMapbox(deps("TokenValid", TOKEN))).toEqual({ token: TOKEN, fonte: "env" });
    expect(await tokenMapbox(deps())).toBeNull();
  });
  it("satélite em @2x", () => {
    expect(urlSateliteMapbox(TOKEN)).toContain("mapbox.satellite/{z}/{x}/{y}@2x");
  });
});
