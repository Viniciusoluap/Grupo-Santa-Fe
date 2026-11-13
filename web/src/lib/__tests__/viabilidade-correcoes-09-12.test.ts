// Paridade Prospecta (13/11): cenários de server/incorporacao-correcoes-09-12.test.ts (dados reais do estudo 2).
import { describe, expect, it } from "vitest";
import { montarViabilidadeDoEstudo, urbanismoDoCenario } from "@/lib/incorporacao/premissas-loteamento";
import { calcularLoteamento, calcularCenarios, paybackDetalhado, trocasDeSinal, type PremissasLoteamento } from "@/lib/finance/loteamento";
import { calcularMix } from "@/lib/finance/loteamento";
import { composicaoFinanceira, grupoDaLinha, programarPagamento, terrenoDaNegociacao } from "@/lib/incorporacao/composicao-custos";
import { anoDoMes, custosPorAno, fluxoPorAno, recebimentosPorAno, vendasPorAno } from "@/lib/incorporacao/fluxo-anual";
import { LOTEAMENTO_E2, NEGOCIACAO_E2, estudoE2 } from "./fixtures/estudo-2-daniel-mota";

const estudo2 = (extra: Record<string, unknown> = {}) => estudoE2(extra);
const viab2 = (extra: Record<string, unknown> = {}) => {
  const v = montarViabilidadeDoEstudo(estudo2(extra))!;
  return { ...v, r: calcularLoteamento(v.premissas) };
};
const comForm = (form: Record<string, unknown>) => ({ loteamentoJson: JSON.stringify({ ...LOTEAMENTO_E2, ...form }) });

const base: PremissasLoteamento = {
  areaBrutaM2: 3450.88, pctAreaPublica: 0, pctAreaVerde: 0, pctSistemaViario: 0, pctAPP: 0, pctFaixaServidao: 0,
  itensMix: [{ nome: "Lotes", quantidade: 12, areaUnidadeM2: 287.57, precoM2: 700 }],
  duracaoVendasMeses: 12, perfilVendas: "constante", entradaPct: 0.2, prazoParcelamentoMeses: 0, jurosClienteMensal: 0, indexacaoMensal: 0,
  vendasAVistaPct: 0, descontoAVistaPct: 0, inadimplenciaPct: 0, comissaoPctVgv: 0.04, despesasGeraisPctVgv: 0, impostosPctVgv: 0,
  taxaIncorporacaoPctVgv: 0, inicioObraMes: 1, duracaoObraMeses: 12, inicioVendasMes: 1, custoInfraM2Lote: 50, projetosLicencas: 0,
  marketing: 0, registroPorUnidade: 0, contingenciaPctInfra: 0, bdiPct: 0, taxaAdministracaoObraPct: 0, manutencaoPctObra: 0,
  inccObraMensal: 0, permutaPctVgv: 0, taxaDescontoAnual: 0.12,
};

