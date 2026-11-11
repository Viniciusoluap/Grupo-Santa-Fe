import { describe, it, expect, vi } from "vitest";

// Motor geométrico pesado: com a suíte inteira em paralelo, alguns casos passam de 5 s.
vi.setConfig({ testTimeout: 120_000 });
import { featureCollection, intersect, polygon as turfPolygon, union } from "@turf/turf";
import type { Position } from "geojson";
import {
  gerarEstudoMassa, gerarCenariosMassa, criarProjecao, validarParametrosMassa, assinaturaEntradas,
  type CenarioMassa, type ParametrosMassa, type TipologiaMassa,
} from "@/lib/geo/massa-parcelamento";
import { areaPlanar, retanguloDentro, criarIndiceAnel, validarPoligonal } from "@/lib/geo/geometria-parcelamento";
import { parseKmlTerreno } from "@/lib/geo/kml";

// Testes do motor de parcelamento v2 (correções 01–05 do prompt mestre de 08/11/2026).
// Tolerância numérica documentada: 1e-4 m em medidas lineares e 0,01 m² em áreas.

const CENTRO: [number, number] = [-44.3, -2.53];
const proj = criarProjecao(CENTRO);
const geo = (anel: Position[]) => anel.map((p) => proj.paraGeo(p));
const metros = (anel: Position[]) => anel.map((p) => proj.paraMetros(p));

const BASE: ParametrosMassa = {
  larguraViaM: 12, testadaLoteM: 10, profundidadeLoteM: 25, loteMinimoM2: 250,
  comprimentoMaxQuadraM: 120, percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500,
};
const RETANGULO = geo([[-200, -125], [200, -125], [200, 125], [-200, 125], [-200, -125]]);
const IRREGULAR = geo([[-220, -140], [180, -160], [240, 60], [60, 150], [-40, 90], [-200, 130], [-220, -140]]);
// Gleba sintética com os parâmetros de referência do Morada do Bosque (20 × 250 m, via única).
// NÃO é o KML real (não está no repositório): o lado norte comporta 15 lotes e o sul 14.
const W = 10;
const MORADA_SINTETICA = geo([[0, -255], [280, -255], [280, -5], [300, -5], [300, 255], [0, 255], [0, -255]]);
const MORADA: ParametrosMassa = {
  larguraViaM: W, testadaLoteM: 20, profundidadeLoteM: 250, loteMinimoM2: 5000, comprimentoMaxQuadraM: 300,
  percentInstitucional: 0, percentAreaVerde: 0, precoM2Lote: 100, tipologia: "rua_simples",
};

function lados(anelGeo: Position[]): number[] {
  const m = metros(anelGeo);
  return [0, 1, 2, 3].map((i) => Math.hypot(m[i + 1][0] - m[i][0], m[i + 1][1] - m[i][1]));
}

