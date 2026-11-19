// Paridade 17/11 (bloco 2) — porte de Prospecta `server/incorporacao-app-contorno.test.ts` (EPIC-023 S-I).
// Lá o teste chama o router tRPC com PGlite; aqui chama as server actions (`salvarApp`, `uploadKml`) com um prisma
// simulado em memória (a migração em si é conferida com PGlite em incorporacao-massa-app-geometria.test.ts).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = { appAreaM2: number | null; appContornoJson: string | null; geojson: string | null };
const banco: { linha: Linha } = { linha: { appAreaM2: null, appContornoJson: null, geojson: null } };

vi.mock("@/lib/auth/modulos", () => ({ exigirModuloAcao: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/blob", () => ({ uploadPublico: vi.fn(async () => ({ url: null, erro: "sem blob" })) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    estudoIncorporacao: {
      findUnique: vi.fn(async () => ({ appAreaM2: banco.linha.appAreaM2 })),
      update: vi.fn(async ({ data }: { data: Partial<Linha> }) => { Object.assign(banco.linha, data); return banco.linha; }),
    },
  },
}));

const KML = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>
  -47.500,-5.520,0 -47.499,-5.520,0 -47.499,-5.519,0 -47.500,-5.519,0 -47.500,-5.520,0
</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
const CONTORNO = { type: "MultiPolygon" as const, coordinates: [[[[-47.5, -5.52], [-47.4995, -5.52], [-47.4995, -5.519], [-47.5, -5.519], [-47.5, -5.52]]]] };

beforeEach(() => { banco.linha = { appAreaM2: null, appContornoJson: null, geojson: null }; });

describe("S-I — contorno da APP nas actions (paridade com o router da Prospecta)", () => {
  it("salvarApp grava o contorno; cliente antigo sem o campo mantém; área mudando > 2% sem contorno apaga; null apaga", async () => {
    const { salvarApp } = await import("@/lib/actions/incorporacao");
    await salvarApp("e1", { areaM2: 5000, larguraM: 30, origem: "auto", contorno: CONTORNO });
    expect(JSON.parse(banco.linha.appContornoJson!)).toEqual(CONTORNO);
    await salvarApp("e1", { areaM2: 5050, larguraM: 30, origem: "auto" });
    expect(banco.linha.appContornoJson).not.toBeNull();
    await salvarApp("e1", { areaM2: 6000, larguraM: 30, origem: "auto" });
    expect(banco.linha.appContornoJson).toBeNull();
    await salvarApp("e1", { areaM2: 6000, larguraM: 30, origem: "auto", contorno: CONTORNO });
    await salvarApp("e1", { areaM2: 6000, larguraM: 30, origem: "auto", contorno: null });
    expect(banco.linha.appContornoJson).toBeNull();
  });

  it("salvarApp recusa contorno com coordenada fora de longitude/latitude", async () => {
    const { salvarApp } = await import("@/lib/actions/incorporacao");
    await expect(salvarApp("e1", { areaM2: 5000, larguraM: 30, origem: "auto", contorno: { type: "MultiPolygon", coordinates: [[[[500, 1], [1, 1], [1, 2], [500, 1]]]] } })).rejects.toThrow();
    expect(banco.linha.appAreaM2).toBeNull();
  });

  it("trocar o KML apaga o contorno da APP (era do terreno anterior) e mantém a área até o mapa recalcular", async () => {
    const { salvarApp, uploadKml } = await import("@/lib/actions/incorporacao");
    await salvarApp("e1", { areaM2: 5000, larguraM: 30, origem: "auto", contorno: CONTORNO });
    const fd = new FormData();
    fd.set("kml", new File([KML], "terreno.kml", { type: "application/vnd.google-earth.kml+xml" }));
    const r = await uploadKml("e1", fd);
    expect(r).toMatchObject({ ok: true });
    expect(banco.linha.appContornoJson).toBeNull();
    expect(banco.linha.appAreaM2).toBe(5000);
  });
});
