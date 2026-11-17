// EPIC-023, etapa F (correções 8 e 10 do dono, 15/11/2026): KML com várias áreas, malha viária conectada,
// lotes recortados na divisa, nada sem destino, áreas públicas com geometria, ligação com as ruas existentes
// e rótulos sem sobreposição. Tolerância declarada do fecho de áreas: max(1 m², 0,5% da gleba).
import { describe, it, expect, vi } from "vitest";
import { featureCollection, intersect, polygon as turfPolygon, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import {
  assinaturaEntradas, criarProjecao, gerarEstudoMassa, NOTA_ACESSO_SEM_VIA, viasEntornoDoOsm,
  type CenarioMassa, type ParametrosMassa, type TipologiaMassa, type ViaEntorno,
} from "@/lib/geo/massa-parcelamento";
import { areaPlanar, pontoDentro } from "@/lib/geo/geometria-parcelamento";
import { AREA_PUBLICA_MINIMA_M2, caixaMinima, componentesDasVias, distanciaAoAnel, formaAceitavel, frenteMinimaPara } from "@/lib/geo/malha-conectada";
import { colidem, montarModeloPlanta, renderizarPlantaSvg, vistaInicial, zoomEm, type CaixaRotulo } from "@/lib/geo/planta-tecnica";
import { cenarioPrincipalDe } from "@/lib/incorporacao/estudos-massa";
import { unidadesDoCenario } from "@/lib/incorporacao/unidades";

// Paridade 17/11: o motor de massa 3.0.0 (malha conectada, recorte na divisa) é mais pesado; com 3 workers em
// paralelo os cenários grandes passam de 5 s. Prazo maior só neste arquivo (nenhum teste foi pulado ou afrouxado).
vi.setConfig({ testTimeout: 60_000 });

const CENTRO: [number, number] = [-47.49, -23.5];
const proj = criarProjecao(CENTRO);
const geo = (anel: Position[]) => anel.map((p) => proj.paraGeo(p));
// ida e volta lng/lat ↔ metros deixa ruído de ~1e-10 m: as coordenadas são arredondadas a 1 mm para os recortes do turf
const metros = (anel: Position[]) => anel.map((p) => proj.paraMetros(p).map((v) => Math.round(v * 1e3) / 1e3));

// quadrilátero irregular como os dos prints do dono: ~250 × 150 m com divisas inclinadas
const QUAD_M: Position[] = [[-125, -70], [120, -85], [135, 70], [-110, 80], [-125, -70]];
const QUAD = geo(QUAD_M);
const BASE: ParametrosMassa = {
  larguraViaM: 12, testadaLoteM: 12, profundidadeLoteM: 25, loteMinimoM2: 250,
  comprimentoMaxQuadraM: 120, percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500,
};
const TIPOLOGIAS: TipologiaMassa[] = ["grid", "cul_de_sac", "rua_simples"];
// via pública existente ao sul, paralela à divisa de baixo (eixo ~15 m para fora)
const VIA_SUL: ViaEntorno[] = [{ coords: geo([[-200, -88], [200, -103]]), nome: "Rua Existente Sul" }];

const cache = new Map<string, ReturnType<typeof gerarEstudoMassa>>();
function estudo(tipologia: TipologiaMassa, vias?: ViaEntorno[]) {
  const k = `${tipologia}|${vias ? "vias" : "-"}`;
  if (!cache.has(k)) cache.set(k, gerarEstudoMassa(QUAD, CENTRO, { ...BASE, tipologia }, { viasEntorno: vias }));
  return cache.get(k)!;
}

function areaGeo(g: Polygon | MultiPolygon): number {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.reduce((s, rs) => s + areaPlanar(rs[0]) - rs.slice(1).reduce((h, r) => h + areaPlanar(r), 0), 0);
}

function uniaoVias(c: CenarioMassa): Feature<Polygon | MultiPolygon> | null {
  const fs = [...(c.ruas ?? []), ...(c.vias ?? [])].map((a) => turfPolygon([metros(a)]));
  if (fs.length === 0) return null;
  return fs.length === 1 ? fs[0] : (union(featureCollection(fs)) as Feature<Polygon | MultiPolygon>);
}

/** Medição independente da testada: arestas cujo ponto médio, 5 cm para fora, cai numa via do cenário. */
function frenteMedida(lote: Position[], vias: Position[][]): number {
  let f = 0;
  const s = (() => { let a = 0; for (let i = 0; i < lote.length - 1; i++) a += lote[i][0] * lote[i + 1][1] - lote[i + 1][0] * lote[i][1]; return a >= 0 ? 1 : -1; })();
  for (let i = 0; i < lote.length - 1; i++) {
    const [ax, ay] = lote[i], [bx, by] = lote[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-6) continue;
    const nx = (s * (by - ay)) / L, ny = (-s * (bx - ax)) / L;
    const n = Math.max(1, Math.ceil(L / 0.5));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const qx = ax + t * (bx - ax) + 0.05 * nx, qy = ay + t * (by - ay) + 0.05 * ny;
      if (vias.some((v) => pontoDentro(v, qx, qy))) f += L / n;
    }
  }
  return f;
}

