// Lote 02, correção 05 — regras do Mapa Operacional (alfinetes, agrupamento,
// camadas). Mesmo conteúdo em Prospecta/server/mapa-alfinetes.test.ts.
import { describe, expect, it } from "vitest";
import { CAMADAS_MAPA, CATEGORIAS_PONTO, categoriaDoPonto, coordenadaValida, estiloAgrupamento, htmlAlfinete } from "@/lib/mapa-alfinetes";

describe("Mapa Operacional — alfinetes e camadas", () => {
  it("cor por tipo/status: obra, imóvel disponível, reservado e outros", () => {
    expect(categoriaDoPonto({ kind: "obra", status: "obra" })).toBe("obra");
    expect(categoriaDoPonto({ kind: "obra", status: "disponivel" })).toBe("obra");
    expect(categoriaDoPonto({ kind: "imovel", status: "disponivel" })).toBe("disponivel");
    expect(categoriaDoPonto({ kind: "imovel", status: "reservado" })).toBe("reservado");
    expect(categoriaDoPonto({ kind: "imovel", status: null })).toBe("outro");
    const cores = Object.values(CATEGORIAS_PONTO).map((c) => c.cor);
    expect(new Set(cores).size).toBe(cores.length);
  });

  it("alfinete é SVG em forma de gota, com a cor e o rótulo da categoria (não círculo marrom)", () => {
    const svg = htmlAlfinete("obra");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`fill="${CATEGORIAS_PONTO.obra.cor}"`);
    expect(svg).toContain("<path");
    expect(svg).toContain(`aria-label="${CATEGORIAS_PONTO.obra.rotulo}"`);
    expect(svg).not.toContain("#906a25");
  });

  it("coordenadas: só valores válidos do cadastro; nada é completado ou inventado", () => {
    expect(coordenadaValida("-5.4966667", "-47.4447222")).toEqual([-5.4966667, -47.4447222]);
    expect(coordenadaValida(-6.5, -49.879)).toEqual([-6.5, -49.879]);
    expect(coordenadaValida(null, "-47")).toBeNull();
    expect(coordenadaValida("", "")).toBeNull();
    expect(coordenadaValida("abc", "-47")).toBeNull();
    expect(coordenadaValida("95", "-47")).toBeNull();
    expect(coordenadaValida("-5", "181")).toBeNull();
  });

  it("agrupamento mostra a quantidade e cresce com ela", () => {
    expect(estiloAgrupamento(3)).toEqual({ texto: "3", tamanho: 34 });
    expect(estiloAgrupamento(42).tamanho).toBeGreaterThan(34);
    expect(estiloAgrupamento(1500).texto).toBe("999+");
  });

  it("satélite Esri com ruas e rótulos de referência e mapa OSM, todos com atribuição", () => {
    expect(CAMADAS_MAPA.satelite.url).toContain("World_Imagery");
    expect(CAMADAS_MAPA.ruas.url).toContain("Reference/World_Transportation");
    expect(CAMADAS_MAPA.rotulos.url).toContain("Reference/World_Boundaries_and_Places");
    expect(CAMADAS_MAPA.mapa.url).toContain("tile.openstreetmap.org");
    for (const c of [CAMADAS_MAPA.satelite, CAMADAS_MAPA.ruas, CAMADAS_MAPA.rotulos, CAMADAS_MAPA.mapa]) expect(c.attribution.length).toBeGreaterThan(0);
    expect(CAMADAS_MAPA.satelite.attribution).toContain("Esri");
    expect(CAMADAS_MAPA.mapa.attribution).toContain("OpenStreetMap");
  });
});
