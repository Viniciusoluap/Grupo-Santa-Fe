// Camadas do mapa do terreno (pedido de 11/11). Respostas REAIS dos serviços
// oficiais gravadas em src/lib/geo/__fixtures__/camadas-terreno (Imperatriz/MA etc.);
// nenhum teste acessa a rede — o fetch é substituído pela reprodução da gravação.
// Gêmeo de Prospecta/server/geo-camadas-terreno.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  FONTES, bboxComFolga, calcularApp, calcularServidao, calcularVegetacao, consultaOverpass, larguraAppCodigoFlorestal,
  larguraFaixaLt, linhasOsmComplementares, normalizarOverpass, avaliarGeologia, resumirFuros, tensaoOsmKv, urlConsultaArcgis,
  zoomNativoEsri, gradeAmostragem, carConfere, limparLargurasConfirmadas, normalizarCaptacoes, normalizarDutosEpe, poligonosEsri,
  type Contorno,
} from "@/lib/geo/camadas-terreno";
import { buscarCamadasTerreno, idsValidos, limparCacheCamadas, validarContorno } from "@/lib/geo/camadas-terreno-busca";

type Gravacao = { terreno: { lat: number; lng: number; meiaLadoM: number }; chamadas: { url: string; corpo: string | null; resposta: string }[] };

const cenario = (nome: string): Gravacao =>
  JSON.parse(readFileSync(join(__dirname, "..", "geo", "__fixtures__", "camadas-terreno", `${nome}.json`), "utf8"));

function quadrado({ lat, lng, meiaLadoM }: Gravacao["terreno"]): Contorno {
  const d = meiaLadoM / 110540, e = meiaLadoM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[lng - e, lat - d], [lng + e, lat - d], [lng + e, lat + d], [lng - e, lat + d], [lng - e, lat - d]]] } };
}

