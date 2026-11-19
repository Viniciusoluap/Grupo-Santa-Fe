// Estudo de Massa — S-I (EPIC-023): APP com o contorno real. A APP calculada no mapa do Terreno sai da área loteável
// pelo contorno: nenhum lote nem via dentro dela, a peça aparece no desenho na posição real com o destino escolhido,
// sem contar duas vezes no quadro de áreas, e o quadro continua fechando em 100% da gleba.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { featureCollection, intersect, multiPolygon, polygon } from "@turf/turf";
import type { MultiPolygon, Polygon, Position } from "geojson";
import { describe, expect, it, vi } from "vitest";
import {
  assinaturaEntradas, assinaturaRestricoes, criarProjecao, estadoDoContornoApp, gerarEstudoMassa, medirRestricoesNaGleba,
  type CenarioMassa, type EntradaGleba, type ParametrosMassa, type RestricaoGeometrica,
} from "@/lib/geo/massa-parcelamento";
import { montarModeloPlanta, renderizarPlantaSvg, vistaInicial } from "@/lib/geo/planta-tecnica";
import { MAX_VERTICES_CONTORNO_APP, contornoAppParaGravar } from "@/lib/geo/camadas-terreno";
import { contornoAoSalvarApp, validarContornoApp } from "@/lib/incorporacao/app-contorno";

// Paridade 17/11: o motor de massa 3.0.0 (malha conectada, recorte na divisa) é mais pesado; com 3 workers em
// paralelo os cenários grandes passam de 5 s. Prazo maior só neste arquivo (nenhum teste foi pulado ou afrouxado).
vi.setConfig({ testTimeout: 60_000 });

