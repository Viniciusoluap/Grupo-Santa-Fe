// Motor determinístico de viabilidade de LOTEAMENTO (estilo Lotelytics).
//
// A partir das premissas (urbanístico + vendas + terreno + custos) produz, SÓ com
// matemática (sem IA): área vendável e nº de lotes, VGV bruto/líquido, fluxo de
// caixa mensal por fases indexado, VPL, TIR, ROI, margem, payback, exposição
// máxima de caixa (capital necessário), break-even e distribuição de recebíveis
// entre incorporador e terreneiro (permuta).
//
// Reutiliza vpl/tir/payback de eve.ts. Todas as funções são puras e testáveis.

import { vpl, tir, payback } from "./eve";

export type PerfilVendas =
  | "lancamento_forte"
  | "organico"
  | "constante"
  | "fechamento_forte";

export interface PremissasLoteamento {
  // ── Urbanístico / terreno ──
  areaBrutaM2: number;
  pctAreaPublica: number;   // fração 0..1
  pctAreaVerde: number;
  pctSistemaViario: number;
  pctAPP: number;
  pctFaixaServidao: number;
  areaMediaLoteM2: number;

  // ── Preço / vendas ──
  precoM2: number;
  duracaoVendasMeses: number;
  perfilVendas: PerfilVendas;
  entradaPct: number;          // fração do valor do lote paga no ato
  prazoParcelamentoMeses: number;
  jurosClienteMensal: number;  // fração a.m.
  indexacaoMensal: number;     // IPCA a.m. (fração)
  vendasAVistaPct: number;     // fração das vendas à vista
  descontoAVistaPct: number;   // desconto concedido à vista
  inadimplenciaPct: number;    // fração perdida das parcelas
  comissaoPctVgv: number;      // % do VGV
  despesasGeraisPctVgv: number;// % do VGV
  impostosPctVgv: number;      // % do VGV (lucro presumido)

  // ── Cronograma ──
  inicioObraMes: number;
  duracaoObraMeses: number;
  inicioVendasMes: number;

  // ── Custos ──
  custoInfraM2Lote: number;    // R$/m² de área de lote
  projetosLicencas: number;
  marketing: number;
  registroPorLote: number;
  contingenciaPctInfra: number;// fração sobre infra
  bdiPct: number;              // fração sobre infra

  // ── Terreno (permuta) ──
  permutaPctVgv: number;       // fração do VGV entregue ao terreneiro

  // ── Financeiro ──
  taxaDescontoAnual: number;   // fração a.a. (VPL)
}

export interface FluxoMesLote {
  mes: number;
  receitaBruta: number;   // recebimentos totais (100%)
  receitaVoce: number;    // parte do incorporador
  receitaTerreneiro: number;
  custoPreVenda: number;
  custoDuranteVenda: number;
  saldoMes: number;       // do incorporador
  saldoAcumulado: number;
}

export interface ResultadoLoteamento {
  urbanistico: {
    areaBrutaM2: number;
    areaPublicaM2: number;
    areaVerdeM2: number;
    areaViarioM2: number;
    areaAppM2: number;
    areaServidaoM2: number;
    areaVendavelM2: number;
    totalLotes: number;
    taxaAproveitamento: number; // vendável / bruta
  };
  vgvGross: number;
  vgvNet: number;
  precoLote: number;
  custoInfra: number;
  custosPreVenda: number;
  custosDuranteVenda: number;
  custoTotal: number;
  recebiveis: { voce: number; terreneiro: number; total: number };
  vpl: number;
  tirMensal: number | null;
  tirAnual: number | null;
  roi: number;
  margemLiquida: number;
  paybackMes: number | null;
  exposicaoMaxima: number;
  mesPico: number;
  breakEven: { lotesNecessarios: number; receitaNecessaria: number; prazoMes: number | null };
  fluxo: FluxoMesLote[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pesos de venda por mês conforme o perfil da curva (somam 1). */
export function pesosCurvaVendas(meses: number, perfil: PerfilVendas): number[] {
  const n = Math.max(1, Math.round(meses));
  const w: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1); // 0..1
    let peso: number;
    switch (perfil) {
      case "lancamento_forte": peso = 1 - 0.8 * t; break;        // decrescente
      case "fechamento_forte": peso = 0.2 + 0.8 * t; break;      // crescente
      case "organico": peso = Math.sin(Math.PI * (t * 0.9 + 0.05)); break; // sino
      case "constante":
      default: peso = 1; break;
    }
    w.push(Math.max(0.0001, peso));
  }
  const soma = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / soma);
}