/** Reproduz as respostas gravadas; o que não foi gravado falha como rede fora. */
function reprodutor(g: Gravacao) {
  const chamadas: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    chamadas.push(String(url));
    const achou = g.chamadas.find(c => c.url === String(url) && (c.corpo ?? null) === ((init?.body as string | undefined) ?? null));
    if (!achou) throw new TypeError("fetch failed");
    const status = /^\{"remark":|rate_limited|Too Many/i.test(achou.resposta) ? 429 : 200;
    return new Response(achou.resposta, { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, chamadas };
}

beforeEach(() => limparCacheCamadas());

describe("fontes e consultas", () => {
  it("monta a query ArcGIS REST por envelope em WGS84 devolvendo GeoJSON", () => {
    const u = new URL(urlConsultaArcgis(FONTES.ucs.url, [-47.6, -5.5, -47.5, -5.4], "nome_uc"));
    expect(u.searchParams.get("geometry")).toBe("-47.6,-5.5,-47.5,-5.4");
    expect(u.searchParams.get("geometryType")).toBe("esriGeometryEnvelope");
    expect(u.searchParams.get("inSR")).toBe("4326");
    expect(u.searchParams.get("f")).toBe("geojson");
  });
  it("bbox com folga cresce a distância pedida (≈600 m em latitude)", () => {
    const t = quadrado({ lat: -5.4731, lng: -47.53452, meiaLadoM: 350 });
    const [, s] = bboxComFolga(t, 0), [, s2] = bboxComFolga(t, 600);
    expect((s - s2) * 110540).toBeGreaterThan(590);
    expect((s - s2) * 110540).toBeLessThan(610);
  });
  it("Overpass busca água, nascentes, vias e linhas no bbox (sul,oeste,norte,leste)", () => {
    const q = consultaOverpass([-47.6, -5.5, -47.5, -5.4]);
    expect(q).toContain('node["natural"="spring"](-5.5,-47.6,-5.4,-47.5)');
    expect(q).toContain('relation["natural"="water"]');
  });
  it("grade de amostragem respeita o máximo de pontos e o pixel de 30 m", () => {
    const g = gradeAmostragem(quadrado({ lat: -5.47, lng: -47.53, meiaLadoM: 2000 }));
    expect(g.pontos.length).toBeLessThanOrEqual(80);
    expect(gradeAmostragem(quadrado({ lat: -5.47, lng: -47.53, meiaLadoM: 40 })).ladoM).toBeGreaterThanOrEqual(30);
  });
});

describe("terreno na margem do Tocantins (Imperatriz/MA, -5,47310 −47,53452)", () => {
  const g = cenario("imperatriz-margem-tocantins");
  const terreno = quadrado(g.terreno);

  it("cada camada tem estado próprio — Overpass fora não derruba as oficiais", async () => {
    const { fetchImpl } = reprodutor(g);
    const r = await buscarCamadasTerreno(terreno, idsValidos(undefined), { fetchImpl });
    expect(r.camadas.hidrografia?.estado).toBe("ok");
    expect(r.camadas.osm?.estado).toBe("indisponivel");
    expect(r.camadas.osm?.fonte).toContain("overpass");
    expect(r.camadas.osm?.erro).toMatch(/HTTP 429|fetch failed/);
    expect(r.camadas.ucs?.estado).toBe("vazio");
    expect(r.camadas.transmissao?.estado).toBe("vazio");
    expect(r.camadas.geologia?.estado).toBe("ok");
    expect(r.camadas.furos?.estado).toBe("ok");
    expect(r.camadas.vegetacao?.estado).toBe("ok");
  });

  it("hidrografia oficial: Rio Tocantins como polígono largo + trechos da BHO", async () => {
    const r = await buscarCamadasTerreno(terreno, ["hidrografia"], { fetchImpl: reprodutor(g).fetchImpl });
    const h = r.camadas.hidrografia!.dados!;
    expect(h.aguas.some(a => a.properties.nome === "Rio Tocantins")).toBe(true);
    expect(h.aguas[0].properties.larguraM!).toBeGreaterThan(600); // largura do lago medida antes do recorte
    expect(h.rios.length).toBeGreaterThan(0);
    expect(h.rios.every(rio => rio.properties.origem === "ANA")).toBe(true);
  });

  it("APP automática pega a faixa de 500 m do Tocantins e mede só dentro do terreno", async () => {
    const r = await buscarCamadasTerreno(terreno, ["hidrografia"], { fetchImpl: reprodutor(g).fetchImpl });
    const auto = calcularApp(terreno, [r.camadas.hidrografia!.dados!], "auto");
    expect(auto.larguraM).toBe(500);
    expect(auto.percentual).toBeGreaterThan(5);
    expect(auto.percentual).toBeLessThan(30);
    const manual = calcularApp(terreno, [r.camadas.hidrografia!.dados!], "500");
    expect(manual.areaM2).toBeGreaterThan(auto.areaM2);
    expect(manual.percentual).toBeLessThanOrEqual(100);
  });

  it("geologia (SGB) e furos (SIAGAS): 15 poços entre 1,6 e 4,9 km — como o concorrente", async () => {
    const r = await buscarCamadasTerreno(terreno, ["geologia", "furos"], { fetchImpl: reprodutor(g).fetchImpl });
    const geo = r.camadas.geologia!.dados!;
    expect(geo.unidades.map(u => u.nome)).toEqual(["Codó", "Depósitos aluvionares"]);
    expect(geo.avaliacao.rotulo).toBe("atenção: várzea");
    const f = resumirFuros(r.camadas.furos!.dados!);
    expect(f.total).toBe(15);
    expect(f.distanciaMinKm!).toBeCloseTo(1.66, 1);
    expect(f.distanciaMaxKm!).toBeCloseTo(4.86, 1);
  });

  it("vegetação nativa (MapBiomas 2023) em % do terreno", async () => {
    const r = await buscarCamadasTerreno(terreno, ["vegetacao"], { fetchImpl: reprodutor(g).fetchImpl });
    const v = calcularVegetacao(terreno, r.camadas.vegetacao!.dados!);
    expect(v.amostras).toBe(64);
    expect(v.classes[0].nome).toBe("Pastagem");
    expect(v.percentualNativa).toBeGreaterThan(0);
    expect(v.percentualNativa).toBeLessThan(10);
  });

  it("cache por terreno: a 2ª busca não chama a rede para o que já respondeu; o indisponível é tentado de novo", async () => {
    const rep = reprodutor(g);
    await buscarCamadasTerreno(terreno, ["geologia", "osm"], { fetchImpl: rep.fetchImpl });
    const antes = rep.chamadas.length;
    await buscarCamadasTerreno(terreno, ["geologia", "osm"], { fetchImpl: rep.fetchImpl });
    const novas = rep.chamadas.slice(antes);
    expect(novas.some(u => u.includes("geodiversidade"))).toBe(false);
    expect(novas.some(u => u.includes("overpass"))).toBe(true);
  });
});

describe("outros terrenos reais", () => {
  it("Imperatriz leste: nascente derivada da BHO entra na APP (raio 50 m) e geologia favorável", async () => {
    const g = cenario("imperatriz-leste");
    const terreno = quadrado(g.terreno);
    const r = await buscarCamadasTerreno(terreno, ["hidrografia", "geologia", "vegetacao"], { fetchImpl: reprodutor(g).fetchImpl });
    const h = r.camadas.hidrografia!.dados!;
    expect(h.nascentes.length).toBe(1);
    expect(calcularApp(terreno, [h], "auto").areaM2).toBeGreaterThan(0);
    expect(r.camadas.geologia!.dados!.avaliacao.risco).toBe("baixo");
    expect(calcularVegetacao(terreno, r.camadas.vegetacao!.dados!).percentualNativa).toBeCloseTo(12.5, 1);
  });

  it("linhas de transmissão da EPE: faixa de servidão pela tensão (230 kV → 40 m; 500 kV → 70 m)", async () => {
    const g = cenario("imperatriz-linhas-transmissao");
    const terreno = quadrado(g.terreno);
    const r = await buscarCamadasTerreno(terreno, ["transmissao", "rodovias"], { fetchImpl: reprodutor(g).fetchImpl });
    const linhas = r.camadas.transmissao!.dados!.linhas;
    expect(linhas.length).toBeGreaterThan(0);
    const s = calcularServidao(terreno, linhas, r.camadas.rodovias?.dados?.rodovias ?? []);
    expect(s.areaM2).toBeGreaterThan(0);
    expect(s.itens.find(i => i.tensaoKv === 230)?.larguraTotalM).toBe(40);
    expect(s.itens.find(i => i.tensaoKv === 500)?.larguraTotalM).toBe(70);
    expect(s.percentual).toBeLessThan(100);
  });

  it("UC a 1,1 km aparece com nome e distância (CNUC via Pamgia)", async () => {
    const g = cenario("uc-rppn-arara-azul");
    const r = await buscarCamadasTerreno(quadrado(g.terreno), ["ucs"], { fetchImpl: reprodutor(g).fetchImpl });
    const uc = r.camadas.ucs!.dados!.ucs[0];
    expect(uc.nome).toContain("ARARA AZUL");
    expect(uc.sobrepoe).toBe(false);
    expect(uc.distanciaM).toBeGreaterThan(900);
    expect(uc.distanciaM).toBeLessThan(1300);
  });
});

describe("resiliência", () => {
  const terreno = quadrado({ lat: -5.4731, lng: -47.53452, meiaLadoM: 350 });

  it("fonte lenta vira 'indisponível' com o motivo, sem travar", async () => {
    const fetchImpl = ((_u: string, init?: RequestInit) => new Promise((_, rej) => {
      init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "TimeoutError" })));
    })) as unknown as typeof fetch;
    const r = await buscarCamadasTerreno(terreno, ["geologia"], { fetchImpl, timeoutMs: 30 });
    expect(r.camadas.geologia?.estado).toBe("indisponivel");
    expect(r.camadas.geologia?.erro).toContain("não respondeu a tempo");
  });

  it("erro do ArcGIS com HTTP 200 cai para o espelho (UCs: SIGAGEO)", async () => {
    const vazio = JSON.stringify({ type: "FeatureCollection", features: [] });
    const fetchImpl = (async (u: string) => new Response(String(u).includes("lim_unidades") ? JSON.stringify({ error: { code: 500, message: "GISService" } }) : vazio)) as unknown as typeof fetch;
    const r = await buscarCamadasTerreno(terreno, ["ucs"], { fetchImpl });
    expect(r.camadas.ucs?.estado).toBe("vazio");
    expect(r.camadas.ucs?.fonte).toBe(FONTES.ucsEspelho.nome);
  });

  it("valida o contorno recebido", () => {
    expect(() => validarContorno({ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] } })).toThrow();
    expect(() => validarContorno(JSON.stringify(terreno))).not.toThrow();
    expect(idsValidos(["ucs", "xpto"])).toEqual(["ucs"]);
  });
});

