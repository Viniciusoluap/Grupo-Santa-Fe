import { describe, it, expect } from "vitest";
import intersect from "@turf/intersect";
import { featureCollection, polygon as turfPolygon } from "@turf/helpers";
import type { Position } from "geojson";
import {
  gerarCenariosMassa, criarProjecao, areaPlanar, validarParametrosMassa, motivoInviabilidade,
  ROTULO_ESTUDO_PRELIMINAR, type ParametrosMassa, type CenarioMassa,
} from "@/lib/geo/massa";
import { calcularQuadroAreasMassa, linhasQuadroAreas, RESTRICOES_VAZIAS } from "@/lib/incorporacao/massa-quadro-areas";
import {
  parseLotesAvulsos, validarListaLotesAvulsos, resumoLotesAvulsos, serializarLotesAvulsos, terrenoLiberado, type LoteAvulso,
} from "@/lib/incorporacao/lotes-avulsos";
import {
  cenarioPrincipalDe, motivoBloqueioExclusao, proximaVersao, mixDoCenario, indicadoresDoCenario, validarNomeEstudo,
} from "@/lib/incorporacao/estudos-massa";

const CENTRO: [number, number] = [-49.879, -6.5];
const proj = criarProjecao(CENTRO);
const geo = (anel: Position[]) => anel.map((p) => proj.paraGeo(p));
// Gleba retangular 400 x 250 m (10 ha) e uma gleba irregular (trapézio com recorte).
const RETANGULO = geo([[-200, -125], [200, -125], [200, 125], [-200, 125], [-200, -125]]);
const IRREGULAR = geo([[-220, -140], [180, -160], [240, 60], [60, 150], [-40, 90], [-200, 130], [-220, -140]]);

const PARAMS: ParametrosMassa = {
  larguraViaM: 12, testadaLoteM: 10, profundidadeLoteM: 25, loteMinimoM2: 250,
  comprimentoMaxQuadraM: 120, percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500,
};
const OPTS = { populacao: 8, geracoes: 4, seed: 7, nCenarios: 2 };

/** Nenhum lote nem balão ultrapassa a poligonal (área dentro ≈ área total). */
function dentroDaPoligonal(anelGleba: Position[], c: CenarioMassa) {
  const gleba = turfPolygon([anelGleba.map((p) => proj.paraMetros(p))]);
  const pecas = [...c.lotes.map((l) => l.anel), ...(c.vias ?? [])];
  for (const anel of pecas) {
    const m = anel.map((p) => proj.paraMetros(p));
    const area = areaPlanar(m);
    const inter = intersect(featureCollection([turfPolygon([m]), gleba]));
    const dentro = inter && inter.geometry.type === "Polygon" ? areaPlanar(inter.geometry.coordinates[0]) : 0;
    expect(dentro).toBeGreaterThanOrEqual(area * 0.999 - 0.01);
  }
}