/** Largura mínima de um polígono convexo (menor "altura" sobre as arestas). */
function larguraMinima(m: Position[]): number {
  let min = Infinity;
  for (let i = 0; i < m.length - 1; i++) {
    const [ax, ay] = m[i], [bx, by] = m[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-6) continue;
    let max = 0;
    for (const [px, py] of m) max = Math.max(max, Math.abs((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / len);
    min = Math.min(min, max);
  }
  return min;
}

function conferirDimensoesExatas(c: CenarioMassa, p: ParametrosMassa) {
  for (const l of c.lotes) {
    const [a, b, cc, d] = lados(l.anel);
    expect(Math.abs(a - p.testadaLoteM)).toBeLessThan(1e-4);
    expect(Math.abs(cc - p.testadaLoteM)).toBeLessThan(1e-4);
    expect(Math.abs(b - p.profundidadeLoteM)).toBeLessThan(1e-4);
    expect(Math.abs(d - p.profundidadeLoteM)).toBeLessThan(1e-4);
    expect(l.areaM2).toBeCloseTo(p.testadaLoteM * p.profundidadeLoteM, 2);
    expect(l.areaM2).toBeGreaterThanOrEqual(p.loteMinimoM2);
  }
  expect(c.testadaLoteM).toBe(p.testadaLoteM);
  expect(c.profundidadeLoteM).toBe(p.profundidadeLoteM);
  expect(c.larguraViaM).toBe(p.larguraViaM);
}

function semSobreposicaoEDentro(anelGleba: Position[], c: CenarioMassa) {
  const gleba = metros(anelGleba);
  const ind = criarIndiceAnel(gleba, 50);
  const lotes = c.lotes.map((l) => metros(l.anel));
  for (const m of lotes) {
    // lote inteiro dentro: área do recorte = área do lote
    const inter = intersect(featureCollection([turfPolygon([m]), turfPolygon([gleba])]));
    const dentro = inter && inter.geometry.type === "Polygon" ? areaPlanar(inter.geometry.coordinates[0]) : 0;
    expect(dentro).toBeGreaterThanOrEqual(areaPlanar(m) - 0.01);
  }
  const bbox = (m: Position[]) => [Math.min(...m.map((p) => p[0])), Math.min(...m.map((p) => p[1])), Math.max(...m.map((p) => p[0])), Math.max(...m.map((p) => p[1]))];
  const bbs = lotes.map(bbox);
  const ruas = (c.ruas ?? []).map(metros);
  for (let i = 0; i < lotes.length; i++) {
    for (let j = i + 1; j < lotes.length; j++) {
      const [a, b] = [bbs[i], bbs[j]];
      if (a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]) continue;
      const x = intersect(featureCollection([turfPolygon([lotes[i]]), turfPolygon([lotes[j]])]));
      const ax = x ? (x.geometry.type === "Polygon" ? areaPlanar(x.geometry.coordinates[0]) : 1) : 0;
      expect(ax).toBeLessThan(0.01);
    }
    for (const r of ruas) {
      const x = intersect(featureCollection([turfPolygon([lotes[i]]), turfPolygon([r])]));
      const ax = x ? (x.geometry.type === "Polygon" ? areaPlanar(x.geometry.coordinates[0]) : 1) : 0;
      expect(ax).toBeLessThan(0.01);
    }
  }
  void ind;
}

describe("primitivas geométricas", () => {
  it("retângulo dentro/fora de poligonal côncava (L)", () => {
    const L: Position[] = [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100], [0, 0]];
    const ind = criarIndiceAnel(L, 20);
    expect(retanguloDentro(ind, [0, 0, 100, 40])).toBe(true);   // encostado nas bordas
    expect(retanguloDentro(ind, [10, 10, 30, 90])).toBe(true);
    expect(retanguloDentro(ind, [30, 30, 60, 60])).toBe(false); // atravessa o canto côncavo
    expect(retanguloDentro(ind, [50, 50, 90, 90])).toBe(false); // totalmente fora (no recorte)
  });

  it("valida poligonal: auto-interseção, não fechada, área nula", () => {
    expect(validarPoligonal([[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]])).toMatch(/auto-interseção/);
    expect(validarPoligonal([[0, 0], [10, 0], [10, 10]])).toMatch(/3 vértices|fechado/);
    expect(validarPoligonal([[0, 0], [10, 0], [20, 0], [0, 0]])).toMatch(/área nula/);
    expect(validarPoligonal(RETANGULO)).toBeNull();
  });

  it("conversão de coordenadas ida/volta e área do retângulo 400 × 250", () => {
    const m = metros(RETANGULO);
    expect(areaPlanar(m)).toBeCloseTo(100_000, 3);
  });
});

