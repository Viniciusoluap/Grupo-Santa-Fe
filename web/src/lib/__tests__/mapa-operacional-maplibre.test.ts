// Paridade 17/11, bloco 1 — EPIC-023 S-B (correção 4) da Prospecta, commit 2cb1fd2: Mapa operacional no MapLibre.
// Cenários da story: quem tem o Mapa operacional (sem Incorporação) lê o token do mapa base; quem não tem nenhum
// dos dois é recusado; a tela mantém Satélite/Ruas, legenda e o contêiner do mapa (Leaflet saiu).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sessao: null as null | { user: { id: string; role: string; permissoes?: string[]; ativo?: boolean } },
  token: vi.fn(async () => ({ token: "pk.publico" })),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => m.sessao) }));
vi.mock("@/lib/geo/mapbox-config", () => ({ tokenMapbox: m.token }));
vi.mock("@/app/admin/incorporacao/_components/mapa-base-ml", () => ({ criarMapaBase: vi.fn(), aplicarBase: vi.fn() }));

import { GET } from "@/app/api/incorporacao/mapa-base/route";
import { PropertyMap } from "@/components/map/property-map";

const src = resolve(__dirname, "../..");

describe("token do mapa base (GET /api/incorporacao/mapa-base)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("colaborador só com o Mapa operacional carrega o mapa", async () => {
    m.sessao = { user: { id: "c1", role: "colaborador", permissoes: ["mapa"] } };
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ mapboxToken: "pk.publico" });
  });

  it("colaborador só com a Incorporação continua carregando", async () => {
    m.sessao = { user: { id: "c1", role: "colaborador", permissoes: ["incorporacao"] } };
    expect((await GET()).status).toBe(200);
  });

  it("sem nenhum dos dois módulos é recusado (403) e o token não é lido", async () => {
    m.sessao = { user: { id: "c1", role: "colaborador", permissoes: ["obras", "leads"] } };
    const r = await GET();
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "Sem permissão para o mapa." });
    expect(m.token).not.toHaveBeenCalled();
  });

  it("corretor (módulos fixos, sem mapa) e sessão ausente são recusados", async () => {
    m.sessao = { user: { id: "k1", role: "corretor" } };
    expect((await GET()).status).toBe(403);
    m.sessao = null;
    expect((await GET()).status).toBe(401);
  });

  it("sem token salvo, devolve null (o mapa usa o satélite Esri, como na Incorporação)", async () => {
    m.sessao = { user: { id: "a1", role: "admin" } };
    m.token.mockResolvedValueOnce(null as never);
    expect(await (await GET()).json()).toEqual({ mapboxToken: null });
  });
});

describe("tela do Mapa operacional no MapLibre", () => {
  beforeEach(() => { Object.assign(globalThis, { React }); });

  it("mantém Satélite/Ruas (satélite por padrão), legenda e o contêiner do mapa", () => {
    const html = renderToStaticMarkup(React.createElement(PropertyMap, { pins: [], height: "480px", legenda: true }));
    expect(html).toContain('data-testid="mapa-operacional"');
    expect(html).toMatch(/<button type="button" aria-pressed="true"[^>]*>Satélite<\/button>/);
    expect(html).toMatch(/<button type="button" aria-pressed="false"[^>]*>Ruas<\/button>/);
    for (const r of ["Imóvel disponível", "Imóvel reservado", "Obra"]) expect(html).toContain(r);
    expect(html).toContain("pontos agrupados");
  });

  it("Leaflet saiu do Mapa operacional (o helper antigo foi removido, sem outro consumidor)", () => {
    expect(existsSync(resolve(src, "lib/mapa-leaflet.ts"))).toBe(false);
    const fonte = readFileSync(resolve(src, "components/map/property-map.tsx"), "utf8");
    expect(fonte).toContain("criarMapaBase");
    expect(fonte).not.toMatch(/from "leaflet|leaflet\.markercluster/);
    // Nada do cadastro vira HTML no popup.
    const usosDeHtml = [...fonte.matchAll(/innerHTML\s*=\s*([\w.]+)/g)].map((x) => x[1]);
    expect(usosDeHtml).toEqual(["htmlAlfinete"]);
  });
});
