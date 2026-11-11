import { describe, it, expect } from "vitest";
import type { Position } from "geojson";
import { gerarEstudoMassa, criarProjecao, type ParametrosMassa, type TipologiaMassa } from "@/lib/geo/massa-parcelamento";
import {
  montarModeloPlanta, renderizarPlantaSvg, vistaInicial, zoomEm, comprimentoEscalaGrafica, telaParaMetros,
} from "@/lib/geo/planta-tecnica";
import {
  chaveUnidade, codigoExibicao, compararCodigoUnidade, formatarCodigoLote, paginar, parseCodigoUnidade, unidadesDoCenario,
} from "@/lib/incorporacao/unidades";

const CENTRO: [number, number] = [-44.3, -2.53];
const proj = criarProjecao(CENTRO);
const geo = (anel: Position[]) => anel.map((p) => proj.paraGeo(p));
const IRREGULAR = geo([[-220, -140], [180, -160], [240, 60], [60, 150], [-40, 90], [-200, 130], [-220, -140]]);
const BASE: ParametrosMassa = {
  larguraViaM: 12, testadaLoteM: 10, profundidadeLoteM: 25, loteMinimoM2: 250,
  comprimentoMaxQuadraM: 120, percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500,
};
const visivel = (svg: string) => svg.replace(/<title>.*?<\/title>/g, "");
const contar = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe("Correção 04 — desenho técnico universal", () => {
  for (const tipologia of ["grid", "cul_de_sac", "rua_simples"] as TipologiaMassa[]) {
    it(`${tipologia}: desenha exatamente os lotes e vias do cenário, com legenda, escala e norte`, () => {
      const r = gerarEstudoMassa(IRREGULAR, CENTRO, { ...BASE, tipologia });
      for (const c of r.cenarios) {
        const modelo = montarModeloPlanta(IRREGULAR, c, CENTRO);
        const svg = renderizarPlantaSvg(modelo, vistaInicial(modelo, 1200, 800));
        expect(contar(svg, /data-lote="/g)).toBe(c.lotes.length);
        const vendaveis = c.lotes.filter((l) => l.tipo === "vendavel").length;
        expect(vendaveis).toBe(c.kpis.lotesVendaveis);
        expect(modelo.nLotesVendaveis).toBe(c.kpis.lotesVendaveis);
        const nVias = (c.ruas ?? []).length + (c.vias ?? []).length;
        expect(contar(svg.split('data-camada="vias"')[1].split("</g>")[0], /<polygon/g)).toBe(nVias);
        expect(svg).toContain('data-camada="gleba"');
        expect(svg).toContain('data-camada="legenda"');
        expect(svg).toContain('data-camada="escala"');
        expect(svg).toContain('data-camada="norte"');
        expect(svg).toContain(`Lotes vendáveis (${c.kpis.lotesVendaveis})`);
        // medidas do modelo = medidas do cálculo (mesma projeção)
        for (const l of modelo.lotes) {
          expect(l.testadaM).toBeCloseTo(BASE.testadaLoteM, 4);
          expect(l.profundidadeM).toBeCloseTo(BASE.profundidadeLoteM, 4);
        }
      }
    });
  }

  it("rótulos aparecem conforme o zoom (número → área → dimensões)", () => {
    const [c] = gerarEstudoMassa(IRREGULAR, CENTRO, BASE).cenarios;
    const modelo = montarModeloPlanta(IRREGULAR, c, CENTRO);
    const longe = vistaInicial(modelo, 300, 240);
    expect(visivel(renderizarPlantaSvg(modelo, longe))).not.toMatch(/× 25,00 m/);
    const perto = zoomEm(vistaInicial(modelo, 1200, 800), 8, 600, 400);
    const svgPerto = visivel(renderizarPlantaSvg(modelo, perto));
    expect(svgPerto).toMatch(/L0\d/);
    expect(svgPerto).toMatch(/250,00 m²/);
    expect(svgPerto).toMatch(/10,00 × 25,00 m/);
  });

  it("seleção destaca o lote e a quadra; zoom mantém o ponto sob o cursor", () => {
    const [c] = gerarEstudoMassa(IRREGULAR, CENTRO, BASE).cenarios;
    const modelo = montarModeloPlanta(IRREGULAR, c, CENTRO);
    const v = vistaInicial(modelo, 1000, 700);
    const idx = modelo.lotes.findIndex((l) => l.tipo === "vendavel");
    const svg = renderizarPlantaSvg(modelo, v, { selecionado: idx, quadra: modelo.lotes[idx].quadra });
    expect(svg).toMatch(new RegExp(`data-lote="${idx}"[^>]*stroke="#dc2626"`));
    const antes = telaParaMetros(v, 321, 222);
    const depois = telaParaMetros(zoomEm(v, 3, 321, 222), 321, 222);
    expect(depois[0]).toBeCloseTo(antes[0], 6);
    expect(depois[1]).toBeCloseTo(antes[1], 6);
  });

  it("escala gráfica usa comprimentos redondos", () => {
    expect([1, 2, 5, 10, 20, 50, 100, 200, 500]).toContain(comprimentoEscalaGrafica(1.3));
    expect(comprimentoEscalaGrafica(0.5)).toBe(200);
  });
});

describe("Correção 07 — numeração e paginação das unidades", () => {
  it("exibe Q01 / L01 sem alterar a identidade persistida", () => {
    expect(formatarCodigoLote("1", "1")).toBe("Q01 / L01");
    expect(codigoExibicao("Q1 / L10")).toBe("Q01 / L10");
    expect(codigoExibicao("Casa 3")).toBe("Casa 3");
    expect(parseCodigoUnidade("Quadra 2 Lote 7")).toEqual({ quadra: "2", lote: "7" });
    // a chave comercial continua a do código persistido (vendas antigas permanecem vinculadas)
    expect(chaveUnidade("Q1 / L1")).toBe("Q1 / L1");
  });

  it("ordena numericamente (L1, L2 … L10), por quadra, avulsos ao final", () => {
    const lista = ["Q1 / L10", "Q2 / L1", "Q1 / L2", "Casa B", "Q1 / L1", "Q10 / L1", "Q1 / L11", "Casa A"];
    expect([...lista].sort(compararCodigoUnidade)).toEqual(["Q1 / L1", "Q1 / L2", "Q1 / L10", "Q1 / L11", "Q2 / L1", "Q10 / L1", "Casa A", "Casa B"]);
  });

  it("paginação de 6 por página com limites e total corretos", () => {
    const itens = Array.from({ length: 29 }, (_, i) => i + 1);
    const p1 = paginar(itens, 1);
    expect(p1.itens).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p1.totalPaginas).toBe(5);
    expect(p1.temAnterior).toBe(false);
    expect(p1.temProxima).toBe(true);
    const p5 = paginar(itens, 5);
    expect(p5.itens).toEqual([25, 26, 27, 28, 29]);
    expect(p5.temProxima).toBe(false);
    expect(paginar(itens, 99).pagina).toBe(5); // após exclusões, a página é ajustada
    expect(paginar([], 1)).toMatchObject({ totalPaginas: 1, pagina: 1, itens: [] });
  });

  it("unidades do cenário Rua Simples seguem quadra/lote do desenho (cada lado com sua sequência)", () => {
    const anel = geo([[0, -255], [280, -255], [280, -5], [300, -5], [300, 255], [0, 255], [0, -255]]);
    const [c] = gerarEstudoMassa(anel, CENTRO, {
      larguraViaM: 10, testadaLoteM: 20, profundidadeLoteM: 250, loteMinimoM2: 5000, comprimentoMaxQuadraM: 300,
      percentInstitucional: 0, percentAreaVerde: 0, precoM2Lote: 100, tipologia: "rua_simples",
    }).cenarios;
    const linhas = unidadesDoCenario({
      cenarioId: c.id, precoM2Lote: 100,
      lotes: c.lotes.filter((l) => l.tipo === "vendavel").map((l) => ({ quadra: l.quadra!, lote: l.numero!, areaM2: l.areaM2 })),
    } as never);
    expect(linhas.length).toBe(29);
    const ordenados = linhas.map((l) => l.codigo).sort(compararCodigoUnidade).map(codigoExibicao);
    expect(ordenados.slice(0, 3)).toEqual(["Q01 / L01", "Q01 / L02", "Q01 / L03"]);
    expect(ordenados).toContain("Q02 / L14");
  });
});