describe("R1 — malha viária conectada com acesso pela divisa", () => {
  for (const tipologia of TIPOLOGIAS) {
    it(`${tipologia}: todas as vias formam um único grafo conexo que toca a divisa`, () => {
      const r = estudo(tipologia);
      expect(r.cenarios.length).toBeGreaterThan(0);
      for (const c of r.cenarios) {
        const aneis = [...(c.ruas ?? []), ...(c.vias ?? [])].map(metros);
        expect(aneis.length).toBeGreaterThan(0);
        expect(componentesDasVias(aneis)).toBe(1);
        // algum vértice de via sobre a divisa (acesso)
        expect(aneis.some((a) => a.some((p) => distanciaAoAnel(QUAD_M, p) < 0.01))).toBe(true);
        expect((c.acessos ?? []).length).toBeGreaterThan(0);
      }
    });
  }

  it("cul-de-sac: o balão fica na ponta de uma rua ligada à malha (sem balão solto)", () => {
    const r = estudo("cul_de_sac");
    const c = r.cenarios[0];
    expect((c.vias ?? []).length).toBeGreaterThan(0);
    const ruas = (c.ruas ?? []).map(metros);
    for (const b of (c.vias ?? []).map(metros)) {
      // o centro do balão está sobre (dentro de) alguma rua — o balão nasce da rua sem saída
      const cx = b.slice(0, -1).reduce((s, p) => s + p[0], 0) / (b.length - 1);
      const cy = b.slice(0, -1).reduce((s, p) => s + p[1], 0) / (b.length - 1);
      expect(ruas.some((r2) => pontoDentro(r2, cx, cy))).toBe(true);
    }
    expect((c.limitacoes ?? []).join(" ")).toMatch(/nasce de um tronco/);
  });
});

describe("R2 — todo lote vendável tem testada sobre a malha", () => {
  for (const tipologia of TIPOLOGIAS) {
    it(`${tipologia}: testada medida ≥ mínima em cada lote vendável`, () => {
      const c = estudo(tipologia).cenarios[0];
      const vias = [...(c.ruas ?? []), ...(c.vias ?? [])].map(metros);
      const minima = frenteMinimaPara(BASE.testadaLoteM);
      const vend = c.lotes.filter((l) => l.tipo === "vendavel");
      expect(vend.length).toBeGreaterThan(0);
      for (const l of vend) {
        expect(frenteMedida(metros(l.anel), vias)).toBeGreaterThanOrEqual(minima - 0.5);
        expect(l.areaM2).toBeGreaterThanOrEqual(BASE.loteMinimoM2 - 1e-6);
      }
    });
  }
});

