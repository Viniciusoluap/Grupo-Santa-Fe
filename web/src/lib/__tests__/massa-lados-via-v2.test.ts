import { describe, expect, it } from "vitest";
import { ANEL_MORADA, CENTRO_MORADA } from "./fixtures/morada-do-bosque";
import { criarProjecao, gerarEstudoMassa, validarParametrosMassa, type ParametrosMassa } from "@/lib/geo/massa-parcelamento";
import { buscarPorLados, cadeiasDosLados, ladoDasArestas, medirLados } from "@/lib/geo/lados-gleba";
import { areaPlanar } from "@/lib/geo/geometria-parcelamento";

const proj = criarProjecao(CENTRO_MORADA);
const MORADA = (() => { const p = ANEL_MORADA.map((x) => proj.paraMetros(x)); p[p.length - 1] = p[0]; return p; })();
const OPC = { testada: 20, profundidade: 250, via: 6, loteMinimoM2: 5000 };

describe("Rua por lados escolhidos — classificação da gleba", () => {
  it("retângulo: cada aresta pertence ao lado para onde aponta (sentido horário ou anti-horário)", () => {
    const ccw = [[0, 0], [100, 0], [100, 50], [0, 50], [0, 0]];
    expect(ladoDasArestas(ccw)).toEqual(["baixo", "direita", "cima", "esquerda"]);
    const cw = [[0, 0], [0, 50], [100, 50], [100, 0], [0, 0]];
    expect(ladoDasArestas(cw)).toEqual(["esquerda", "cima", "direita", "baixo"]);
    expect(cadeiasDosLados(ccw, ["cima", "direita"])).toEqual([[1, 2]]); // vizinhos = via contínua em "L"
    expect(cadeiasDosLados(ccw, ["cima", "baixo"])).toEqual([[0], [2]]); // opostos = duas vias (ordem do anel)
    expect(cadeiasDosLados(ccw, ["cima", "esquerda", "direita", "baixo"]).length).toBe(4);
  });
  it("Morada do Bosque: lados medidos no KML (direita 513,6 m — não 580 m)", () => {
    const m = Object.fromEntries(medirLados(MORADA).map((l) => [l.lado, Math.round(l.comprimentoM * 10) / 10]));
    expect(m).toEqual({ cima: 265.7, esquerda: 627.8, direita: 513.6, baixo: 266.1 });
    expect(Math.floor(m.direita / 20)).toBe(25);
    expect(Math.floor(m.esquerda / 20)).toBe(31);
  });
});

describe("Rua por lados — implantação com frente exata e fundo variável", () => {
  const conferir = (r: ReturnType<typeof buscarPorLados>[number]) => {
    const gleba = areaPlanar(MORADA);
    const soma = r.lotes.reduce((s, l) => s + l.area, 0) + r.viasLivres.reduce((s, a) => s + areaPlanar(a), 0);
    expect(soma).toBeLessThanOrEqual(gleba + 1); // sem sobreposição: lotes + via cabem na gleba
    for (const l of r.lotes) {
      expect(l.area).toBeGreaterThanOrEqual(5000 - 1e-6);
      expect(l.testada!).toBeGreaterThanOrEqual(20 - 1e-6);
    }
  };
  it("rua da direita: 25 lotes, frente exata de 20 m (só o lote da ponta absorve a sobra), via só na divisa leste", () => {
    const [r] = buscarPorLados(MORADA, ["direita"], OPC, 1);
    expect(r.lotes.length).toBe(25);
    expect(r.lotes.filter((l) => Math.abs(l.testada! - 20) > 0.05).length).toBeLessThanOrEqual(1);
    const xs = r.viasLivres.flatMap((a) => a.map((p) => p[0]));
    expect(Math.min(...xs)).toBeGreaterThan(-20); // a via fica toda no lado leste da gleba
    conferir(r);
  }, 120_000);
  it("rua da esquerda: 28 lotes com frente exata de 20 m (627,8 m de divisa; o 29º só caberia alargando uma frente)", () => {
    const [r] = buscarPorLados(MORADA, ["esquerda"], OPC, 1);
    expect(r.lotes.length).toBe(28);
    expect(r.lotes.every((l) => Math.abs(l.testada! - 20) < 0.05)).toBe(true);
    conferir(r);
  }, 120_000);
  it("motor de massa: parâmetro ladosVia gera cenários só com a via escolhida e é validado", () => {
    const p: ParametrosMassa = { larguraViaM: 6, testadaLoteM: 20, profundidadeLoteM: 250, loteMinimoM2: 5000, comprimentoMaxQuadraM: 580,
      percentInstitucional: 0, percentAreaVerde: 0, precoM2Lote: 20, tipologia: "rua_simples", tracadoVia: "divisa", ladosVia: ["direita"] };
    expect(validarParametrosMassa({ ...p, ladosVia: ["meio" as never] })).toMatch(/Lado da via inválido/);
    const r = gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, p);
    expect(r.cenarios.length).toBeGreaterThan(0);
    expect(r.cenarios[0].kpis.lotesVendaveis).toBe(25);
    for (const c of r.cenarios) {
      expect(c.ladosVia).toEqual(["direita"]);
      expect(Math.abs(c.kpis.vgv - c.kpis.areaVendavelM2 * p.precoM2Lote)).toBeLessThanOrEqual(1);
    }
  }, 180_000);
});

describe("Rua por lados — revisão (frente exata e ordem do anel)", () => {
  it("frente exata: nenhum lote do meio tem frente alargada (só a ponta absorve a sobra)", () => {
    const ret = [[0, 0], [300, 0], [300, 30], [0, 30], [0, 0]];
    const [r] = buscarPorLados(ret, ["baixo"], { testada: 20, profundidade: 100, via: 6, loteMinimoM2: 1000 }, 1);
    const frentes = (r?.lotes ?? []).map((l) => l.testada!);
    expect(frentes.slice(0, -1).every((f) => Math.abs(f - 20) < 0.05)).toBe(true);
    if (frentes.length) expect(frentes[frentes.length - 1]).toBeLessThan(40);
  });
  it("a primeira divisa sem lote não impede as outras, e o resultado não depende do vértice inicial do KML", () => {
    const a = [[0, 100], [10, 100], [100, 0], [0, 0], [0, 100]];
    const b = [[100, 0], [0, 0], [0, 100], [10, 100], [100, 0]];
    const opc = { testada: 20, profundidade: 100, via: 6, loteMinimoM2: 400 };
    const ra = buscarPorLados(a, ["cima", "baixo"], opc, 1)[0];
    const rb = buscarPorLados(b, ["cima", "baixo"], opc, 1)[0];
    expect(ra?.lotes.length ?? 0).toBeGreaterThan(0);
    expect(ra?.lotes.length).toBe(rb?.lotes.length);
  });
});