describe("Correção 09 — fontes de custo (estudo 2 real)", () => {
  it("infraestrutura do sistema separa infra (19.803,52) de obras residenciais (1.200.000) sem duplicar", () => {
    const { fontes, premissas, r } = viab2();
    expect(fontes.config.custoInfraFonte).toBe("sistema"); // legado "manual" padrão migra para sistema; o 10 manual fica preservado
    expect(fontes.infra.infraestruturaTotal).toBeCloseTo(19_803.52, 2);
    expect(fontes.infra.obrasResidenciaisTotal).toBeCloseTo(1_200_000, 2);
    expect(r.custoInfra).toBeCloseTo(19_803.52, 2); // rateado pela área VENDIDA e multiplicado de volta: total exato
    expect(r.custoObrasResidenciais).toBe(1_200_000);
    expect(premissas.custoInfraBaseTotal).toBeCloseTo(19_803.52, 2);
    expect(premissas.custoInfraM2Lote * calcularMix(premissas.itensMix).areaVendidaM2).toBeCloseTo(19_803.52, 2); // R$/m² exibido
    // Casa Pronta sem área do lote: a infraestrutura do sistema não some
    const casa = viab2(comForm({ itensMix: [{ nome: "Casa", quantidade: 12, areaUnidadeM2: 0, precoM2: 0, casaPronta: true, precoUnidade: 230_000 }] })).r;
    expect(casa.custoInfra).toBeCloseTo(19_803.52, 2);
    expect(r.custoTotal).toBeCloseTo(19_803.52 + 1_200_000 + 4_100 + r.vgvGross * 0.04, 1);
  });
  it("valor manual continua disponível e não soma obras residenciais (já estão no R$/m² digitado)", () => {
    const { r, fontes } = viab2(comForm({ custoInfraFonte: "manual" }));
    expect(fontes.infraM2Usado).toBe(10);
    expect(r.custoObrasResidenciais).toBe(0);
    expect(r.custoInfra).toBeCloseTo(10 * 12 * 287.57, 2);
  });
  it("marketing do sistema = fornecedor (4.000) + material publicitário (100) = 4.100", () => {
    const { r, premissas, fontes } = viab2();
    expect(fontes.marketing.total).toBe(4_100);
    expect(premissas.marketing).toBe(4_100);
    expect(r.custoTotal).toBeGreaterThan(4_100);
    expect(viab2(comForm({ marketingFonte: "manual", marketing: 999 })).premissas.marketing).toBe(999);
  });
  it("orçamento: grupo explícito prevalece; dados antigos usam a descrição", () => {
    expect(grupoDaLinha({ descricao: "Obras residenciais", unidade: "un", quantidade: 1, unitario: 1, total: 1 })).toBe("obra_residencial");
    expect(grupoDaLinha({ descricao: "Construção das casas", unidade: "un", quantidade: 1, unitario: 1, total: 1 })).toBe("obra_residencial");
    expect(grupoDaLinha({ descricao: "Terraplanagem", unidade: "m²", quantidade: 1, unitario: 1, total: 1 })).toBe("infraestrutura");
    expect(grupoDaLinha({ descricao: "Obras residenciais", unidade: "un", quantidade: 1, unitario: 1, total: 1, grupo: "infraestrutura" } as never)).toBe("infraestrutura");
  });
  it("sem orçamento o sistema avisa e não inventa valor", () => {
    const { fontes } = viab2({ orcamentoParametrizadoJson: null, ...comForm({ custoInfraFonte: "sistema" }) });
    expect(fontes.infraM2Usado).toBe(0);
    expect(fontes.avisos.join(" ")).toMatch(/Orçamento Parametrizado ainda não preenchido/);
  });
});

describe("Correção 09.6 — investidor: custo financeiro, não receita nem despesa de principal", () => {
  it("aporte de 100.000 entra no M1; resgate no M25 = principal 100.000 + remuneração 26.973,46", () => {
    const { r } = viab2();
    expect(r.capitalCaptado).toBe(100_000);
    expect(r.custoFinanceiroCaptacao).toBeCloseTo(26_973.46, 2);
    const m1 = r.fluxo.find((f) => f.mes === 1)!, m25 = r.fluxo.find((f) => f.mes === 25)!;
    expect(m1.aporteCaptacao).toBe(100_000);
    expect(m25.resgatePrincipal).toBe(100_000);
    expect(m25.resgateRemuneracao).toBeCloseTo(26_973.46, 2);
    expect(r.fluxo.at(-1)!.mes).toBe(25); // o resgate não é omitido
  });
  it("a captação não infla o lucro: com captação = sem captação − custo financeiro", () => {
    const com = viab2().r, sem = viab2(comForm({ considerarCaptacao: false })).r;
    expect(com.lucroLiquido).toBeCloseTo(sem.lucroLiquido - 26_973.46, 1);
    expect(com.recebiveis.total).toBe(sem.recebiveis.total);
    expect(com.fluxo.at(-1)!.saldoAcumulado).toBeCloseTo(com.lucroLiquido, 0);
  });
});