describe("R3 — nada sem destino (fecho de áreas)", () => {
  for (const tipologia of TIPOLOGIAS) {
    it(`${tipologia}: lotes + vias + verde + institucional + não parcelável = área da gleba (tolerância max(1 m², 0,5%))`, () => {
      const area = areaPlanar(QUAD_M);
      for (const c of estudo(tipologia).cenarios) {
        const u = uniaoVias(c);
        const areaVias = u ? areaGeo(u.geometry) : 0;
        const soma = c.lotes.reduce((s, l) => s + l.areaM2, 0) + areaVias;
        const tol = Math.max(1, 0.005 * area);
        expect(Math.abs(soma - area)).toBeLessThanOrEqual(tol);
        expect(Math.abs(c.fechoAreas!.diferencaM2)).toBeLessThanOrEqual(tol);
        // quadro: sem "sobras de quadra" (remanescente sem destino)
        expect(c.quadroAreas!.sobrasM2 ?? 0).toBeLessThanOrEqual(tol);
        // peças sem sobreposição com as vias
        for (const l of c.lotes) {
          const x = u ? intersect(featureCollection([turfPolygon([metros(l.anel)]), u])) : null;
          expect(x ? areaGeo(x.geometry as Polygon | MultiPolygon) : 0).toBeLessThan(0.5);
        }
      }
    });
  }

  it("lotes da borda são recortados pela divisa (não descartados) e ficam dentro da gleba", () => {
    const c = estudo("grid").cenarios[0];
    const recortados = c.lotes.filter((l) => l.tipo === "vendavel" && l.ajuste === "recortado");
    expect(recortados.length).toBeGreaterThan(0);
    const gleba = turfPolygon([QUAD_M]);
    for (const l of recortados) {
      const m = metros(l.anel);
      const x = intersect(featureCollection([turfPolygon([m]), gleba]));
      expect(x ? areaGeo(x.geometry as Polygon | MultiPolygon) : 0).toBeGreaterThanOrEqual(areaPlanar(m) - 0.05);
      expect(l.testadaM!).toBeGreaterThanOrEqual(frenteMinimaPara(BASE.testadaLoteM) - 1e-6);
    }
  });
});

describe("R4 — áreas públicas com geometria própria", () => {
  for (const tipologia of TIPOLOGIAS) {
    it(`${tipologia}: percentuais mínimos respeitados, usando primeiro as sobras/peças irregulares`, () => {
      const c = estudo(tipologia).cenarios[0];
      const q = c.quadroAreas!;
      expect(q.areaInstitucionalM2).toBeGreaterThanOrEqual(0.05 * q.areaParcelavelM2 - 0.5);
      expect(q.areaVerdeM2).toBeGreaterThanOrEqual(0.1 * q.areaParcelavelM2 - 0.5);
      const publicas = c.lotes.filter((l) => l.tipo === "area_publica");
      expect(publicas.some((l) => l.origem === "sobra")).toBe(true);
      // lotes inteiros convertidos só quando as sobras não bastam: contíguos, formam UMA peça (praça) com área total
      for (const l of publicas.filter((x) => x.origem === "lote")) expect(l.anel.length).toBeGreaterThanOrEqual(4);
    });
  }

  it("rua simples: o fundo sem frente para a via única vira área verde e o cenário avisa quanto passou do mínimo", () => {
    const c = estudo("rua_simples").cenarios[0];
    const nota = (c.limitacoes ?? []).find((n) => /por falta de frente para a via desenhada/.test(n));
    expect(nota).toMatch(/\(\d+(,\d+)?% da gleba\)/);
    expect(nota).toMatch(/prefira Grade ou Cul-de-sac/);
  });

  it("restrição sem aproveitamento nas doações vira peça não parcelável desenhada, somada no quadro", () => {
    // Desde 16/11 a APP conta como área verde por padrão; aqui ela é marcada como \"não conta\".
    const r = gerarEstudoMassa(QUAD, CENTRO, { ...BASE, appM2: 2_000, destinoApp: "nenhum" });
    const c = r.cenarios[0];
    const np = c.lotes.filter((l) => l.tipo === "nao_parcelavel").reduce((s, l) => s + l.areaM2, 0);
    expect(np).toBeGreaterThanOrEqual(2_000 - 1);
    expect(c.quadroAreas!.totalNaoParcelavelM2).toBe(2_000);
    expect(Math.abs(c.fechoAreas!.diferencaM2)).toBeLessThanOrEqual(Math.max(1, 0.005 * areaPlanar(QUAD_M)));
  });
});