describe("Correção 01 — parâmetros respeitados exatamente", () => {
  for (const tipologia of ["grid", "cul_de_sac", "rua_simples"] as TipologiaMassa[]) {
    it(`${tipologia}: todos os lotes têm exatamente testada × profundidade e a via informada`, () => {
      const p = { ...BASE, tipologia };
      const r = gerarEstudoMassa(IRREGULAR, CENTRO, p);
      expect(r.cenarios.length).toBeGreaterThan(0);
      for (const c of r.cenarios) {
        conferirDimensoesExatas(c, p);
        semSobreposicaoEDentro(IRREGULAR, c);
      }
    });
  }

  it("20 × 250 não vira 20,3 × 273,3 (nem nenhuma outra dimensão)", () => {
    const r = gerarEstudoMassa(MORADA_SINTETICA, CENTRO, MORADA);
    for (const c of r.cenarios) conferirDimensoesExatas(c, MORADA);
  });

  it("via de 3 m é usada como 3 m (não 4 m ou mais)", () => {
    const p = { ...BASE, larguraViaM: 3 };
    const r = gerarEstudoMassa(RETANGULO, CENTRO, p);
    for (const c of r.cenarios) expect(c.larguraViaM).toBe(3);
    const rs = gerarEstudoMassa(RETANGULO, CENTRO, { ...p, tipologia: "rua_simples" });
    for (const c of rs.cenarios) {
      expect(c.larguraViaM).toBe(3);
      expect(c.sistemaViario!.larguraM).toBe(3);
      expect(larguraMinima(metros(c.ruas![0]))).toBeCloseTo(3, 4);
    }
  });

  it("testada × profundidade menor que a área mínima é recusada com explicação", () => {
    expect(validarParametrosMassa({ ...BASE, testadaLoteM: 10, profundidadeLoteM: 20, loteMinimoM2: 250 })).toMatch(/menor que a área mínima/);
    const r = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, profundidadeLoteM: 20 });
    expect(r.cenarios).toEqual([]);
    expect(r.inviabilidade?.motivo).toMatch(/não altera as dimensões/);
  });

  it("quadro de áreas fecha: bruta = não parceláveis + vendável + públicas + sobras; viário = vias desenhadas", () => {
    const r = gerarEstudoMassa(IRREGULAR, CENTRO, { ...BASE, appM2: 5_000, faixaServidaoM2: 1_000 });
    for (const c of r.cenarios) {
      const q = c.quadroAreas!;
      expect(Math.abs(q.totalNaoParcelavelM2 + q.areaLiquidaVendavelM2 + q.areaPublicaTotalM2 + (q.sobrasM2 ?? 0) - q.areaBrutaM2)).toBeLessThan(1);
      expect(q.sistemaViarioM2).toBeCloseTo(c.sistemaViario!.areaGeometricaM2, 2);
      // área das ruas desenhadas recalculada de forma independente (união dos anéis)
      const pecas = (c.ruas ?? []).map((a) => turfPolygon([metros(a)]));
      const u = pecas.length === 1 ? pecas[0] : union(featureCollection(pecas))!;
      const polys = u.geometry.type === "Polygon" ? [u.geometry.coordinates] : u.geometry.coordinates;
      const areaRuas = polys.reduce((s, rr) => s + areaPlanar(rr[0]) - rr.slice(1).reduce((h, x) => h + areaPlanar(x), 0), 0);
      expect(Math.abs(areaRuas - q.sistemaViarioM2)).toBeLessThan(1);
      expect(q.nLotes).toBe(c.lotes.filter((l) => l.tipo === "vendavel").length);
      expect(q.vgv).toBe(c.kpis.vgv);
    }
  });
});

