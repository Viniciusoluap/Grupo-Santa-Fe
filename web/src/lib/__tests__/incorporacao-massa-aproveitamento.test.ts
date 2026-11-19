// Estudo de Massa — regra do dono (16/11/2026): APP, faixas de servidão e demais áreas que não podem virar lote
// são aproveitadas, sempre que permitido, nas áreas que o loteamento tem de destinar (verde e institucional).
import { describe, expect, it, vi } from "vitest";
import { gerarEstudoMassa, type ParametrosMassa } from "@/lib/geo/massa-parcelamento";
import { DESTINOS_PADRAO, RESTRICOES_VAZIAS, aproveitarRestricoes, calcularQuadroAreasMassa, linhasQuadroAreas } from "@/lib/incorporacao/massa-quadro-areas";

// Paridade 17/11: o motor de massa 3.0.0 (malha conectada, recorte na divisa) é mais pesado; com 3 workers em
// paralelo os cenários grandes passam de 5 s. Prazo maior só neste arquivo (nenhum teste foi pulado ou afrouxado).
vi.setConfig({ testTimeout: 60_000 });

const r = (parte: Partial<typeof RESTRICOES_VAZIAS>) => ({ ...RESTRICOES_VAZIAS, ...parte });

describe("aproveitamento das áreas restritas nas doações (conta)", () => {
  it("padrão: APP, vegetação e faixas contam como área verde; 'outras' não contam; nenhuma é institucional", () => {
    expect(DESTINOS_PADRAO).toEqual({ appM2: "verde", supressaoVegetalM2: "verde", faixaTransmissaoM2: "verde", faixaServidaoM2: "verde", outrasNaoParcelaveisM2: "nenhum" });
  });

  it("APP menor que a área verde exigida: só o que falta sai da área loteável", () => {
    // Gleba de 100.000 m², APP de 4.000 m² → parcelável 96.000; verde 10% = 9.600; institucional 5% = 4.800.
    const a = aproveitarRestricoes(r({ appM2: 4000 }), undefined, 100_000, 0.1, 0.05);
    expect(a).toMatchObject({ comoVerdeM2: 4000, comoInstitucionalM2: 0, semAproveitamentoM2: 0, exigidoVerdeM2: 9600, exigidoInstitucionalM2: 4800,
      verdeEmAreaLoteavelM2: 5600, institucionalEmAreaLoteavelM2: 4800, alvoVerdeM2: 9600, alvoInstitucionalM2: 4800, economiaM2: 4000 });
  });

  it("APP e faixas maiores que a área verde exigida: nada de verde sai da área loteável, e a área verde é a restrita inteira", () => {
    const a = aproveitarRestricoes(r({ appM2: 9000, faixaServidaoM2: 3000 }), undefined, 100_000, 0.1, 0.05);
    expect(a).toMatchObject({ comoVerdeM2: 12000, exigidoVerdeM2: 8800, verdeEmAreaLoteavelM2: 0, alvoVerdeM2: 12000, economiaM2: 8800 });
  });

  it("destino escolhido por restrição: institucional, verde ou nenhum; 'nenhum' não gera economia", () => {
    const a = aproveitarRestricoes(r({ appM2: 4000, faixaTransmissaoM2: 2000, outrasNaoParcelaveisM2: 1000 }),
      { faixaTransmissaoM2: "institucional" }, 100_000, 0.1, 0.05);
    expect(a).toMatchObject({ comoVerdeM2: 4000, comoInstitucionalM2: 2000, semAproveitamentoM2: 1000 });
    expect(a.exigidoInstitucionalM2).toBeCloseTo(0.05 * 93_000, 2);
    expect(a.institucionalEmAreaLoteavelM2).toBeCloseTo(0.05 * 93_000 - 2000, 2);
    expect(a.economiaM2).toBe(6000);
    const sem = aproveitarRestricoes(r({ appM2: 4000 }), { appM2: "nenhum" }, 100_000, 0.1, 0.05);
    expect(sem).toMatchObject({ comoVerdeM2: 0, semAproveitamentoM2: 4000, verdeEmAreaLoteavelM2: 9600, economiaM2: 0 });
  });

  it("sem restrições, nada muda: o exigido sai inteiro da área loteável", () => {
    expect(aproveitarRestricoes(RESTRICOES_VAZIAS, undefined, 50_000, 0.1, 0.05)).toMatchObject({ comoVerdeM2: 0, verdeEmAreaLoteavelM2: 5000, institucionalEmAreaLoteavelM2: 2500, economiaM2: 0 });
  });

  it("restrições maiores que a gleba são reduzidas na proporção (não passam da área bruta)", () => {
    const a = aproveitarRestricoes(r({ appM2: 80_000, outrasNaoParcelaveisM2: 40_000 }), undefined, 60_000, 0.1, 0.05);
    expect(a.comoVerdeM2 + a.semAproveitamentoM2).toBeCloseTo(60_000, 1);
    expect(a.exigidoVerdeM2).toBe(0);
  });

  it("quadro de áreas fecha: a área verde em APP não é contada duas vezes", () => {
    const restricoes = r({ appM2: 4000 }), aproveitamento = aproveitarRestricoes(restricoes, undefined, 100_000, 0.1, 0.05);
    // Cenário: 60.000 vendável, verde 9.600 (4.000 em APP + 5.600 em terra loteável), institucional 4.800, viário 25.600.
    const q = calcularQuadroAreasMassa({ areaBrutaM2: 100_000, restricoes, aproveitamento, areaVendavelM2: 60_000, nLotesVendaveis: 200, areaInstitucionalM2: 4800, areaVerdeM2: 9600, precoM2Lote: 100, sistemaViarioM2: 25_600 });
    expect(q).toMatchObject({ areaParcelavelM2: 96_000, areaVerdeM2: 9600, areaVerdeEmRestricaoM2: 4000, sistemaViarioM2: 25_600, sobrasM2: 0, areaVerdeExigidaM2: 9600, economiaPorAproveitamentoM2: 4000 });
    expect(q.avisos).toEqual([]);
    // vendável + viário + (verde fora da APP) + institucional + não parcelável = área bruta
    expect(q.areaLiquidaVendavelM2 + q.sistemaViarioM2 + (q.areaVerdeM2 - q.areaVerdeEmRestricaoM2!) + q.areaInstitucionalM2 + q.totalNaoParcelavelM2).toBeCloseTo(100_000, 1);
    expect(linhasQuadroAreas(q).map(l => l.rotulo)).toContain("  da qual em APP/faixas (aproveitada)");
    // Sem informar o aproveitamento, o quadro continua como era (compatibilidade com estudos salvos).
    const antigo = calcularQuadroAreasMassa({ areaBrutaM2: 100_000, restricoes, areaVendavelM2: 60_000, nLotesVendaveis: 200, areaInstitucionalM2: 4800, areaVerdeM2: 9600, precoM2Lote: 100 });
    expect(antigo.areaVerdeEmRestricaoM2).toBeUndefined();
  });
});