describe("calcularQuadroAreasMassa", () => {
  it("fecha a conta sem subtração dupla: bruta = não parceláveis + vendável + verde + institucional + viário", () => {
    const q = calcularQuadroAreasMassa({
      areaBrutaM2: 100_000,
      restricoes: { appM2: 8_000, supressaoVegetalM2: 2_000, faixaTransmissaoM2: 1_500, faixaServidaoM2: 500, outrasNaoParcelaveisM2: 1_000 },
      areaVendavelM2: 50_000, nLotesVendaveis: 160, areaInstitucionalM2: 4_350, areaVerdeM2: 8_700, precoM2Lote: 300,
    });
    expect(q.totalNaoParcelavelM2).toBe(13_000);
    expect(q.areaParcelavelM2).toBe(87_000);
    expect(q.sistemaViarioM2).toBe(87_000 - 50_000 - 4_350 - 8_700);
    expect(q.areaPublicaTotalM2).toBe(q.sistemaViarioM2 + 4_350 + 8_700);
    expect(q.totalNaoParcelavelM2 + q.areaLiquidaVendavelM2 + q.areaPublicaTotalM2).toBe(q.areaBrutaM2);
    expect(q.areaMediaLoteM2).toBe(312.5);
    expect(q.aproveitamento).toBeCloseTo(0.5);
    expect(q.aproveitamentoParcelavel).toBeCloseTo(50_000 / 87_000);
    expect(q.vgv).toBe(15_000_000);
    expect(q.avisos).toEqual([]);
  });

  it("limita restrições à área bruta e avisa sobreposição", () => {
    const q = calcularQuadroAreasMassa({
      areaBrutaM2: 10_000, restricoes: { ...RESTRICOES_VAZIAS, appM2: 8_000, faixaServidaoM2: 5_000 },
      areaVendavelM2: 0, nLotesVendaveis: 0, areaInstitucionalM2: 0, areaVerdeM2: 0, precoM2Lote: 100,
    });
    expect(q.totalNaoParcelavelM2).toBe(10_000);
    expect(q.areaParcelavelM2).toBe(0);
    expect(q.avisos[0]).toMatch(/sobreposição/);
  });

  it("ignora negativos/NaN e não deixa viário negativo", () => {
    const q = calcularQuadroAreasMassa({
      areaBrutaM2: 1_000, restricoes: { ...RESTRICOES_VAZIAS, appM2: -50, outrasNaoParcelaveisM2: Number.NaN },
      areaVendavelM2: 1_200, nLotesVendaveis: 3, areaInstitucionalM2: 0, areaVerdeM2: 0, precoM2Lote: 10,
    });
    expect(q.totalNaoParcelavelM2).toBe(0);
    expect(q.sistemaViarioM2).toBe(0);
    expect(q.avisos.length).toBe(1);
  });

  it("linhas do quadro trazem todas as parcelas pedidas", () => {
    const q = calcularQuadroAreasMassa({ areaBrutaM2: 1, restricoes: RESTRICOES_VAZIAS, areaVendavelM2: 0, nLotesVendaveis: 0, areaInstitucionalM2: 0, areaVerdeM2: 0, precoM2Lote: 0 });
    const rotulos = linhasQuadroAreas(q).map((l) => l.rotulo).join("|");
    for (const r of ["bruta", "APP", "Supressão", "transmissão", "servidão", "Outras", "parcelável", "viário", "verde", "institucional", "pública total", "vendável"]) {
      expect(rotulos).toContain(r);
    }
  });
});