describe("Correção 02 — determinismo e cenários distintos", () => {
  for (const tipologia of ["grid", "cul_de_sac", "rua_simples"] as TipologiaMassa[]) {
    it(`${tipologia}: 10 execuções idênticas produzem exatamente o mesmo resultado`, () => {
      const p = { ...BASE, tipologia };
      const ref = JSON.stringify(gerarEstudoMassa(IRREGULAR, CENTRO, p));
      for (let i = 0; i < 9; i++) expect(JSON.stringify(gerarEstudoMassa(IRREGULAR, CENTRO, p))).toBe(ref);
    });
  }

  it("opções legadas (seed/população) não alteram o resultado", () => {
    const a = gerarCenariosMassa(RETANGULO, CENTRO, BASE, { seed: 1, populacao: 4, geracoes: 2 });
    const b = gerarCenariosMassa(RETANGULO, CENTRO, BASE, { seed: 99999, populacao: 30, geracoes: 30 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("assinatura muda com parâmetros e é estável", () => {
    expect(assinaturaEntradas(RETANGULO, BASE)).toBe(assinaturaEntradas(RETANGULO, { ...BASE }));
    expect(assinaturaEntradas(RETANGULO, BASE)).not.toBe(assinaturaEntradas(RETANGULO, { ...BASE, testadaLoteM: 11 }));
  });

  it("até 3 cenários, com critério declarado, ordem estável e sem equivalentes repetidos", () => {
    const r = gerarEstudoMassa(IRREGULAR, CENTRO, BASE);
    expect(r.cenarios.length).toBeGreaterThan(0);
    expect(r.cenarios.length).toBeLessThanOrEqual(3);
    expect(r.cenarios[0].criterio).toBe("maior_area_vendavel");
    for (const c of r.cenarios.slice(1)) expect(c.kpis.areaVendavelM2).toBeLessThanOrEqual(r.cenarios[0].kpis.areaVendavelM2);
    const ids = r.cenarios.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 0; i < r.cenarios.length; i++) {
      for (let j = i + 1; j < r.cenarios.length; j++) {
        const [a, b] = [r.cenarios[i], r.cenarios[j]];
        const iguais = a.kpis.lotesVendaveis === b.kpis.lotesVendaveis && Math.abs(a.anguloVia - b.anguloVia) < 1
          && Math.abs((a.sistemaViario?.areaGeometricaM2 ?? 0) - (b.sistemaViario?.areaGeometricaM2 ?? 0)) < 1;
        expect(iguais).toBe(false);
      }
    }
  });

  it("nenhum cenário válido: lista vazia + motivo e causas verificáveis (sem cartões inventados)", () => {
    const pequena = geo([[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]);
    const r = gerarEstudoMassa(pequena, CENTRO, BASE);
    expect(r.cenarios).toEqual([]);
    expect(r.inviabilidade?.motivo).toMatch(/nenhum lote/);
    expect(r.inviabilidade?.causas.join(" ")).toMatch(/Área insuficiente|nenhum retângulo/);
    expect(r.inviabilidade?.motivo).not.toMatch(/Inválivel/);
  });

  it("diagnóstico distingue 'lote cabe sozinho mas não com a via'", () => {
    // faixa de 26 m: lote 20 × 25 cabe sozinho, mas via (12) + 25 = 37 m e via + 20 = 32 m não cabem
    const faixa = geo([[-200, -13], [200, -13], [200, 13], [-200, 13], [-200, -13]]);
    const r = gerarEstudoMassa(faixa, CENTRO, { ...BASE, testadaLoteM: 20, percentInstitucional: 0, percentAreaVerde: 0 });
    expect(r.cenarios).toEqual([]);
    expect(r.inviabilidade?.causas.join(" ")).toMatch(/cabe isoladamente/);
  });

  it("poligonal auto-intersectante é recusada", () => {
    const gravata = geo([[0, 0], [300, 300], [300, 0], [0, 300], [0, 0]]);
    const r = gerarEstudoMassa(gravata, CENTRO, BASE);
    expect(r.cenarios).toEqual([]);
    expect(r.inviabilidade?.motivo).toMatch(/auto-interseção/);
  });
});

describe("Correção 03 — Rua Simples", () => {
  it("referência sintética Morada do Bosque (20 × 250, via única): 29 lotes quando a geometria comporta", () => {
    const r = gerarEstudoMassa(MORADA_SINTETICA, CENTRO, MORADA);
    const c = r.cenarios[0];
    expect(c.kpis.lotesVendaveis).toBe(29);
    expect(c.kpis.areaVendavelM2).toBe(29 * 5000);
    expect(c.vias).toEqual([]); // sem balão de retorno
    expect((c.limitacoes ?? []).join(" ")).toMatch(/não inclui balão/);
    expect(c.ruas!.length).toBe(1);
    // via reta de 300 m × 10 m
    expect(c.sistemaViario!.areaGeometricaM2).toBeCloseTo(300 * W, 1);
    // duas quadras (um lado da via cada), numeração sequencial a partir de 1
    const porQuadra = new Map<string, number[]>();
    for (const l of c.lotes) porQuadra.set(l.quadra!, [...(porQuadra.get(l.quadra!) ?? []), Number(l.numero)]);
    expect(porQuadra.size).toBe(2);
    for (const nums of Array.from(porQuadra.values())) expect([...nums].sort((a, b) => a - b)).toEqual(nums.map((_, i) => i + 1));
    semSobreposicaoEDentro(MORADA_SINTETICA, c);
  });

  it("mesma geometria lida de um arquivo KML real (parseKmlTerreno) dá o mesmo resultado", () => {
    const coords = MORADA_SINTETICA.map((p) => `${p[0]},${p[1]},0`).join(" ");
    const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Gleba</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
    const t = parseKmlTerreno(kml);
    const r = gerarEstudoMassa(t.feature.geometry.coordinates[0], CENTRO, MORADA);
    expect(r.cenarios[0].kpis.lotesVendaveis).toBe(29);
  });

  it("geometria que não comporta 29 mostra a quantidade efetivamente viável (não força 29)", () => {
    const menor = geo([[0, -255], [200, -255], [200, 255], [0, 255], [0, -255]]);
    const r = gerarEstudoMassa(menor, CENTRO, MORADA);
    expect(r.cenarios[0].kpis.lotesVendaveis).toBe(20);
  });

  it("Grade e Cul-de-sac continuam funcionando na mesma gleba", () => {
    for (const tipologia of ["grid", "cul_de_sac"] as TipologiaMassa[]) {
      const r = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, tipologia });
      expect(r.cenarios[0].kpis.lotesVendaveis).toBeGreaterThan(50);
      expect(r.cenarios[0].tipologia).toBe(tipologia);
    }
    const cul = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, tipologia: "cul_de_sac" });
    expect((cul.cenarios[0].vias ?? []).length).toBeGreaterThan(0);
  });
});