describe("aproveitamento das áreas restritas — dentro do motor de desenho", () => {
  // Gleba de ~300 × 220 m (≈ 62.000 m²).
  const centro: [number, number] = [-47.48, -5.52];
  const m = 1 / 111320, cosLat = Math.cos((centro[1] * Math.PI) / 180);
  const anel = [[0, 0], [300, 20], [320, 200], [150, 240], [-10, 210], [0, 0]].map(([x, y]) => [centro[0] + (x * m) / cosLat, centro[1] + y * m]);
  const base: ParametrosMassa = { larguraViaM: 12, testadaLoteM: 10, profundidadeLoteM: 25, loteMinimoM2: 200, comprimentoMaxQuadraM: 150, percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500, tipologia: "grid" };
  const gerar = (p: Partial<ParametrosMassa>) => gerarEstudoMassa(anel, centro, { ...base, ...p }, { nCenarios: 1 }).cenarios[0];
  const areas = (c: ReturnType<typeof gerar>) => ({
    verde: c.lotes.filter(l => l.tipo === "area_publica" && l.uso !== "institucional").reduce((s, l) => s + l.areaM2, 0),
    institucional: c.lotes.filter(l => l.uso === "institucional").reduce((s, l) => s + l.areaM2, 0),
    naoParcelavel: c.lotes.filter(l => l.tipo === "nao_parcelavel").reduce((s, l) => s + l.areaM2, 0),
    vendavel: c.kpis.areaVendavelM2,
  });

  it("APP aproveitada como área verde rende mais área vendável do que APP reservada por fora", () => {
    const aproveitada = gerar({ appM2: 5000 }), porFora = gerar({ appM2: 5000, destinoApp: "nenhum" });
    const a = areas(aproveitada), b = areas(porFora);
    // Por fora: a APP é desenhada como não parcelável E ainda se doa a área verde inteira.
    expect(b.naoParcelavel).toBeGreaterThan(4500);
    expect(a.naoParcelavel).toBeLessThan(1);
    // Aproveitada: a área verde desenhada já contém a APP e cumpre o mínimo exigido.
    const exigido = aproveitada.quadroAreas!.areaVerdeExigidaM2!;
    expect(a.verde).toBeGreaterThanOrEqual(exigido - 1);
    expect(aproveitada.quadroAreas!.areaVerdeEmRestricaoM2).toBeCloseTo(5000, 0);
    expect(aproveitada.quadroAreas!.economiaPorAproveitamentoM2).toBeGreaterThan(4500);
    expect(a.vendavel).toBeGreaterThan(b.vendavel);
    // A explicação aparece no cenário, com o alerta de conferir a legislação municipal.
    const notas = (aproveitada.limitacoes ?? []).join(" ");
    expect(notas).toContain("aproveitadas nas doações");
    expect(notas).toContain("legislação municipal");
    expect((porFora.limitacoes ?? []).join(" ")).not.toContain("aproveitadas nas doações");
  }, 120_000);

  it("faixa de servidão como área institucional, quando o dono marcar assim", () => {
    const c = gerar({ faixaServidaoM2: 2500, destinoFaixaServidao: "institucional" });
    expect(c.quadroAreas!.areaInstitucionalEmRestricaoM2).toBeCloseTo(2500, 0);
    expect(areas(c).institucional).toBeGreaterThanOrEqual(c.quadroAreas!.areaInstitucionalExigidaM2! - 1);
    expect(areas(c).naoParcelavel).toBeLessThan(1);
  }, 120_000);

  it("o fecho de áreas continua valendo com o aproveitamento (nada sobra, nada é contado duas vezes)", () => {
    for (const p of [{ appM2: 5000 }, { appM2: 9000, faixaTransmissaoM2: 3000 }, { appM2: 3000, outrasNaoParcelaveisM2: 2000 }]) {
      const c = gerar(p), q = c.quadroAreas!;
      const soma = c.lotes.reduce((s, l) => s + l.areaM2, 0) + q.sistemaViarioM2;
      expect(Math.abs(soma - q.areaBrutaM2), JSON.stringify(p)).toBeLessThan(Math.max(1, q.areaBrutaM2 * 0.005));
      expect(q.avisos, JSON.stringify(p)).toEqual([]);
    }
  }, 180_000);

  it("mudar o destino muda a assinatura das entradas (o cenário salvo deixa de valer)", () => {
    const a = gerarEstudoMassa(anel, centro, { ...base, appM2: 5000 }, { nCenarios: 1 }).assinatura;
    const b = gerarEstudoMassa(anel, centro, { ...base, appM2: 5000, destinoApp: "nenhum" }, { nCenarios: 1 }).assinatura;
    expect(a).not.toBe(b);
  }, 120_000);
});