describe("Correção 10 — custo do terreno pela Negociação", () => {
  it("compra parcelada de 180.000 em 12×: 15.000 de M1 a M12, entra no custo e em todos os indicadores", () => {
    const { r, fontes } = viab2();
    expect(fontes.terreno.modalidade).toBe("Compra parcelada");
    expect(r.custoTerreno).toBe(180_000);
    const meses = r.fluxo.filter((f) => f.custoTerreno > 0);
    expect(meses.map((f) => f.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(meses.every((f) => f.custoTerreno === 15_000)).toBe(true);
    expect(r.investimentoTotal).toBeCloseTo(r.custoTotalNominal + 180_000, 2);
    const semTerreno = viab2({ negociacaoTerrenoJson: null }).r;
    expect(r.lucroLiquido).toBeCloseTo(semTerreno.lucroLiquido - 180_000, 1);
  });
  it("auditoria dos prints: ROI ≈ 67% e margem ≈ 40% (antes 1734% e 95,2%); payback e exposição deixam de ser 0", () => {
    const { r } = viab2();
    // lucro = recebíveis 2.598.974,71 − custos nominais 1.347.432,35 − terreno 180.000 − captação 26.973,46
    expect(r.custoTotalProjeto).toBeCloseTo(1_347_432.35 + 180_000 + 26_973.46, 1);
    expect(r.lucroLiquido).toBeCloseTo(2_598_974.71 - r.custoTotalProjeto, 1);
    expect(r.lucroLiquido).toBeCloseTo(r.fluxo.at(-1)!.saldoAcumulado, 0);
    expect(r.roi).toBeCloseTo(r.lucroLiquido / r.custoTotalProjeto, 6);
    expect(r.roi).toBeGreaterThan(0.6); expect(r.roi).toBeLessThan(0.7);
    expect(r.margemLiquida).toBeGreaterThan(0.39); expect(r.margemLiquida).toBeLessThan(0.42);
    expect(r.paybackStatus).toBe("recuperado");
    expect(r.paybackMes).toBeGreaterThan(0);
    expect(r.exposicaoMaxima).toBeGreaterThan(0);
    expect(r.projeto.exposicaoMaxima).toBeGreaterThan(r.exposicaoMaxima); // a captação reduz a exposição do incorporador
  });
  it("TIR indeterminada vira estado explicativo, não número enganoso", () => {
    const { r } = viab2();
    expect(trocasDeSinal(r.fluxo.map((f) => f.saldoMes))).toBeGreaterThan(1);
    expect(r.tirAnual).toBeNull();
    expect(r.tirMotivo).toMatch(/não é única/);
    expect(r.projeto.tirMotivo).not.toBeNull();
    const ag = calcularCenarios(viab2().premissas).agressivo;
    if (ag.paybackStatus === "sem_exposicao") expect(ag.tirAnual).toBeNull(); // fluxo do tipo financiamento: sem TIR enganosa
    const conv = calcularLoteamento({ ...base, prazoParcelamentoMeses: 12, inicioVendasMes: 6 }); // investe antes de vender
    expect(conv.tirAnual).not.toBeNull();
    expect(conv.tirMotivo).toBeNull();
  });
  it("à vista, com entrada, permuta financeira e permuta física", () => {
    expect(programarPagamento(180_000, 1, 1)).toEqual([{ mes: 1, valor: 180_000 }]);
    const comEntrada = programarPagamento(100_000, 2, 3, 10);
    expect(comEntrada).toEqual([{ mes: 2, valor: 10_000 }, { mes: 3, valor: 30_000 }, { mes: 4, valor: 30_000 }, { mes: 5, valor: 30_000 }]);
    expect(programarPagamento(100, 1, 3).reduce((s, d) => s + d.valor, 0)).toBeCloseTo(100, 6);
    const neg = (p: Record<string, unknown>) => ({ negociacaoTerrenoJson: JSON.stringify({ ...NEGOCIACAO_E2, propostas: [{ id: "x", data: "2026-01-01", autor: "grupo", status: "aceita", ...p }] }) });
    const fin = viab2(neg({ tipo: "permuta_financeira", permutaPctVgv: 15 })).r;
    expect(fin.custoTerreno).toBe(0);
    expect(fin.recebiveis.terreneiro).toBeCloseTo(fin.recebiveis.total * 0.15, 1);
    const fis = viab2(neg({ tipo: "permuta_fisica", unidadesPermuta: 2 })).r;
    expect(fis.permutaFisica.unidades).toBe(2);
    expect(fis.mix.totalUnidades).toBe(10); // 2 casas vão ao proprietário: não são vendáveis
    expect(fis.vgvGross).toBeCloseTo((2_579_986.02 * 10) / 12, 0);
    expect(fis.custoObrasResidenciais).toBe(1_200_000); // mas são construídas
    expect(fis.custoTerreno).toBe(0);
    const recusada = terrenoDaNegociacao(estudo2(neg({ tipo: "compra_avista", valorTotal: 1, status: "recusada" })), 1);
    expect(recusada.disponivel).toBe(false);
  });
  it("terreno manual: valor e parcelas digitados", () => {
    const { r } = viab2(comForm({ terrenoFonte: "manual", custoTerrenoManual: 90_000, terrenoParcelasManual: 3, terrenoMesInicio: 2 }));
    expect(r.fluxo.filter((f) => f.custoTerreno > 0).map((f) => [f.mes, f.custoTerreno])).toEqual([[2, 30_000], [3, 30_000], [4, 30_000]]);
  });
  it("composição auditável fecha exatamente com o lucro e classifica cada rubrica", () => {
    const { r, premissas, fontes } = viab2();
    const linhas = composicaoFinanceira(premissas, r, fontes);
    const soma = linhas.filter((l) => l.entraNoResultado).reduce((s, l) => s + l.valor, 0);
    expect(soma).toBeCloseTo(r.lucroLiquido, 1);
    const por = (rub: string) => linhas.find((l) => l.rubrica.startsWith(rub))!;
    expect(por("Aquisição do terreno")).toMatchObject({ classificacao: "Aquisição de terreno", modo: "automático", competencia: "M1–M12", valor: -180_000 });
    expect(por("Aporte de capital")).toMatchObject({ classificacao: "Movimentação de capital", entraNoResultado: false });
    expect(por("Devolução do principal")).toMatchObject({ classificacao: "Movimentação de capital", entraNoResultado: false, competencia: "M25" });
    expect(por("Remuneração do investidor")).toMatchObject({ classificacao: "Despesa financeira", entraNoResultado: true });
    expect(por("Obras residenciais").moduloOrigem).toBe("Orçamento Parametrizado");
  });
});

describe("Correção 11 — cronogramas e convenção temporal", () => {
  it("M0 e M1..M12 = Ano 1; M13 = Ano 2", () => {
    expect([0, 1, 12, 13, 24, 25].map(anoDoMes)).toEqual([1, 1, 1, 2, 2, 3]);
  });
  it("vendas em 12 meses com tudo recebido em 12 meses → 100% no Ano 1, sem Ano 2 artificial", () => {
    const r = calcularLoteamento(base); // prazo 0: saldo no próprio mês da venda
    expect(recebimentosPorAno(r)).toHaveLength(1);
    expect(recebimentosPorAno(r)[0].bruto).toBeCloseTo(r.recebiveis.total, 2);
    expect(vendasPorAno(r)).toEqual([{ ano: 1, unidades: 12, vgv: r.vgvGross }]);
    expect(custosPorAno(r)).toHaveLength(1);
    expect(r.horizonteMeses).toBe(13); // M0..M12
    expect(fluxoPorAno(r)).toHaveLength(1);
  });
  it("vendas em 12 meses com parcelas posteriores → recebimentos distribuídos pelos vencimentos", () => {
    const r = calcularLoteamento({ ...base, prazoParcelamentoMeses: 12 });
    const anos = recebimentosPorAno(r);
    expect(anos.map((a) => a.ano)).toEqual([1, 2]);
    expect(anos[0].bruto + anos[1].bruto).toBeCloseTo(r.recebiveis.total, 1);
    expect(anos[1].bruto).toBeGreaterThan(0);
    expect(vendasPorAno(r)).toHaveLength(1); // a comercialização continua 100% no Ano 1
    expect(r.fluxo.at(-1)!.mes).toBe(24);
  });
  it("custos posteriores legítimos (manutenção pós-obra, resgate) aparecem no ano certo", () => {
    const r = calcularLoteamento({ ...base, manutencaoPctObra: 0.02, captacoes: [{ nome: "I", capital: 1000, mesAporte: 1, mesResgate: 30, valorResgate: 1100 }] });
    const c = custosPorAno(r);
    expect(c.find((a) => a.ano === 2)!.preVenda).toBeCloseTo(r.custosDetalhados.manutencao, 2); // M15
    expect(c.find((a) => a.ano === 3)!.financeiro).toBe(100);
    const ano3 = fluxoPorAno(r).find((a) => a.ano === 3)!;
    expect(ano3.resgatesPrincipal).toBe(1000);
    expect(ano3.remuneracaoInvestidores).toBe(100);
    // a tabela anual fecha: incorporador = projeto + aportes − principal − remuneração, em todo ano
    for (const a of fluxoPorAno(viab2().r)) expect(a.saldo).toBeCloseTo(a.saldoProjeto + a.aportes - a.resgatesPrincipal - a.remuneracaoInvestidores, 1);
  });
  it("sem exposição de caixa: payback e TIR com estado explicativo (não '0')", () => {
    const r = calcularLoteamento({ ...base, custoInfraM2Lote: 0, comissaoPctVgv: 0 });
    expect(r.paybackStatus).toBe("sem_exposicao");
    expect(r.paybackMes).toBeNull();
    expect(r.tirMotivo).toMatch(/nenhum mês com saída/);
    expect(paybackDetalhado([-10, 5, 6])).toEqual({ mes: 1, status: "recuperado" });
    expect(paybackDetalhado([-10, -5])).toEqual({ mes: null, status: "nao_recupera" });
  });
});

describe("Correção 12 — Casa Pronta no Mix de Produtos", () => {
  it("12 × 230.000 = 2.760.000, sem usar a área do terreno como área construída", () => {
    const item = { nome: "Casa 2Q", quantidade: 12, areaUnidadeM2: 287.57, precoM2: 747.64, casaPronta: true, precoUnidade: 230_000 };
    const m = calcularMix([item]);
    expect(m.vgv).toBe(2_760_000);
    expect(m.areaVendidaM2).toBeCloseTo(12 * 287.57, 6); // continua sendo a área dos lotes (base da infra)
    expect(m.precoMedioUnidade).toBe(230_000);
    // desmarcar volta ao cálculo por m² com os mesmos dados preservados
    expect(calcularMix([{ ...item, casaPronta: false }]).vgv).toBeCloseTo(12 * 287.57 * 747.64, 2);
  });
  it("funciona sem KML (lotes avulsos: 12 lotes, 1 quadra, 3.450,88 m², média 287,57)", () => {
    const e = estudo2(comForm({ itensMix: [{ nome: "Casa 2Q", quantidade: 12, areaUnidadeM2: 287.57, precoM2: 747.64, casaPronta: true, precoUnidade: 230_000 }] }));
    const c = urbanismoDoCenario(e)!;
    expect(c.lotes).toHaveLength(12);
    expect(new Set(c.lotes.map((l) => l.quadra)).size).toBe(1);
    const area = c.lotes.reduce((s, l) => s + l.areaM2, 0);
    expect(area).toBeCloseTo(3_450.88, 2);
    expect(area / 12).toBeCloseTo(287.57, 2);
    const r = calcularLoteamento(montarViabilidadeDoEstudo(e)!.premissas);
    expect(r.vgvGross).toBe(2_760_000);
    expect(r.mix.itens[0].vgv).toBe(2_760_000); // um único VGV (casa + lote), sem somar lote de novo
  });
  it("cenários aplicam a variação de preço também ao valor por unidade", () => {
    const c = calcularCenarios({ ...base, itensMix: [{ nome: "C", quantidade: 10, areaUnidadeM2: 200, precoM2: 1, casaPronta: true, precoUnidade: 100_000 }] });
    expect(c.conservador.vgvGross).toBeCloseTo(900_000, 2);
    expect(c.agressivo.vgvGross).toBeCloseTo(1_100_000, 2);
  });
  it("compatibilidade retroativa: item sem os campos novos calcula como antes", () => {
    expect(calcularMix([{ nome: "L", quantidade: 2, areaUnidadeM2: 100, precoM2: 50 }]).vgv).toBe(10_000);
  });
});