describe("Correção 01 — área do sistema viário manual", () => {
  it("rua simples: valor manual compatível define o comprimento da via e o quadro", () => {
    const area = 10 * 20 * W; // 10 peças de 20 m × 10 m
    const r = gerarEstudoMassa(MORADA_SINTETICA, CENTRO, { ...MORADA, modoSistemaViario: "manual", areaSistemaViarioM2: area });
    const c = r.cenarios[0];
    expect(c.sistemaViario!.areaGeometricaM2).toBeCloseTo(area, 1);
    expect(c.quadroAreas!.sistemaViarioM2).toBeCloseTo(area, 1);
    expect(c.quadroAreas!.modoSistemaViario).toBe("manual");
    expect(c.kpis.lotesVendaveis).toBe(20);
  });

  it("valor manual geometricamente inviável gera divergência, não implantação fictícia", () => {
    const r = gerarEstudoMassa(MORADA_SINTETICA, CENTRO, { ...MORADA, modoSistemaViario: "manual", areaSistemaViarioM2: 9_000 });
    expect(r.cenarios).toEqual([]);
    expect(r.inviabilidade?.motivo).toMatch(/Divergência técnica/);
  });

  it("valor manual negativo ou acima da área disponível é recusado", () => {
    expect(validarParametrosMassa({ ...BASE, modoSistemaViario: "manual", areaSistemaViarioM2: -1 })).toMatch(/negativa/);
    const r = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, modoSistemaViario: "manual", areaSistemaViarioM2: 200_000 });
    expect(r.inviabilidade?.motivo).toMatch(/maior que a área disponível/);
  });

  it("grade em modo manual: aceita só se a área desenhada bater (±5%)", () => {
    const auto = gerarEstudoMassa(RETANGULO, CENTRO, BASE).cenarios[0];
    const geoArea = auto.sistemaViario!.areaGeometricaM2;
    const ok = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, modoSistemaViario: "manual", areaSistemaViarioM2: geoArea });
    expect(ok.cenarios.length).toBeGreaterThan(0);
    for (const c of ok.cenarios) expect(Math.abs(c.sistemaViario!.areaGeometricaM2 - geoArea)).toBeLessThanOrEqual(0.05 * geoArea + 1);
    const ruim = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, modoSistemaViario: "manual", areaSistemaViarioM2: 10 });
    expect(ruim.cenarios).toEqual([]);
    expect(ruim.inviabilidade?.motivo).toMatch(/Divergência técnica/);
  });
});