/** Distribuição de áreas + nº de lotes a partir dos parâmetros urbanísticos. */
export function calcularUrbanistico(p: PremissasLoteamento) {
  const bruta = Math.max(0, p.areaBrutaM2);
  const areaPublicaM2 = bruta * p.pctAreaPublica;
  const areaVerdeM2 = bruta * p.pctAreaVerde;
  const areaViarioM2 = bruta * p.pctSistemaViario;
  const areaAppM2 = bruta * p.pctAPP;
  const areaServidaoM2 = bruta * p.pctFaixaServidao;
  const areaVendavelM2 = Math.max(
    0,
    bruta - areaPublicaM2 - areaVerdeM2 - areaViarioM2 - areaAppM2 - areaServidaoM2
  );
  const totalLotes = p.areaMediaLoteM2 > 0 ? Math.floor(areaVendavelM2 / p.areaMediaLoteM2) : 0;
  const taxaAproveitamento = bruta > 0 ? areaVendavelM2 / bruta : 0;
  return {
    areaBrutaM2: bruta, areaPublicaM2, areaVerdeM2, areaViarioM2, areaAppM2,
    areaServidaoM2, areaVendavelM2, totalLotes, taxaAproveitamento,
  };
}

/** Roda o estudo completo de loteamento. */
export function calcularLoteamento(p: PremissasLoteamento): ResultadoLoteamento {
  const urb = calcularUrbanistico(p);
  const precoLote = p.areaMediaLoteM2 * p.precoM2;

  // VGV bruto = área vendável × preço/m² (equivale a nº lotes × preço do lote).
  const vgvGross = urb.areaVendavelM2 * p.precoM2;
  const vgvNet =
    vgvGross * (1 - p.comissaoPctVgv - p.despesasGeraisPctVgv - p.impostosPctVgv);

  // Custos.
  const custoInfraBase = p.custoInfraM2Lote * urb.areaVendavelM2;
  const custoInfra = custoInfraBase * (1 + p.bdiPct);
  const contingencia = custoInfraBase * p.contingenciaPctInfra;
  const registroTotal = p.registroPorLote * urb.totalLotes;
  const custosPreVenda =
    custoInfra + contingencia + p.projetosLicencas + p.marketing + registroTotal;

  const comissao = vgvGross * p.comissaoPctVgv;
  const despesas = vgvGross * p.despesasGeraisPctVgv;
  const impostos = vgvGross * p.impostosPctVgv;
  const custosDuranteVenda = comissao + despesas + impostos;
  const custoTotal = custosPreVenda + custosDuranteVenda;

  // ── Simulação mensal de recebimentos ──
  const pesos = pesosCurvaVendas(p.duracaoVendasMeses, p.perfilVendas);
  const horizonte =
    Math.max(
      p.inicioObraMes + p.duracaoObraMeses,
      p.inicioVendasMes + pesos.length + p.prazoParcelamentoMeses
    ) + 1;

  const recebimento = new Array(horizonte).fill(0); // 100% (bruto)
  const fator = 1 - p.inadimplenciaPct;

  for (let i = 0; i < pesos.length; i++) {
    const mesVenda = p.inicioVendasMes + i;
    const vgvCohort = vgvGross * pesos[i];
    const vgvVista = vgvCohort * p.vendasAVistaPct;
    const vgvFinanciado = vgvCohort - vgvVista;

    // À vista: entra no mês da venda, com desconto.
    if (mesVenda < horizonte) recebimento[mesVenda] += vgvVista * (1 - p.descontoAVistaPct);

    // Financiado: entrada no ato + parcelas indexadas com juros, líquidas de inadimplência.
    const entrada = vgvFinanciado * p.entradaPct;
    if (mesVenda < horizonte) recebimento[mesVenda] += entrada;
    const saldo = vgvFinanciado - entrada;
    const nParc = Math.max(1, p.prazoParcelamentoMeses);
    const parcela = saldo / nParc;
    for (let k = 1; k <= nParc; k++) {
      const mes = mesVenda + k;
      if (mes >= horizonte) break;
      const corrigida = parcela * Math.pow(1 + p.indexacaoMensal + p.jurosClienteMensal, k) * fator;
      recebimento[mes] += corrigida;
    }
  }

  // ── Fluxo de caixa do incorporador ──
  const custoPreVendaMes = p.duracaoObraMeses > 0 ? custosPreVenda / p.duracaoObraMeses : 0;
  const totalRecebido = recebimento.reduce((s, x) => s + x, 0);
  const fluxo: FluxoMesLote[] = [];
  let acumulado = 0;

  for (let mes = 0; mes < horizonte; mes++) {
    const receitaBruta = recebimento[mes];
    const receitaTerreneiro = receitaBruta * p.permutaPctVgv;
    const receitaVoce = receitaBruta - receitaTerreneiro;

    let custoPreVenda = 0;
    if (mes >= p.inicioObraMes && mes < p.inicioObraMes + p.duracaoObraMeses) {
      custoPreVenda = custoPreVendaMes;
    }
    // Custos durante venda: proporcionais ao recebimento do mês.
    const custoDuranteVenda = totalRecebido > 0 ? (receitaBruta / totalRecebido) * custosDuranteVenda : 0;

    const saldoMes = receitaVoce - custoPreVenda - custoDuranteVenda;
    acumulado += saldoMes;
    fluxo.push({
      mes,
      receitaBruta: round2(receitaBruta),
      receitaVoce: round2(receitaVoce),
      receitaTerreneiro: round2(receitaTerreneiro),
      custoPreVenda: round2(custoPreVenda),
      custoDuranteVenda: round2(custoDuranteVenda),
      saldoMes: round2(saldoMes),
      saldoAcumulado: round2(acumulado),
    });
  }

  const saldos = fluxo.map((f) => f.saldoMes);
  const saldoAcum = fluxo.map((f) => f.saldoAcumulado);
  const taxaMensal = Math.pow(1 + p.taxaDescontoAnual, 1 / 12) - 1;
  const vplV = vpl(saldos, taxaMensal);
  const tirM = tir(saldos);
  const tirA = tirM != null ? Math.pow(1 + tirM, 12) - 1 : null;

  const menorAcum = Math.min(0, ...saldoAcum);
  const exposicaoMaxima = Math.abs(menorAcum);
  const mesPico = saldoAcum.indexOf(menorAcum);

  const recebiveisVoce = totalRecebido * (1 - p.permutaPctVgv);
  const recebiveisTerreneiro = totalRecebido * p.permutaPctVgv;
  const lucro = recebiveisVoce - custoTotal;
  const roi = custoTotal > 0 ? recebiveisVoce / custoTotal - 1 : 0;
  const margemLiquida = vgvGross > 0 ? lucro / vgvGross : 0;

  // Break-even: quantos lotes cobrem o custo total (receita necessária / preço do lote).
  const lotesNecessarios = precoLote > 0 ? Math.ceil(custoTotal / precoLote) : 0;
  const prazoBreakEven = payback(saldoAcum);

  return {
    urbanistico: {
      areaBrutaM2: round2(urb.areaBrutaM2),
      areaPublicaM2: round2(urb.areaPublicaM2),
      areaVerdeM2: round2(urb.areaVerdeM2),
      areaViarioM2: round2(urb.areaViarioM2),
      areaAppM2: round2(urb.areaAppM2),
      areaServidaoM2: round2(urb.areaServidaoM2),
      areaVendavelM2: round2(urb.areaVendavelM2),
      totalLotes: urb.totalLotes,
      taxaAproveitamento: urb.taxaAproveitamento,
    },
    vgvGross: round2(vgvGross),
    vgvNet: round2(vgvNet),
    precoLote: round2(precoLote),
    custoInfra: round2(custoInfra),
    custosPreVenda: round2(custosPreVenda),
    custosDuranteVenda: round2(custosDuranteVenda),
    custoTotal: round2(custoTotal),
    recebiveis: {
      voce: round2(recebiveisVoce),
      terreneiro: round2(recebiveisTerreneiro),
      total: round2(totalRecebido),
    },
    vpl: round2(vplV),
    tirMensal: tirM,
    tirAnual: tirA,
    roi,
    margemLiquida,
    paybackMes: prazoBreakEven,
    exposicaoMaxima: round2(exposicaoMaxima),
    mesPico: mesPico < 0 ? 0 : mesPico,
    breakEven: {
      lotesNecessarios,
      receitaNecessaria: round2(custoTotal),
      prazoMes: prazoBreakEven,
    },
    fluxo,
  };
}

export interface CenariosLoteamento {
  conservador: ResultadoLoteamento;
  ideal: ResultadoLoteamento;
  agressivo: ResultadoLoteamento;
}

/**
 * Três cenários variando o preço/m² (−10% / base / +10%) e a velocidade de
 * vendas (conservador vende mais devagar; agressivo mais rápido).
 */
export function calcularCenarios(p: PremissasLoteamento): CenariosLoteamento {
  const conservador = calcularLoteamento({
    ...p,
    precoM2: p.precoM2 * 0.9,
    duracaoVendasMeses: Math.round(p.duracaoVendasMeses * 1.4),
  });
  const ideal = calcularLoteamento(p);
  const agressivo = calcularLoteamento({
    ...p,
    precoM2: p.precoM2 * 1.1,
    duracaoVendasMeses: Math.max(1, Math.round(p.duracaoVendasMeses * 0.7)),
  });
  return { conservador, ideal, agressivo };
}