describe("regras de cálculo", () => {
  it("Código Florestal art. 4º, I", () => {
    expect([5, 10, 49, 50, 199, 200, 599, 600].map(larguraAppCodigoFlorestal)).toEqual([30, 50, 50, 100, 100, 200, 200, 500]);
  });
  it("tabela de faixa de servidão por tensão", () => {
    expect([13.8, 69, 138, 230, 345, 440, 500, 800, null].map(larguraFaixaLt)).toEqual([15, 20, 30, 40, 50, 60, 70, 100, 40]);
    expect(tensaoOsmKv("230000;69000")).toBe(230);
    expect(tensaoOsmKv("13800")).toBe(13.8);
    expect(tensaoOsmKv(undefined)).toBeNull();
  });
  it("geologia: rocha dura vira alerta", () => {
    expect(avaliarGeologia([{ sigla: "x", nome: "Granito", litotipo: "Granito", dominio: null, relevo: null, declividade: null, coerencia: "Muito duras", mapa: null }]).risco).toBe("alto");
  });
  it("OSM: costura relação multipolígono do rio e lê tensão das linhas (amostra sintética no formato do Overpass)", () => {
    const d = normalizarOverpass({ elements: [
      { type: "relation", tags: { natural: "water", name: "Rio" }, members: [
        { type: "way", role: "outer", geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }] },
        { type: "way", role: "outer", geometry: [{ lat: 0.01, lon: 0.01 }, { lat: 0, lon: 0.01 }] },
        { type: "way", role: "outer", geometry: [{ lat: 0.01, lon: 0.01 }, { lat: 0, lon: 0 }] },
      ] },
      { type: "way", tags: { power: "line", voltage: "138000" }, geometry: [{ lat: 0, lon: 0 }, { lat: 0.01, lon: 0 }] },
      { type: "node", tags: { natural: "spring" }, lat: 0.005, lon: 0.005 },
    ] });
    expect(d.aguas).toHaveLength(1);
    expect(d.linhas[0].properties.tensaoKv).toBe(138);
    expect(d.nascentes).toHaveLength(1);
    expect(linhasOsmComplementares(d.linhas, d.linhas)).toHaveLength(0);
  });
  it("zoom nativo da Esri: para no primeiro nível sem foto (tilemap)", async () => {
    const fetchImpl = (async (u: string) => {
      const z = Number(String(u).match(/tilemap\/(\d+)\//)![1]);
      return new Response(JSON.stringify({ data: [z <= 19 ? 1 : 0], valid: true }));
    }) as unknown as typeof fetch;
    expect(await zoomNativoEsri(-23.55, -46.63, fetchImpl)).toBe(19);
    const semRede = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await zoomNativoEsri(-5.47, -47.53, semRede)).toBe(17);
  });
});