describe("Correção 05 — quantidade de lotes dinâmica", () => {
  it.each([
    [80, 8], [140, 14], [300, 30], [600, 60], [1000, 100],
  ])("faixa de %i m comporta %i lotes de 20 × 250 (dois lados)", (comprimento, esperado) => {
    const anel = geo([[0, -255], [comprimento, -255], [comprimento, 255], [0, 255], [0, -255]]);
    const r = gerarEstudoMassa(anel, CENTRO, MORADA);
    expect(r.cenarios[0].kpis.lotesVendaveis).toBe(esperado);
  });

  it("grade escala com a área (sem teto fixo)", () => {
    const pequeno = gerarEstudoMassa(geo([[0, 0], [150, 0], [150, 120], [0, 120], [0, 0]]), CENTRO, BASE).cenarios[0].kpis.lotesVendaveis;
    const grande = gerarEstudoMassa(geo([[0, 0], [600, 0], [600, 480], [0, 480], [0, 0]]), CENTRO, BASE).cenarios[0].kpis.lotesVendaveis;
    expect(pequeno).toBeGreaterThan(0);
    expect(grande).toBeGreaterThan(10 * pequeno);
  });
});

// ─── Rodada 2 (08/11): gleba REAL do Morada do Bosque, lote que acompanha a divisa, ajuste da malha ───
import { ANEL_MORADA, CENTRO_MORADA } from "./fixtures/morada-do-bosque";

const MORADA_REAL: ParametrosMassa = {
  larguraViaM: 3, testadaLoteM: 20, profundidadeLoteM: 250, loteMinimoM2: 5000, comprimentoMaxQuadraM: 580,
  percentInstitucional: 0, percentAreaVerde: 0, precoM2Lote: 20, tipologia: "rua_simples",
};

describe("Morada do Bosque — KML real do sistema (150.095 m²)", () => {
  it("área da poligonal real confere com o cadastro", () => {
    const m = criarProjecao(CENTRO_MORADA);
    expect(areaPlanar(ANEL_MORADA.map((p) => m.paraMetros(p)))).toBeGreaterThan(149_000);
    expect(areaPlanar(ANEL_MORADA.map((p) => m.paraMetros(p)))).toBeLessThan(151_500);
  });

  it("retangular exato 20 × 250 + via 3 m: 23 lotes (não força 29)", () => {
    const c = gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, MORADA_REAL).cenarios[0];
    expect(c.kpis.lotesVendaveis).toBe(23);
    for (const l of c.lotes) expect(l.areaM2).toBeCloseTo(5000, 2);
  });

  it("lote acompanha a divisa: 25 lotes, todos ≥ 5.000 m², frente múltipla de 20 m, dentro da gleba e sem sobreposição", () => {
    const p = { ...MORADA_REAL, formatoLote: "divisa" as const };
    const c = gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, p).cenarios[0];
    expect(c.kpis.lotesVendaveis).toBe(25);
    for (const l of c.lotes) {
      expect(l.areaM2).toBeGreaterThanOrEqual(5000);
      expect((l.testadaM ?? 0) % 20).toBeCloseTo(0, 6);
      expect(l.testadaM).toBeGreaterThanOrEqual(20);
    }
    expect((c.limitacoes ?? []).join(" ")).toMatch(/acompanham a divisa/);
    // mesmas verificações geométricas dos demais testes (centros de lotes adaptados a anéis irregulares)
    const proj2 = criarProjecao(CENTRO_MORADA);
    const gleba = turfPolygon([ANEL_MORADA.map((q) => proj2.paraMetros(q))]);
    for (const l of c.lotes) {
      const m = l.anel.map((q) => proj2.paraMetros(q));
      const inter = intersect(featureCollection([turfPolygon([m]), gleba]));
      const a = inter && inter.geometry.type === "Polygon" ? areaPlanar(inter.geometry.coordinates[0]) : 0;
      expect(a).toBeGreaterThanOrEqual(areaPlanar(m) - 0.5);
    }
  });

  it("determinístico também no formato divisa", () => {
    const p = { ...MORADA_REAL, formatoLote: "divisa" as const };
    const a = JSON.stringify(gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, p));
    expect(JSON.stringify(gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, p))).toBe(a);
  });
});