describe("R5 — ligação com as ruas existentes do entorno", () => {
  it("grade: acesso posicionado junto à via existente e registrado com o nome da via", () => {
    const r = estudo("grid", VIA_SUL);
    for (const c of r.cenarios) {
      const ligados = (c.acessos ?? []).filter((a) => a.viaExistente);
      expect(ligados.length).toBeGreaterThan(0);
      expect(ligados[0].nomeVia).toBe("Rua Existente Sul");
      expect(ligados[0].distanciaM!).toBeLessThanOrEqual(40);
      expect((c.limitacoes ?? []).join(" ")).toMatch(/via existente "Rua Existente Sul"/);
    }
  });

  it("rua simples: a via única nasce na divisa voltada para a rua existente", () => {
    const r = estudo("rua_simples", VIA_SUL);
    const c = r.cenarios[0];
    const ligados = (c.acessos ?? []).filter((a) => a.viaExistente);
    expect(ligados.length).toBeGreaterThan(0);
    expect(ligados[0].nomeVia).toBe("Rua Existente Sul");
  });

  it("sem dados de vias: ainda exige acesso pela divisa e mostra a nota honesta (a nota antiga deixou de existir)", () => {
    for (const tipologia of TIPOLOGIAS) {
      const c = estudo(tipologia).cenarios[0];
      const notas = (c.limitacoes ?? []).join(" ");
      expect(notas).toContain(NOTA_ACESSO_SEM_VIA);
      expect(notas).not.toMatch(/não é modelada/);
      expect((c.acessos ?? []).every((a) => !a.viaExistente && a.distanciaM === null)).toBe(true);
    }
  });

  it("a assinatura muda quando as vias do entorno mudam", () => {
    expect(assinaturaEntradas(QUAD, BASE, VIA_SUL)).not.toBe(assinaturaEntradas(QUAD, BASE));
    expect(assinaturaEntradas(QUAD, BASE, VIA_SUL)).toBe(assinaturaEntradas(QUAD, BASE, VIA_SUL.map((v) => ({ ...v }))));
  });

  it("camada osm: vias de pedestre não contam como acesso", () => {
    const vias = viasEntornoDoOsm([
      { geometry: { coordinates: [[0, 0], [1, 1]] }, properties: { nome: "Rua A", ref: null, tipo: "residential" } },
      { geometry: { coordinates: [[0, 0], [1, 1]] }, properties: { nome: null, ref: "MA-006", tipo: "primary" } },
      { geometry: { coordinates: [[0, 0], [1, 1]] }, properties: { nome: "Trilha", ref: null, tipo: "footway" } },
    ]);
    expect(vias.map((v) => v.nome)).toEqual(["Rua A", "MA-006"]);
  });
});