describe("gerarCenariosMassa — quadro, tipologias e poligonal", () => {
  it("grid: lotes dentro da poligonal (retângulo e gleba irregular) e quadro coerente", () => {
    for (const anel of [RETANGULO, IRREGULAR]) {
      const [c] = gerarCenariosMassa(anel, CENTRO, PARAMS, OPTS);
      dentroDaPoligonal(anel, c);
      const q = c.quadroAreas!;
      expect(q.areaLiquidaVendavelM2).toBe(c.kpis.areaVendavelM2);
      expect(q.nLotes).toBe(c.kpis.lotesVendaveis);
      expect(Math.abs(q.totalNaoParcelavelM2 + q.areaLiquidaVendavelM2 + q.areaPublicaTotalM2 - q.areaBrutaM2)).toBeLessThan(1);
      expect(c.inviabilidade).toBeNull();
    }
  });

  it("numera os lotes vendáveis por quadra sem repetir", () => {
    const [c] = gerarCenariosMassa(RETANGULO, CENTRO, PARAMS, OPTS);
    const vend = c.lotes.filter((l) => l.tipo === "vendavel");
    const chaves = new Set(vend.map((l) => `${l.quadra}-${l.numero}`));
    expect(chaves.size).toBe(vend.length);
    expect(vend.every((l) => l.quadra && l.numero)).toBe(true);
    expect(c.lotes.filter((l) => l.tipo !== "vendavel").every((l) => !l.quadra)).toBe(true);
  });

  it("doações separadas em institucional e verde, sobre a área parcelável", () => {
    const [c] = gerarCenariosMassa(RETANGULO, CENTRO, PARAMS, OPTS);
    const q = c.quadroAreas!;
    expect(q.areaInstitucionalM2).toBeGreaterThanOrEqual(0.05 * q.areaParcelavelM2);
    expect(q.areaVerdeM2).toBeGreaterThanOrEqual(0.1 * q.areaParcelavelM2);
  });

  it("restrições informadas reduzem a área parcelável e os lotes vendáveis", () => {
    const [semRestricao] = gerarCenariosMassa(RETANGULO, CENTRO, PARAMS, OPTS);
    const [comRestricao] = gerarCenariosMassa(RETANGULO, CENTRO, { ...PARAMS, appM2: 20_000, faixaServidaoM2: 5_000 }, OPTS);
    const q = comRestricao.quadroAreas!;
    expect(q.appM2).toBe(20_000);
    expect(q.faixaServidaoM2).toBe(5_000);
    expect(q.areaParcelavelM2).toBeCloseTo(q.areaBrutaM2 - 25_000, 0);
    expect(comRestricao.kpis.lotesVendaveis).toBeLessThan(semRestricao.kpis.lotesVendaveis);
    expect(comRestricao.lotes.some((l) => l.tipo === "nao_parcelavel")).toBe(true);
  });

  it("cul-de-sac: desenha balões de retorno, tudo dentro da poligonal", () => {
    for (const anel of [RETANGULO, IRREGULAR]) {
      const [c] = gerarCenariosMassa(anel, CENTRO, { ...PARAMS, tipologia: "cul_de_sac" }, OPTS);
      expect(c.tipologia).toBe("cul_de_sac");
      expect((c.vias ?? []).length).toBeGreaterThan(0);
      expect(c.kpis.lotesVendaveis).toBeGreaterThan(0);
      expect((c.limitacoes ?? []).join(" ")).toMatch(/simplificado/);
      dentroDaPoligonal(anel, c);
    }
  });

  it("informa o motivo quando o cenário é inviável", () => {
    const pequena = geo([[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]);
    const [c] = gerarCenariosMassa(pequena, CENTRO, PARAMS, { ...OPTS, nCenarios: 1 });
    expect(c.kpis.lotesVendaveis).toBe(0);
    expect(c.inviabilidade).toMatch(/nenhum lote/);
    expect(motivoInviabilidade(0, 5, { areaParcelavelM2: 0 }, { testada: 10, profundidade: 25, via: 12 }, PARAMS)).toMatch(/não parceláveis/);
    expect(motivoInviabilidade(0, 5, { areaParcelavelM2: 10 }, { testada: 10, profundidade: 25, via: 12 }, PARAMS)).toMatch(/doações/);
  });

  it("valida tipologia e restrições", () => {
    expect(validarParametrosMassa({ ...PARAMS, tipologia: "cul_de_sac", appM2: 0 })).toBeNull();
    expect(validarParametrosMassa({ ...PARAMS, appM2: -1 })).toMatch(/APP/);
    expect(validarParametrosMassa({ ...PARAMS, tipologia: "radial" as never })).toMatch(/Tipologia/);
    expect(ROTULO_ESTUDO_PRELIMINAR).toBe("Estudo preliminar — não substitui projeto urbanístico");
  });
});

describe("lotes avulsos (sem KML)", () => {
  const lotes: LoteAvulso[] = [
    { id: "a", quadra: "B", lote: "2", areaM2: 300, testadaM: 12, profundidadeM: 25 },
    { id: "b", quadra: "A", lote: "10", areaM2: 250, testadaM: null, profundidadeM: null },
    { id: "c", quadra: "A", lote: "2", areaM2: 260, testadaM: 10, profundidadeM: 26 },
  ];
  it("serializa, lê e ordena por quadra/lote (numérico)", () => {
    const lidos = parseLotesAvulsos(serializarLotesAvulsos(lotes));
    expect(lidos.map((l) => `${l.quadra}${l.lote}`)).toEqual(["A2", "A10", "B2"]);
    expect(lidos[1].testadaM).toBeNull();
  });
  it("valida duplicidade e campos obrigatórios", () => {
    expect(validarListaLotesAvulsos(lotes)).toBeNull();
    expect(validarListaLotesAvulsos([...lotes, { ...lotes[0], id: "d", quadra: " b " }])).toMatch(/repetido/);
    expect(validarListaLotesAvulsos([{ ...lotes[0], areaM2: 0 }])).toMatch(/área/);
    expect(validarListaLotesAvulsos([{ ...lotes[0], quadra: "" }])).toMatch(/quadra/);
  });
  it("resumo e JSON inválido", () => {
    expect(resumoLotesAvulsos(lotes)).toEqual({ total: 3, quadras: 2, areaTotalM2: 810, areaMediaM2: 270 });
    expect(parseLotesAvulsos("{quebrado")).toEqual([]);
  });
  it("libera módulos com KML ou com a marcação sem KML", () => {
    expect(terrenoLiberado({ geojson: null, semKml: false })).toBe(false);
    expect(terrenoLiberado({ geojson: null, semKml: true })).toBe(true);
    expect(terrenoLiberado({ geojson: "{}", semKml: false })).toBe(true);
  });
});

describe("estudos de massa salvos", () => {
  const cenarios = gerarCenariosMassa(RETANGULO, CENTRO, PARAMS, OPTS);
  it("versões e nome", () => {
    expect(proximaVersao([{ nome: "Base", versao: 1 }, { nome: "base ", versao: 3 }, { nome: "Outro", versao: 9 }], "BASE")).toBe(4);
    expect(proximaVersao([], "Novo")).toBe(1);
    expect(validarNomeEstudo("  ")).toMatch(/nome/);
  });
  it("bloqueia excluir o principal só com dependentes", () => {
    expect(motivoBloqueioExclusao(false, { unidades: 5, orcamento: true, viabilidade: true })).toBeNull();
    expect(motivoBloqueioExclusao(true, { unidades: 0, orcamento: false, viabilidade: false })).toBeNull();
    expect(motivoBloqueioExclusao(true, { unidades: 2, orcamento: false, viabilidade: true })).toMatch(/2 unidade\(s\).*viabilidade/);
  });
  it("mix e indicadores do cenário", () => {
    const c = cenarios[0];
    expect(mixDoCenario(c, 500)[0].quantidade).toBe(c.kpis.lotesVendaveis);
    expect(indicadoresDoCenario(c)?.vgv).toBe(c.kpis.vgv);
  });
  it("cenário principal: estudo salvo > colunas legadas > lotes avulsos", () => {
    const json = JSON.stringify({ params: PARAMS, cenarios });
    const base = { massaCenariosJson: null, cenarioEscolhidoId: null, semKml: false, lotesAvulsosJson: null, areaBrutaM2: 100_000 };
    const salvo = cenarioPrincipalDe({ ...base, principal: { id: "9", nome: "Base", versao: 2, parametrosJson: JSON.stringify(PARAMS), cenariosJson: JSON.stringify(cenarios), cenarioEscolhidoId: cenarios[1].id } });
    expect(salvo?.origem).toBe("estudo_salvo");
    expect(salvo?.cenarioId).toBe(cenarios[1].id);
    expect(salvo?.lotes.length).toBe(cenarios[1].kpis.lotesVendaveis);
    expect(salvo?.quadroAreas?.nLotes).toBe(cenarios[1].kpis.lotesVendaveis);

    const legado = cenarioPrincipalDe({ ...base, massaCenariosJson: json, cenarioEscolhidoId: "inexistente" });
    expect(legado?.origem).toBe("legado");
    expect(legado?.cenarioId).toBe(cenarios[0].id);
    expect(legado?.precoM2Lote).toBe(500);

    const avulsos = cenarioPrincipalDe({ ...base, areaBrutaM2: 0, semKml: true, lotesAvulsosJson: serializarLotesAvulsos([{ id: "1", quadra: "A", lote: "1", areaM2: 300, testadaM: null, profundidadeM: null }]) });
    expect(avulsos?.origem).toBe("lotes_avulsos");
    expect(avulsos?.lotes[0]).toMatchObject({ quadra: "A", lote: "1", areaM2: 300 });
    expect(cenarioPrincipalDe(base)).toBeNull();
  });
  it("cenário legado sem quadro/numeração é reconstruído sem inventar", () => {
    const antigo = { ...cenarios[0], quadroAreas: undefined, lotes: cenarios[0].lotes.map(({ quadra: _q, numero: _n, uso: _u, ...l }) => l) };
    const r = cenarioPrincipalDe({ massaCenariosJson: JSON.stringify({ params: PARAMS, cenarios: [antigo] }), cenarioEscolhidoId: null, semKml: false, lotesAvulsosJson: null, areaBrutaM2: 100_000 });
    expect(r?.lotes[0].quadra).toBe("1");
    expect(r?.quadroAreas?.areaLiquidaVendavelM2).toBe(antigo.kpis.areaVendavelM2);
    expect((r?.quadroAreas?.areaVerdeM2 ?? 0) + (r?.quadroAreas?.areaInstitucionalM2 ?? 0)).toBeCloseTo(antigo.kpis.areaPublicaM2, 0);
  });
});

describe("prepararLotesAvulsosParaGravar", () => {
  it("aceita lista válida e recusa inválida sem descartar em silêncio", async () => {
    const { prepararLotesAvulsosParaGravar } = await import("@/lib/incorporacao/lotes-avulsos");
    const ok = prepararLotesAvulsosParaGravar(JSON.stringify([{ quadra: "A", lote: "1", areaM2: "300", testadaM: "", profundidadeM: 25 }]));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.lista[0]).toMatchObject({ areaM2: 300, testadaM: null, profundidadeM: 25 });
    const ruim = prepararLotesAvulsosParaGravar(JSON.stringify([{ quadra: "A", lote: "1", areaM2: -3 }]));
    expect(ruim.ok).toBe(false);
    expect(prepararLotesAvulsosParaGravar("x").ok).toBe(false);
    const testadaNegativa = prepararLotesAvulsosParaGravar(JSON.stringify([{ quadra: "A", lote: "1", areaM2: 10, testadaM: -1 }]));
    expect(testadaNegativa.ok).toBe(false);
  });
});