describe("Correção 01/04 — ajuste automático da malha no modo manual da área viária", () => {
  const auto = () => gerarEstudoMassa(RETANGULO, CENTRO, BASE).cenarios[0].sistemaViario!.areaGeometricaM2;

  it("via MAIOR que a da malha padrão: encurta as quadras até bater", () => {
    const alvo = Math.round(auto() * 1.4);
    const r = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, modoSistemaViario: "manual", areaSistemaViarioM2: alvo });
    expect(r.cenarios.length).toBeGreaterThan(0);
    for (const c of r.cenarios) {
      expect(Math.abs(c.sistemaViario!.areaGeometricaM2 - alvo)).toBeLessThanOrEqual(0.05 * alvo + 1);
      expect((c.limitacoes ?? []).join(" ")).toMatch(/Malha ajustada automaticamente/);
      conferirDimensoesExatas(c, BASE);
    }
  });

  it("via MENOR que a da malha padrão: suprime ruas de menor aproveitamento até bater", () => {
    const alvo = Math.round(auto() * 0.6);
    const r = gerarEstudoMassa(RETANGULO, CENTRO, { ...BASE, modoSistemaViario: "manual", areaSistemaViarioM2: alvo });
    expect(r.cenarios.length).toBeGreaterThan(0);
    for (const c of r.cenarios) {
      expect(Math.abs(c.sistemaViario!.areaGeometricaM2 - alvo)).toBeLessThanOrEqual(0.05 * alvo + 1);
      expect((c.limitacoes ?? []).join(" ")).toMatch(/suprimida/);
      semSobreposicaoEDentro(RETANGULO, c);
    }
  });
});

// ─── Rodada 3 (08/11): Rua Simples com via que ACOMPANHA A DIVISA (traçado curvo) ───
describe("Rua Simples — via acompanha a divisa", () => {
  const PARAMS_DIV: ParametrosMassa = { ...MORADA_REAL, tracadoVia: "divisa" };
  const conferirDivisa = (anelGeo: Position[], centro: [number, number], c: CenarioMassa, p: ParametrosMassa) => {
    const pj = criarProjecao(centro);
    const gleba = turfPolygon([anelGeo.map((q) => pj.paraMetros(q))]);
    const lotes = c.lotes.map((l) => turfPolygon([l.anel.map((q) => pj.paraMetros(q))]));
    const ruas = (c.ruas ?? []).map((r) => turfPolygon([r.map((q) => pj.paraMetros(q))]));
    const areaInter = (a: ReturnType<typeof turfPolygon>, b: ReturnType<typeof turfPolygon>) => {
      const x = intersect(featureCollection([a, b]));
      if (!x) return 0;
      return x.geometry.type === "Polygon" ? areaPlanar(x.geometry.coordinates[0]) : x.geometry.coordinates.reduce((s, r) => s + areaPlanar(r[0]), 0);
    };
    lotes.forEach((lp, i) => {
      expect(areaInter(lp, gleba)).toBeGreaterThanOrEqual(areaPlanar(lp.geometry.coordinates[0]) - 0.5); // dentro da gleba
      expect(c.lotes[i].areaM2).toBeGreaterThanOrEqual(p.loteMinimoM2);                                  // área mínima
      expect(c.lotes[i].testadaM ?? 0).toBeGreaterThanOrEqual(p.testadaLoteM - 1e-6);                    // frente mínima
      for (let j = i + 1; j < lotes.length; j++) expect(areaInter(lp, lotes[j])).toBeLessThan(0.5);      // sem sobreposição
      for (const r of ruas) expect(areaInter(lp, r)).toBeLessThan(0.5);                                   // lote não invade a via
    });
  };

  it("Morada do Bosque (KML real), via 3 m pela divisa, frente mínima 20 m: 27 lotes válidos", () => {
    const c = gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, PARAMS_DIV).cenarios[0];
    expect(c.kpis.lotesVendaveis).toBe(27);
    expect(c.sistemaViario!.larguraM).toBe(3);
    expect((c.limitacoes ?? []).join(" ")).toMatch(/acompanha a divisa/);
    conferirDivisa(ANEL_MORADA, CENTRO_MORADA, c, PARAMS_DIV);
  }, 180_000);

  it("Morada do Bosque: com frente mínima de 17 m chega a 29 lotes ≥ 5.000 m²", () => {
    const p = { ...PARAMS_DIV, testadaLoteM: 17 };
    const c = gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, p).cenarios[0];
    expect(c.kpis.lotesVendaveis).toBe(29);
    conferirDivisa(ANEL_MORADA, CENTRO_MORADA, c, p);
  }, 180_000);

  it("Morada do Bosque: troca a via de 6 m para a divisa a leste e recalcula lotes, áreas e VGV", () => {
    const p = { ...PARAMS_DIV, larguraViaM: 6, testadaLoteM: 17 };
    const original = gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, p);
    const oposto = gerarEstudoMassa(ANEL_MORADA, CENTRO_MORADA, { ...p, inverterLadoVia: true });
    expect(oposto.assinatura).not.toBe(original.assinatura);
    expect(oposto.cenarios.length).toBeGreaterThan(0);
    const longitudeVia = (c: CenarioMassa) => {
      const xs = c.ruas!.flatMap((r) => r.slice(0, -1).map(([x]) => x));
      return xs.reduce((s, x) => s + x, 0) / xs.length;
    };
    const longitudeGleba = CENTRO_MORADA[0];
    expect(longitudeVia(original.cenarios[0])).toBeLessThan(longitudeGleba);
    for (const c of oposto.cenarios) {
      expect(c.viaLadoOposto).toBe(true);
      expect(longitudeVia(c)).toBeGreaterThan(longitudeGleba);
      expect(Math.abs(c.kpis.vgv - c.kpis.areaVendavelM2 * p.precoM2Lote)).toBeLessThanOrEqual(1);
      expect(c.sistemaViario!.areaGeometricaM2).toBeGreaterThan(0);
      expect(c.quadroAreas!.sistemaViarioM2).toBe(c.sistemaViario!.areaGeometricaM2);
      conferirDivisa(ANEL_MORADA, CENTRO_MORADA, c, p);
    }
  }, 180_000);

  it("largura da via informada é usada (área viária ≈ largura × comprimento) e a busca é determinística", () => {
    const anel = geo([[0, 0], [300, 0], [420, 120], [420, 380], [0, 380], [0, 0]]); // divisa com dobra (curva)
    const p: ParametrosMassa = { ...MORADA_REAL, testadaLoteM: 20, profundidadeLoteM: 150, loteMinimoM2: 2500, larguraViaM: 6, tracadoVia: "divisa" };
    const a = gerarEstudoMassa(anel, CENTRO, p);
    const b = gerarEstudoMassa(anel, CENTRO, p);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = a.cenarios[0];
    expect(c.kpis.lotesVendaveis).toBeGreaterThan(5);
    conferirDivisa(anel, CENTRO, c, p);
  }, 180_000);
});