describe("R6 — KML com várias áreas separadas e furos", () => {
  const A1 = geo([[-160, -60], [-20, -70], [-10, 60], [-150, 75], [-160, -60]]);
  const A2 = geo([[30, -40], [150, -55], [160, 50], [40, 65], [30, -40]]);
  const duas = gerarEstudoMassa([[A1], [A2]], CENTRO, { ...BASE, tipologia: "grid" });

  it("gera o estudo das duas áreas num único resultado (sem o erro de áreas separadas)", () => {
    expect(duas.inviabilidade).toBeNull();
    expect(duas.areas).toBe(2);
    const c = duas.cenarios[0];
    expect(c.areas).toBe(2);
    const area = areaPlanar(metros(A1)) + areaPlanar(metros(A2));
    expect(c.quadroAreas!.areaBrutaM2).toBeCloseTo(area, 0);
    // lotes nas duas áreas
    const em = (anel: Position[]) => c.lotes.filter((l) => l.tipo === "vendavel" && pontoDentro(metros(anel), ...centroide(metros(l.anel)))).length;
    expect(em(A1)).toBeGreaterThan(0);
    expect(em(A2)).toBeGreaterThan(0);
    // KPIs somados e percentuais sobre o total
    const vend = c.lotes.filter((l) => l.tipo === "vendavel");
    expect(c.kpis.lotesVendaveis).toBe(vend.length);
    expect(c.kpis.areaVendavelM2).toBeCloseTo(vend.reduce((s, l) => s + l.areaM2, 0), 1);
    expect(c.kpis.vgv).toBe(Math.round(c.kpis.areaVendavelM2 * BASE.precoM2Lote));
    expect(c.quadroAreas!.areaInstitucionalM2).toBeGreaterThanOrEqual(0.05 * c.quadroAreas!.areaParcelavelM2 - 1);
    expect(c.quadroAreas!.areaVerdeM2).toBeGreaterThanOrEqual(0.1 * c.quadroAreas!.areaParcelavelM2 - 1);
    expect(Math.abs(c.fechoAreas!.diferencaM2)).toBeLessThanOrEqual(Math.max(1, 0.005 * area));
  });

  it("numeração de quadras contínua entre as áreas, sem colisão de código de lote", () => {
    const c = duas.cenarios[0];
    const vend = c.lotes.filter((l) => l.tipo === "vendavel");
    const codigos = vend.map((l) => `Q${l.quadra}/L${l.numero}`);
    expect(new Set(codigos).size).toBe(codigos.length);
    const quadras = Array.from(new Set(vend.map((l) => Number(l.quadra)))).sort((a, b) => a - b);
    expect(quadras).toEqual(quadras.map((_, i) => i + 1));
  });

  it("área pequena demais vira área verde com aviso, sem derrubar o estudo", () => {
    const pequena = geo([[200, 0], [208, 0], [208, 8], [200, 8], [200, 0]]);
    const r = gerarEstudoMassa([[A1], [pequena]], CENTRO, { ...BASE, tipologia: "grid" });
    expect(r.cenarios.length).toBeGreaterThan(0);
    expect(r.avisos.join(" ")).toMatch(/Área 2 .* destinada inteira a área verde/);
    const verde = r.cenarios[0].lotes.find((l) => l.tipo === "area_publica" && Math.abs(l.areaM2 - 64) < 0.5);
    expect(verde?.uso).toBe("verde");
  });

  it("furo do polígono não recebe lote nem via", () => {
    const furoM: Position[] = [[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]];
    for (const tipologia of TIPOLOGIAS) {
      const r = gerarEstudoMassa([[QUAD, geo(furoM)]], CENTRO, { ...BASE, tipologia });
      expect(r.cenarios.length).toBeGreaterThan(0);
      const c = r.cenarios[0];
      const furo = turfPolygon([furoM]);
      for (const l of c.lotes) {
        const x = intersect(featureCollection([turfPolygon([metros(l.anel)]), furo]));
        // peça pública que contorna o furo leva o furo como anel interno
        const descontado = (l.furos ?? []).reduce((s, f) => s + areaPlanar(metros(f)), 0);
        expect((x ? areaGeo(x.geometry as Polygon | MultiPolygon) : 0) - descontado).toBeLessThan(0.5);
      }
      for (const v of [...(c.ruas ?? []), ...(c.vias ?? [])]) {
        const x = intersect(featureCollection([turfPolygon([metros(v)]), furo]));
        expect(x ? areaGeo(x.geometry as Polygon | MultiPolygon) : 0).toBeLessThan(0.5);
      }
      expect(c.quadroAreas!.areaBrutaM2).toBeCloseTo(areaPlanar(QUAD_M) - 1600, 0);
    }
  });

  it("consumidores: unidades e orçamento contam só os lotes vendáveis das duas áreas, sem código repetido", () => {
    const c = duas.cenarios[0];
    const principal = cenarioPrincipalDe({
      massaCenariosJson: JSON.stringify({ params: { ...BASE, tipologia: "grid" }, cenarios: duas.cenarios }), cenarioEscolhidoId: c.id,
      semKml: false, lotesAvulsosJson: null, areaBrutaM2: c.quadroAreas!.areaBrutaM2,
    });
    // orçamento parametrizado usa `lotes.length` do cenário principal: já são só os vendáveis (sem AV/INST)
    expect(principal!.lotes.length).toBe(c.kpis.lotesVendaveis);
    const unidades = unidadesDoCenario(principal);
    expect(unidades.length).toBe(c.kpis.lotesVendaveis);
    // planta técnica com os dois contornos
    const modelo = montarModeloPlanta(A1, c, CENTRO, [A2]);
    expect(modelo.gleba.length).toBe(2);
    expect(modelo.nLotesVendaveis).toBe(c.kpis.lotesVendaveis);
  });
  // Paridade 17/11: o caso "maquete: terreno = área de MAIOR área" da Prospecta não foi portado — a Maquete 3D
  // não vai para o Grupo Santa Fé (decisão do dono).
});

function centroide(m: Position[]): [number, number] {
  const n = m.length - 1;
  return [m.slice(0, n).reduce((s, p) => s + p[0], 0) / n, m.slice(0, n).reduce((s, p) => s + p[1], 0) / n];
}