describe("camadas de 11/11 (2ª etapa): CAR, mananciais, ferrovias, dutos e larguras confirmadas", () => {
  const g = cenario("joao-lisboa-ferrovia-norte-sul");
  const terreno = quadrado(g.terreno);
  const novas = ["car", "mananciais", "ferrovias", "dutos"] as const;

  it("terreno cortado pela Ferrovia Norte-Sul: CAR e ferrovia respondem; sem manancial nem duto por perto", async () => {
    const { fetchImpl } = reprodutor(g);
    const { camadas } = await buscarCamadasTerreno(terreno, [...novas], { fetchImpl });
    expect(camadas.car?.estado).toBe("ok");
    expect(camadas.car?.dados?.imoveis.length).toBeGreaterThanOrEqual(2);
    expect(camadas.car?.dados?.imoveis[0].codigo).toMatch(/^MA-\d{7}-[0-9A-F]{32}$/);
    expect(camadas.car?.dados?.percentualCoberto).toBeGreaterThan(50);
    expect(camadas.car?.dados?.percentualCoberto).toBeLessThanOrEqual(100);
    expect(camadas.ferrovias?.estado).toBe("ok");
    expect(camadas.ferrovias?.dados?.ferrovias[0].properties).toMatchObject({ concessionaria: "FNS", origem: "DNIT" });
    expect(camadas.mananciais?.estado).toBe("vazio");
    expect(camadas.dutos?.estado).toBe("vazio");
  });

  it("faixa da ferrovia: 15 m de domínio (referência) + 15 m não edificáveis (Lei 6.766, art. 4º, III-A) de cada lado; largura confirmada substitui", async () => {
    const { fetchImpl } = reprodutor(g);
    const { camadas } = await buscarCamadasTerreno(terreno, ["ferrovias"], { fetchImpl });
    const ferrovias = camadas.ferrovias!.dados!.ferrovias;
    const ref = calcularServidao(terreno, [], [], { ferrovias });
    expect(ref.itens).toHaveLength(1);
    expect(ref.itens[0]).toMatchObject({ tipo: "ferrovia", larguraTotalM: 60, base: "legal+referencia" });
    expect(ref.itens[0].composicao).toContain("III-A");
    expect(ref.percentual).toBeGreaterThan(5);
    const conf = calcularServidao(terreno, [], [], { ferrovias, larguras: { [ref.itens[0].chave]: 120 } });
    expect(conf.itens[0]).toMatchObject({ larguraTotalM: 120, base: "confirmada" });
    expect(conf.areaM2).toBeGreaterThan(ref.areaM2 * 1.7);
  });

  it("CAR informado no estudo é conferido com os imóveis encontrados (ignora pontuação e caixa)", async () => {
    const { fetchImpl } = reprodutor(g);
    const { camadas } = await buscarCamadasTerreno(terreno, ["car"], { fetchImpl });
    const imoveis = camadas.car!.dados!.imoveis;
    expect(carConfere(imoveis[0].codigo.toLowerCase().replace(/-/g, "."), imoveis)).toBe(true);
    expect(carConfere("MA-2105302-00000000000000000000000000000000", imoveis)).toBe(false);
    expect(carConfere("", imoveis)).toBeNull();
    expect(carConfere(null, imoveis)).toBeNull();
  });

  it("CAR fora do ar vira 'indisponível' sem derrubar a ferrovia", async () => {
    const r = reprodutor(g);
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (String(url).includes("CAR_NACIONAL")) throw new TypeError("fetch failed");
      return r.fetchImpl(url, init);
    }) as unknown as typeof fetch;
    const { camadas } = await buscarCamadasTerreno(terreno, ["car", "ferrovias"], { fetchImpl });
    expect(camadas.car?.estado).toBe("indisponivel");
    expect(camadas.ferrovias?.estado).toBe("ok");
  });

  it("anéis Esri: horário é contorno, anti-horário é furo do contorno anterior", () => {
    const externo = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
    const furo = [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]];
    const outro = [[20, 0], [20, 5], [25, 5], [25, 0], [20, 0]];
    const partes = poligonosEsri([externo, furo, outro]);
    expect(partes).toHaveLength(2);
    expect(partes[0]).toHaveLength(2);
    expect(partes[1]).toHaveLength(1);
  });

  it("captações da ANA (multiponto): só as do raio, da mais próxima para a mais distante, sem repetir", () => {
    const t = quadrado({ lat: -5.5, lng: -47.5, meiaLadoM: 300 });
    const feicao = (coords: number[][], tp: string, nome: string) => ({ type: "Feature" as const, properties: { nm_captaca: nome, nm_fantasi: "Rio Tocantins", tp_captaca: tp, nm_municip: "Imperatriz (MA)" }, geometry: { type: "MultiPoint" as const, coordinates: coords } });
    const perto = [-47.5, -5.52], dentro = [-47.5, -5.5], longe = [-47.5, -5.7];
    const fcs = [{ type: "FeatureCollection" as const, features: [feicao([perto, perto, longe], "Superficial", "Captação A")] }, { type: "FeatureCollection" as const, features: [feicao([dentro], "Subterrânea", "Poço B")] }];
    const r = normalizarCaptacoes(fcs, t, 5000);
    expect(r.map(c => c.nome)).toEqual(["Poço B", "Captação A"]);
    expect(r[0]).toMatchObject({ tipo: "subterranea", distanciaM: 0 });
    expect(r[1].tipo).toBe("superficial");
    expect(r[1].distanciaM).toBeGreaterThan(1500);
    expect(r[1].distanciaM).toBeLessThan(2500);
  });

  it("gasodutos da EPE: traçado só 'indicativo' fica de fora; duto existente gera faixa de referência de 20 m", () => {
    const t = quadrado({ lat: -22.72, lng: -47.133, meiaLadoM: 300 });
    const linha = (categoria: string, nome: string) => ({ type: "Feature" as const, properties: { Nome_Dut_1: nome, Categoria: categoria, Transporta: "TBG" }, geometry: { type: "LineString" as const, coordinates: [[-47.14, -22.72], [-47.126, -22.72]] } });
    const dutos = normalizarDutosEpe({ type: "FeatureCollection", features: [linha("Existente", "GASBOL"), linha("Indicativo", "Estudo EPE")] }, "gasoduto de transporte");
    expect(dutos.map(d => d.properties.nome)).toEqual(["GASBOL"]);
    const s = calcularServidao(t, [], [], { dutos });
    expect(s.itens[0]).toMatchObject({ tipo: "duto", larguraTotalM: 20, base: "referencia" });
    expect(s.itens[0].composicao).toContain("§ 3º");
    // faixa de 20 m atravessando ~600 m de terreno ≈ 12.000 m²
    expect(s.areaM2).toBeGreaterThan(11_000);
    expect(s.areaM2).toBeLessThan(13_000);
  });

  it("rodovia federal: 35 m de domínio (referência) + 15 m não edificáveis (lei) de cada lado = 100 m; chave estável para confirmar", () => {
    const t = quadrado({ lat: -5.5, lng: -47.5, meiaLadoM: 300 });
    const rodovia = { type: "Feature" as const, properties: { nome: "BR-010", jurisdicao: null, situacao: null }, geometry: { type: "LineString" as const, coordinates: [[-47.51, -5.5], [-47.49, -5.5]] } };
    const s = calcularServidao(t, [], [rodovia]);
    expect(s.itens[0]).toMatchObject({ chave: "rod:BR-010", larguraTotalM: 100, base: "legal+referencia" });
    expect(calcularServidao(t, [], [rodovia], { larguras: { "rod:BR-010": 70 } }).itens[0]).toMatchObject({ larguraTotalM: 70, base: "confirmada" });
  });

  it("larguras confirmadas: só valores plausíveis (0 < m ≤ 1000) são aceitos", () => {
    expect(limparLargurasConfirmadas({ "rod:BR-010": 80, a: "45,5", b: 0, c: -3, d: 5000, e: "x", f: null })).toEqual({ "rod:BR-010": 80, a: 45.5 });
    expect(limparLargurasConfirmadas(null)).toEqual({});
    expect(limparLargurasConfirmadas("nada")).toEqual({});
  });
});