const CENTRO: [number, number] = [-47.49, -5.52];
const proj = criarProjecao(CENTRO);
const geo = (pts: [number, number][]): Position[] => { const a = pts.map((p) => proj.paraGeo(p)); a.push(a[0]); return a; };
const ret = (x0: number, y0: number, x1: number, y1: number) => geo([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

const PARAMS: ParametrosMassa = {
  larguraViaM: 12, testadaLoteM: 10, profundidadeLoteM: 25, loteMinimoM2: 250, comprimentoMaxQuadraM: 120,
  percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500,
  // valor em m² "velho" no campo: com o contorno, o m² da APP vem do contorno, nunca deste número
  appM2: 31_000,
};

// gleba 400 × 240 m; APP na ponta oeste (80 m dentro da gleba, o contorno passa da divisa e é recortado)
const GLEBA = ret(-200, -120, 200, 120);
const APP_OESTE: RestricaoGeometrica = { tipo: "app", poligonos: [[ret(-260, -160, -120, 160)]] };
const APP_OESTE_M2 = 80 * 240;
// APP no meio, de divisa a divisa: corta a gleba em duas partes
const APP_MEIO: RestricaoGeometrica = { tipo: "app", poligonos: [[ret(-30, -150, 30, 150)]] };
const APP_MEIO_M2 = 60 * 240;

const m = (anel: Position[]) => anel.map((p) => proj.paraMetros(p));
function areaInter(a: Position[], r: RestricaoGeometrica): number {
  const x = intersect(featureCollection<Polygon | MultiPolygon>([polygon([m(a)]), multiPolygon(r.poligonos.map((poli) => poli.map(m)))]));
  if (!x) return 0;
  const ps = x.geometry.type === "Polygon" ? [x.geometry.coordinates] : x.geometry.coordinates;
  let s = 0;
  for (const p of ps) p.forEach((anel, k) => {
    let t = 0;
    for (let i = 0; i < anel.length - 1; i++) t += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
    s += (k === 0 ? 1 : -1) * Math.abs(t / 2);
  });
  return s;
}

/** Sobreposição (m²) de lotes vendáveis e de vias com a APP. */
function sobreposicao(c: CenarioMassa, r: RestricaoGeometrica) {
  const lotes = c.lotes.filter((l) => l.tipo === "vendavel").reduce((s, l) => s + areaInter(l.anel, r), 0);
  const vias = [...(c.ruas ?? []), ...(c.vias ?? [])].reduce((s, a) => s + areaInter(a, r), 0);
  return { lotes, vias };
}

function conferir(c: CenarioMassa, r: RestricaoGeometrica, appM2: number) {
  const s = sobreposicao(c, r);
  expect(s.lotes).toBeLessThan(1);
  expect(s.vias).toBeLessThan(1);
  const app = c.lotes.filter((l) => l.restricao === "app");
  expect(app.length).toBeGreaterThan(0);
  expect(app.reduce((t, l) => t + l.areaM2, 0)).toBeCloseTo(appM2, 0);
  expect(c.quadroAreas?.appM2).toBeCloseTo(appM2, 0);
  expect(Math.abs(c.fechoAreas!.diferencaM2)).toBeLessThanOrEqual(0.05);
  expect(c.kpis.lotesVendaveis).toBeGreaterThan(0);
}

describe("S-I — APP com o contorno real no motor do Estudo de Massa", () => {
  for (const tipologia of ["grid", "cul_de_sac"] as const) {
    it(`${tipologia}: nenhum lote nem via na APP, peça da APP na posição real e quadro fechando`, () => {
      const r = gerarEstudoMassa(GLEBA, CENTRO, { ...PARAMS, tipologia }, { nCenarios: 1, restricoes: [APP_OESTE] });
      const c = r.cenarios[0];
      conferir(c, APP_OESTE, APP_OESTE_M2);
      // destino padrão: conta como área verde, e a verde exigida (10% da parcelável) já é coberta pela APP
      const app = c.lotes.filter((l) => l.restricao === "app");
      expect(app.every((l) => l.tipo === "area_publica" && l.uso === "verde")).toBe(true);
      expect(c.quadroAreas?.areaVerdeEmRestricaoM2).toBeCloseTo(APP_OESTE_M2, 0);
      expect(c.quadroAreas?.areaVerdeExigidaM2).toBeCloseTo(0.1 * (96_000 - APP_OESTE_M2), 0);
      expect(c.limitacoes?.some((n) => n.startsWith("APP desenhada pelo contorno real") && n.includes("31.000"))).toBe(true);
      // a APP fica do lado oeste: todos os vértices dela estão a oeste de x = −120 m
      for (const l of app) for (const p of m(l.anel)) expect(p[0]).toBeLessThanOrEqual(-120 + 1e-6);
    });
  }

  it("sem o contorno, a APP informada em m² continua como hoje (desenhada fora da posição real)", () => {
    const sem = gerarEstudoMassa(GLEBA, CENTRO, { ...PARAMS, appM2: APP_OESTE_M2 }, { nCenarios: 1 });
    const vazio = gerarEstudoMassa(GLEBA, CENTRO, { ...PARAMS, appM2: APP_OESTE_M2 }, { nCenarios: 1, restricoes: [] });
    expect(vazio).toEqual(sem);
    expect(sem.cenarios[0].lotes.some((l) => l.restricao)).toBe(false);
    expect(sem.cenarios[0].quadroAreas?.appM2).toBe(APP_OESTE_M2);
    // assinatura sem restrição igual à de antes (cache dos estudos já gerados continua valendo)
    expect(assinaturaEntradas(GLEBA, PARAMS, null, [])).toBe(assinaturaEntradas(GLEBA, PARAMS, null));
    expect(assinaturaEntradas(GLEBA, PARAMS, null, [APP_OESTE])).not.toBe(assinaturaEntradas(GLEBA, PARAMS, null));
  });

  it("os três destinos da APP: área verde, institucional ou só não parcelável — sem contar duas vezes", () => {
    const rodar = (destinoApp: "verde" | "institucional" | "nenhum") =>
      gerarEstudoMassa(GLEBA, CENTRO, { ...PARAMS, destinoApp }, { nCenarios: 1, restricoes: [APP_OESTE] }).cenarios[0];
    const verde = rodar("verde"), inst = rodar("institucional"), nenhum = rodar("nenhum");
    for (const c of [verde, inst, nenhum]) conferir(c, APP_OESTE, APP_OESTE_M2);
    const app = (c: CenarioMassa) => c.lotes.filter((l) => l.restricao === "app");
    expect(app(inst).every((l) => l.tipo === "area_publica" && l.uso === "institucional")).toBe(true);
    expect(app(nenhum).every((l) => l.tipo === "nao_parcelavel" && !l.uso)).toBe(true);
    expect(inst.quadroAreas?.areaInstitucionalEmRestricaoM2).toBeCloseTo(APP_OESTE_M2, 0);
    expect(nenhum.quadroAreas?.areaVerdeEmRestricaoM2 ?? 0).toBe(0);
    expect(nenhum.quadroAreas?.economiaPorAproveitamentoM2).toBe(0);
    // a APP "só não parcelável" não cobre a verde exigida: a verde desenhada fora da APP é ao menos a exigida
    const verdeFora = (c: CenarioMassa) => c.lotes.filter((l) => !l.restricao && l.tipo === "area_publica" && l.uso === "verde").reduce((s, l) => s + l.areaM2, 0);
    expect(verdeFora(nenhum)).toBeGreaterThanOrEqual(0.1 * (96_000 - APP_OESTE_M2) - 1);
    // não há dupla contagem: a parcelável do quadro é a gleba menos a APP do contorno, nos três casos
    for (const c of [verde, inst, nenhum]) expect(c.quadroAreas?.areaParcelavelM2).toBeCloseTo(96_000 - APP_OESTE_M2, 0);
  });

  it("APP que corta a gleba em duas: cada parte vira uma área contínua com a própria malha", () => {
    for (const tipologia of ["grid", "cul_de_sac"] as const) {
      const r = gerarEstudoMassa(GLEBA, CENTRO, { ...PARAMS, tipologia }, { nCenarios: 1, restricoes: [APP_MEIO] });
      expect(r.areas).toBe(2);
      const c = r.cenarios[0];
      conferir(c, APP_MEIO, APP_MEIO_M2);
      expect(c.limitacoes?.some((n) => n.includes("dividem a gleba em 2 partes"))).toBe(true);
      // lotes dos dois lados da APP
      const xs = c.lotes.filter((l) => l.tipo === "vendavel").map((l) => m(l.anel)[0][0]);
      expect(xs.some((x) => x < -30)).toBe(true);
      expect(xs.some((x) => x > 30)).toBe(true);
    }
  });

  it("KML com várias áreas e furo: a APP numa delas sai só dali", () => {
    const furo = ret(140, -20, 170, 20).reverse();
    const entrada: EntradaGleba = [[ret(-200, -120, 0, 120)], [ret(60, -120, 260, 120), furo]];
    const appM2 = 60 * 240; // x ∈ [−200, −140] dentro da área 1
    const app: RestricaoGeometrica = { tipo: "app", poligonos: [[ret(-240, -200, -140, 200)]] };
    const r = gerarEstudoMassa(entrada, CENTRO, PARAMS, { nCenarios: 1, restricoes: [app] });
    const c = r.cenarios[0];
    conferir(c, app, appM2);
    expect(c.fechoAreas?.areaGlebaM2).toBeCloseTo(2 * 200 * 240 - 30 * 40, 0);
    // nada sobre o furo
    const noFuro: RestricaoGeometrica = { tipo: "app", poligonos: [[ret(140, -20, 170, 20)]] };
    expect(sobreposicao(c, noFuro).lotes).toBeLessThan(1);
  });

  it("determinístico: mesma entrada, mesmo resultado", () => {
    const a = gerarEstudoMassa(GLEBA, CENTRO, PARAMS, { nCenarios: 2, restricoes: [APP_MEIO] });
    const b = gerarEstudoMassa(GLEBA, CENTRO, PARAMS, { nCenarios: 2, restricoes: [APP_MEIO] });
    expect(b).toEqual(a);
  });

  it("contorno fora da gleba, vazio ou inválido: vale o m² informado, com aviso para reabrir o mapa do Terreno (nunca zero em silêncio)", () => {
    const casos: RestricaoGeometrica[] = [
      { tipo: "app", poligonos: [[ret(400, 400, 500, 500)]] },
      { tipo: "app", poligonos: [[[]]] },
      { tipo: "app", poligonos: [] },
      { tipo: "app", poligonos: [[[[NaN, NaN], [NaN, 1], [1, 1], [NaN, NaN]]]] },
    ];
    for (const r of casos) {
      const out = gerarEstudoMassa(GLEBA, CENTRO, PARAMS, { nCenarios: 1, restricoes: [r] });
      const c = out.cenarios[0];
      expect(c.quadroAreas?.appM2).toBe(31_000);
      expect(c.lotes.some((l) => l.restricao)).toBe(false);
      const aviso = out.avisos.find((a) => a.startsWith("O contorno da APP guardado no estudo não cai neste terreno"));
      expect(aviso).toContain("31.000 m²");
      expect(aviso).toContain("Abra o mapa da aba Terreno");
      expect(c.limitacoes).toContain(aviso);
      expect(medirRestricoesNaGleba(GLEBA, CENTRO, [r]).app).toBe(0);
    }
  });

  it("assinatura do resultado inclui o contorno; cada cenário leva a marca do contorno com que foi gerado", () => {
    const com = gerarEstudoMassa(GLEBA, CENTRO, PARAMS, { nCenarios: 1, restricoes: [APP_OESTE] });
    const sem = gerarEstudoMassa(GLEBA, CENTRO, PARAMS, { nCenarios: 1 });
    expect(com.assinatura).toBe(assinaturaEntradas(GLEBA, PARAMS, null, [APP_OESTE]));
    expect(com.assinatura).not.toBe(sem.assinatura);
    expect(com.cenarios.every((c) => c.contornoRestricoes === assinaturaRestricoes([APP_OESTE]))).toBe(true);
    expect(sem.cenarios.every((c) => c.contornoRestricoes === undefined)).toBe(true);
    // a tela mede a APP como o motor (mesmo número do quadro de áreas)
    expect(medirRestricoesNaGleba(GLEBA, CENTRO, [APP_OESTE]).app).toBeCloseTo(com.cenarios[0].quadroAreas!.appM2, 1);
    // aviso da tela: cenários antigos (sem contorno) sob um estudo que já tem contorno → gerar de novo
    const base = { restricoes: [APP_OESTE], appAreaM2: 19_000, appNaGlebaM2: APP_OESTE_M2 };
    expect(estadoDoContornoApp({ ...base, cenarios: com.cenarios })).toBe("contorno");
    expect(estadoDoContornoApp({ ...base, cenarios: sem.cenarios })).toBe("cenarios_sem_contorno");
    expect(estadoDoContornoApp({ ...base, cenarios: [{ contornoRestricoes: assinaturaRestricoes([APP_MEIO]) }] })).toBe("cenarios_sem_contorno");
    expect(estadoDoContornoApp({ ...base, cenarios: [] })).toBe("contorno");
    expect(estadoDoContornoApp({ ...base, appNaGlebaM2: 0, cenarios: com.cenarios })).toBe("fora_do_terreno");
    expect(estadoDoContornoApp({ restricoes: null, appAreaM2: 19_000, appNaGlebaM2: null, cenarios: [] })).toBe("sem_contorno");
    expect(estadoDoContornoApp({ restricoes: null, appAreaM2: 0, appNaGlebaM2: null, cenarios: [] })).toBeNull();
  });

  it("parte cercada pela APP ou com as vias do outro lado: a nota do acesso diz que é preciso atravessar a APP", () => {
    const ilha: RestricaoGeometrica = { tipo: "app", poligonos: [[ret(-300, -300, 300, 300), ret(-100, -80, 100, 80).reverse()]] };
    const c1 = gerarEstudoMassa(GLEBA, CENTRO, PARAMS, { nCenarios: 1, restricoes: [ilha] }).cenarios[0];
    expect(c1.limitacoes?.some((n) => n.includes("cercada pela área restrita (APP)") && n.includes("licença ambiental"))).toBe(true);
    expect(c1.limitacoes?.some((n) => n.includes("Acesso externo a confirmar em projeto: não há via pública mapeada junto à divisa."))).toBe(false);
    expect(c1.acessos ?? []).toEqual([]);
    const via = [{ nome: "Rua Sul", coords: [proj.paraGeo([-300, -126]), proj.paraGeo([300, -126])] }];
    const faixa: RestricaoGeometrica = { tipo: "app", poligonos: [[ret(-300, -10, 300, 10)]] };
    const c2 = gerarEstudoMassa(GLEBA, CENTRO, PARAMS, { nCenarios: 1, restricoes: [faixa], viasEntorno: via }).cenarios[0];
    expect(c2.limitacoes?.some((n) => n.includes("Rua Sul"))).toBe(true);
    expect(c2.limitacoes?.some((n) => /atravessar a APP/.test(n))).toBe(true);
  });

  it("planta técnica identifica a APP (rótulo e legenda)", () => {
    const c = gerarEstudoMassa(GLEBA, CENTRO, { ...PARAMS, destinoApp: "nenhum" }, { nCenarios: 1, restricoes: [APP_OESTE] }).cenarios[0];
    const modelo = montarModeloPlanta(GLEBA, c, CENTRO);
    expect(modelo.restricoes).toEqual([expect.objectContaining({ tipo: "app", rotulo: "APP", destino: "só não parcelável" })]);
    const svg = renderizarPlantaSvg(modelo, vistaInicial(modelo, 1200, 800));
    expect(svg).toContain(">APP</tspan>");
    expect(svg).toContain("APP (contorno real)");
    // Paridade 17/11: a conferência da Maquete 3D (APP como área verde na implantação) não foi portada — a
    // Maquete 3D não vai para o Grupo Santa Fé (decisão do dono).
  });
});

// Paridade 17/11: o bloco "S-I — maquete: peça com furo não cobre a ilha" (pecasSemFuros/implantacaoDoEstudo) não foi
// portado — é da Maquete 3D, que não vai para o Grupo Santa Fé.

describe("S-I — contorno da APP gravado no estudo", () => {
  it("saveApp: contorno explícito grava, null apaga; cliente antigo (sem o campo) mantém, salvo se a área mudou mais de 2%", () => {
    const g = { type: "MultiPolygon", coordinates: [[ret(-10, -10, 10, 10)]] };
    expect(contornoAoSalvarApp({ areaM2: 1000, contorno: g }, 1000)).toBe(JSON.stringify(g));
    expect(contornoAoSalvarApp({ areaM2: 1000, contorno: null }, 1000)).toBeNull();
    expect(contornoAoSalvarApp({ areaM2: 1000 }, 1000)).toBeUndefined();
    expect(contornoAoSalvarApp({ areaM2: 1015 }, 1000)).toBeUndefined();
    expect(contornoAoSalvarApp({ areaM2: 1100 }, 1000)).toBeNull();
    expect(contornoAoSalvarApp({ areaM2: 1000 }, null)).toBeNull();
    expect(contornoAoSalvarApp({ areaM2: 0, contorno: g }, 1000)).toBeNull();
  });

  it("contornoAppParaGravar: contorno enorme é simplificado até caber — sempre guarda um contorno para uma APP válida", () => {
    // círculo de 30.000 vértices com 400 furos de 40 vértices
    const anel = (cx: number, cy: number, r: number, n: number, horario = false) => {
      const pts: [number, number][] = [];
      for (let k = 0; k < n; k++) { const t = ((horario ? -1 : 1) * 2 * Math.PI * k) / n; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
      return geo(pts);
    };
    const furos: Position[][] = [];
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) furos.push(anel(-950 + i * 100, -950 + j * 100, 20, 40, true));
    const g = contornoAppParaGravar({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [anel(0, 0, 1500, 30_000), ...furos] } });
    expect(g).not.toBeNull();
    const n = g!.coordinates.reduce((s, p) => s + p.reduce((t, a) => t + a.length, 0), 0);
    expect(n).toBeLessThanOrEqual(MAX_VERTICES_CONTORNO_APP);
  });

  it("contornoAppParaGravar: MultiPolygon com 7 casas e anéis fechados; nulo sem APP", () => {
    expect(contornoAppParaGravar(null)).toBeNull();
    const g = contornoAppParaGravar({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ret(-10, -10, 10, 10)] } })!;
    expect(g.type).toBe("MultiPolygon");
    const anel = g.coordinates[0][0];
    expect(anel[0]).toEqual(anel[anel.length - 1]);
    for (const p of anel) for (const v of p) expect(Math.round(v * 1e7) / 1e7).toBe(v);
  });

  it("migração 20261117200000 (equivalente à 0117): aditiva e idempotente (coluna nova, nula)", async () => {
    const pg = new PGlite();
    await pg.exec(`CREATE TABLE "estudos_incorporacao" (id text PRIMARY KEY, nome text, "appAreaM2" double precision);
      INSERT INTO "estudos_incorporacao" (id, nome, "appAreaM2") VALUES ('e1', 'Gleba', 1234.5);`);
    const sql = readFileSync(new URL("../../../prisma/migrations/20261117200000_contorno_app_estudo/migration.sql", import.meta.url), "utf8");
    await pg.exec(sql);
    await pg.exec(sql);
    const r = await pg.query<{ nome: string; appAreaM2: number; appContornoJson: string | null }>('SELECT nome, "appAreaM2", "appContornoJson" FROM "estudos_incorporacao"');
    expect(r.rows).toEqual([{ nome: "Gleba", appAreaM2: 1234.5, appContornoJson: null }]);
    await pg.close();
  });

  it("validarContornoApp: mesmos limites do schema da Prospecta (tipo, anel ≥ 4 pontos, lng/lat, teto de vértices)", () => {
    const g = { type: "MultiPolygon", coordinates: [[ret(-10, -10, 10, 10).map((p) => [p[0] / 1e5, p[1] / 1e5])]] };
    expect(validarContornoApp(undefined)).toBeNull();
    expect(validarContornoApp(null)).toBeNull();
    expect(validarContornoApp(g)).toBeNull();
    expect(validarContornoApp({ type: "Polygon", coordinates: g.coordinates[0] })).toMatch(/inválido/);
    expect(validarContornoApp({ type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [0, 0]]]] })).toMatch(/inválido/);
    expect(validarContornoApp({ type: "MultiPolygon", coordinates: [[[[0, 0], [200, 0], [1, 1], [0, 0]]]] })).toMatch(/longitude/);
    const muitos: Position[] = [];
    for (let i = 0; i <= MAX_VERTICES_CONTORNO_APP; i++) { const a = (2 * Math.PI * i) / MAX_VERTICES_CONTORNO_APP; muitos.push([Math.cos(a) / 1e3, Math.sin(a) / 1e3]); }
    expect(validarContornoApp({ type: "MultiPolygon", coordinates: [[muitos]] })).toMatch(/vértices demais/);
  });
});