describe("Revisão Codex (PR #188) — frente efetiva após o recorte", () => {
  it("divisa côncava: nenhum lote tem frente real sobre a via menor que a testada informada", async () => {
    const { buscarViaDivisa } = await import("@/lib/geo/rua-divisa");
    const { pontoDentro } = await import("@/lib/geo/geometria-parcelamento");
    const anel: Position[] = [[75, 0], [42, 42], [0, 108], [-51, 51], [-88, 0], [-37, -37], [0, -95], [44, -44], [75, 0]];
    const r = buscarViaDivisa(anel, { testada: 10, profundidade: 60, via: 8, loteMinimoM2: 200 });
    expect(r.length).toBeGreaterThan(0);
    // medição independente: arestas do lote cujo ponto médio (±5 cm para fora) cai dentro da via
    const frenteReal = (lote: Position[], vias: Position[][]) => {
      let f = 0;
      for (let i = 0; i < lote.length - 1; i++) {
        const [ax, ay] = lote[i], [bx, by] = lote[i + 1];
        const L = Math.hypot(bx - ax, by - ay);
        if (L < 1e-6) continue;
        const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = -(by - ay) / L, ny = (bx - ax) / L;
        if ([1, -1].some((sg) => vias.some((v) => pontoDentro(v, mx + sg * 0.05 * nx, my + sg * 0.05 * ny)))) f += L;
      }
      return f;
    };
    for (const impl of r) {
      for (const l of impl.lotes) {
        expect(frenteReal(l.anel, impl.viasLivres)).toBeGreaterThanOrEqual(10 - 0.05);
        expect(l.testada!).toBeGreaterThanOrEqual(10 - 1e-6);
      }
    }
  }, 120_000);
});