describe("R7 — rótulos legíveis na planta técnica", () => {
  const caixas = (svg: string): CaixaRotulo[] =>
    Array.from(svg.matchAll(/data-caixa="([^"]+)"/g)).map((m) => { const [cx, cy, hw, hh, ang] = m[1].split(",").map(Number); return { cx, cy, hw, hh, ang }; });

  it("colisão de caixas giradas (eixo separador)", () => {
    expect(colidem({ cx: 0, cy: 0, hw: 10, hh: 3, ang: 0 }, { cx: 15, cy: 0, hw: 10, hh: 3, ang: 0 })).toBe(true);
    expect(colidem({ cx: 0, cy: 0, hw: 10, hh: 3, ang: 0 }, { cx: 25, cy: 0, hw: 10, hh: 3, ang: 0 })).toBe(false);
    expect(colidem({ cx: 0, cy: 0, hw: 10, hh: 1, ang: Math.PI / 2 }, { cx: 5, cy: 0, hw: 3, hh: 1, ang: 0 })).toBe(false);
  });

  for (const tipologia of TIPOLOGIAS) {
    it(`${tipologia}: nenhum rótulo (lote, quadra ou via) sobrepõe outro, em vários zooms`, () => {
      const c = estudo(tipologia).cenarios[0];
      const modelo = montarModeloPlanta(QUAD, c, CENTRO);
      const v0 = vistaInicial(modelo, 1400, 1000);
      for (const v of [v0, zoomEm(v0, 2.5, 700, 500), vistaInicial(modelo, 600, 400)]) {
        const cs = caixas(renderizarPlantaSvg(modelo, v));
        expect(cs.length).toBeGreaterThan(0);
        for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) expect(colidem(cs[i], cs[j])).toBe(false);
      }
    });
  }

  it("Qxx nunca cai em cima de número de lote; lote estreito (6 m) recebe número menor ao longo do comprimento", () => {
    const r = gerarEstudoMassa(QUAD, CENTRO, { ...BASE, testadaLoteM: 6, profundidadeLoteM: 42, loteMinimoM2: 250 });
    const c = r.cenarios[0];
    const modelo = montarModeloPlanta(QUAD, c, CENTRO);
    const svg = renderizarPlantaSvg(modelo, vistaInicial(modelo, 1400, 1000));
    const lotes = Array.from(svg.matchAll(/<text data-rotulo="lote" data-idx="\d+" data-caixa="([^"]+)" transform="translate\([^)]*\) rotate\(([-\d.]+)\)"><tspan[^>]*font-size="([\d.]+)"/g));
    expect(lotes.length).toBeGreaterThan(0);
    // texto girado ao longo do lado maior: o ângulo do rótulo acompanha a profundidade (lado de 42 m)
    const anguloLongo = (l: (typeof modelo.lotes)[number]) => {
      const a = l.anel;
      let melhor = 0, ang = 0;
      for (let i = 0; i < a.length - 1; i++) { const d = Math.hypot(a[i + 1][0] - a[i][0], a[i + 1][1] - a[i][1]); if (d > melhor) { melhor = d; ang = Math.atan2(-(a[i + 1][1] - a[i][1]), a[i + 1][0] - a[i][0]) * 180 / Math.PI; } }
      return ((ang % 180) + 180) % 180;
    };
    const esperado = anguloLongo(modelo.lotes.find((l) => l.tipo === "vendavel" && !l.irregular)!);
    const girados = lotes.filter((m) => { const d = Math.abs(((Number(m[2]) - esperado) % 180 + 180) % 180); return Math.min(d, 180 - d) < 2; });
    expect(girados.length).toBeGreaterThan(lotes.length / 2);
    expect(lotes.every((m) => Number(m[3]) <= 11)).toBe(true);
    expect(lotes.some((m) => Number(m[3]) < 11)).toBe(true);
    const cs = caixas(svg);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) expect(colidem(cs[i], cs[j])).toBe(false);
  });
});

// ─── Revisão do coordenador (15/11): sem lote em "pente"/faixa, sem área pública minúscula, praças unidas ───
describe("Forma dos lotes e das áreas públicas (revisão da Etapa F)", () => {
  const A1 = geo([[-160, -60], [-20, -70], [-10, 60], [-150, 75], [-160, -60]]);
  const A2 = geo([[30, -40], [150, -55], [160, 50], [40, 65], [30, -40]]);
  const casos: [string, Parameters<typeof gerarEstudoMassa>[0]][] = [["gleba irregular", QUAD], ["duas áreas", [[A1], [A2]]]];
  const nominal = BASE.testadaLoteM * BASE.profundidadeLoteM;
  const resultados = new Map<string, ReturnType<typeof gerarEstudoMassa>>();
  const de = (nome: string, entrada: Parameters<typeof gerarEstudoMassa>[0], tipologia: TipologiaMassa) => {
    const k = `${nome}|${tipologia}`;
    if (!resultados.has(k)) resultados.set(k, gerarEstudoMassa(entrada, CENTRO, { ...BASE, tipologia }));
    return resultados.get(k)!;
  };

  for (const [nome, entrada] of casos) {
    for (const tipologia of TIPOLOGIAS) {
      it(`${tipologia} (${nome}): todo lote vendável tem forma de lote — área ≤ 1,6 × nominal, caixa mínima ≤ 2,2 × profundidade e ocupação ≥ 60%`, () => {
        for (const c of de(nome, entrada, tipologia).cenarios) {
          for (const l of c.lotes.filter((x) => x.tipo === "vendavel")) {
            const m = metros(l.anel);
            const cx = caixaMinima(m);
            expect(l.areaM2).toBeLessThanOrEqual(1.6 * nominal + 1e-6);
            expect(cx.comprimento).toBeLessThanOrEqual(2.2 * BASE.profundidadeLoteM + 0.01);
            expect(l.areaM2).toBeGreaterThanOrEqual(0.6 * cx.area - 0.5);
            expect(formaAceitavel(m, l.areaM2, nominal, BASE.loteMinimoM2, BASE.profundidadeLoteM)).toBe(true);
            // "testada × profundidade média" corresponde ao lote: testada real (≤ a da célula, mais a curva do balão) e área ÷ testada
            if (l.ajuste) {
              // testada é uma medida do próprio lote (frente na via; no lote de esquina, o lado sobre a outra rua)
              expect(l.testadaM!).toBeLessThanOrEqual(cx.comprimento + 0.01);
              expect(l.testadaM! * l.profundidadeMediaM!).toBeCloseTo(l.areaM2, 0);
            }
          }
        }
      });

      it(`${tipologia} (${nome}): área pública < ${AREA_PUBLICA_MINIMA_M2} m² só isolada e avisada; peças contíguas do mesmo uso unidas numa só`, () => {
        for (const c of de(nome, entrada, tipologia).cenarios) {
          const publicas = c.lotes.filter((x) => x.tipo !== "vendavel");
          const pequenas = publicas.filter((x) => x.areaM2 < AREA_PUBLICA_MINIMA_M2);
          if (pequenas.length > 0) expect((c.limitacoes ?? []).join(" ")).toMatch(/peça\(s\) de área pública com menos de 120 m² ficaram isoladas/);
          for (let i = 0; i < publicas.length; i++) {
            for (let j = i + 1; j < publicas.length; j++) {
              const [a, b] = [publicas[i], publicas[j]];
              if (a.tipo !== b.tipo || a.uso !== b.uso) continue;
              const u = union(featureCollection([turfPolygon([metros(a.anel)]), turfPolygon([metros(b.anel)])]));
              // duas peças do mesmo uso não podem formar um polígono só (seriam uma praça partida em duas)
              expect(u?.geometry.type).toBe("MultiPolygon");
            }
          }
        }
      });
    }
  }

  it("rótulo de lote fica inteiro dentro do próprio lote (não invade o vizinho)", () => {
    for (const [nome, entrada] of casos) {
      const c = de(nome, entrada, "grid").cenarios[0];
      const contornos = Array.isArray((entrada as Position[][][])[0][0][0]) ? (entrada as Position[][][]).map((p) => p[0]) : [entrada as Position[]];
      const modelo = montarModeloPlanta(contornos[0], c, CENTRO, contornos.slice(1));
      const v = vistaInicial(modelo, 1400, 1000);
      const svg = renderizarPlantaSvg(modelo, v);
      const rotulos = Array.from(svg.matchAll(/data-rotulo="lote" data-idx="(\d+)" data-caixa="([^"]+)"/g));
      expect(rotulos.length).toBeGreaterThan(0);
      for (const m of rotulos) {
        const [cx, cy, hw, hh, ang] = m[2].split(",").map(Number);
        const tela = modelo.lotes[Number(m[1])].anel.map((p) => [v.tx + p[0] * v.escala, v.ty - p[1] * v.escala]);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          expect(pontoDentro(tela, cx + a * hw * ux - b * hh * uy, cy + a * hw * uy + b * hh * ux)).toBe(true);
        }
      }
    }
  });

  it("rua simples: área verde além do mínimo não é mérito — o 1º cenário é o de maior área vendável", () => {
    const r = estudo("rua_simples");
    for (const c of r.cenarios.slice(1)) expect(c.kpis.areaVendavelM2).toBeLessThanOrEqual(r.cenarios[0].kpis.areaVendavelM2);
  });
});
