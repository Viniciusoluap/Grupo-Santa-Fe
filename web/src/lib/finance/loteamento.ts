// Motor determinístico de VIABILIDADE (estilo Lotelytics + metodologia Carolina
// Caribé / Incorporação na Prática — conferido contra planilha profissional real).
//
// A partir das premissas (urbanístico + mix de produtos + vendas + terreno +
// custos) produz, SÓ com matemática (sem IA): mix de produtos (lotes, casas,
// apartamentos...), VGV bruto/líquido, fluxo de caixa mensal por fases indexado
// (com correção INCC do custo de obra), VPL, TIR, ROI, margem, payback,
// exposição máxima de caixa (capital necessário), break-even, custos futuros
// (nominais) e distribuição de recebíveis entre incorporador e terreneiro
// (permuta).
//
// Reutiliza vpl/tir/payback de eve.ts. Todas as funções são puras e testáveis.

import { vpl, tir, payback } from "./eve";

export type PerfilVendas =
  | "lancamento_forte"
  | "organico"
  | "constante"
  | "fechamento_forte";

/** Um item do mix de produtos: lotes, casas, área de prédio (apartamentos), comercial etc. */
export interface ItemMixProduto {
  nome: string;
  quantidade: number;
  areaUnidadeM2: number;
  precoM2: number;
}

export interface PremissasLoteamento {
  // ── Urbanístico / terreno ──
  areaBrutaM2: number;
  pctAreaPublica: number;   // fração 0..1
  pctAreaVerde: number;
  pctSistemaViario: number;
  pctAPP: number;           // alimentado automaticamente a partir do mapa (Overpass/Código Florestal)
  pctFaixaServidao: number;

  // ── Mix de produtos (lotes, casas, apartamentos, comercial...) ──
  itensMix: ItemMixProduto[];

  // ── Preço / vendas ──
  duracaoVendasMeses: number;
  perfilVendas: PerfilVendas;
  entradaPct: number;          // fração do valor pago no ato
  prazoParcelamentoMeses: number;
  jurosClienteMensal: number;  // fração a.m.
  indexacaoMensal: number;     // IPCA/INCC a.m. (fração)
  vendasAVistaPct: number;     // fração das vendas à vista
  descontoAVistaPct: number;   // desconto concedido à vista
  inadimplenciaPct: number;    // fração perdida das parcelas
  comissaoPctVgv: number;      // % do VGV
  despesasGeraisPctVgv: number;// % do VGV
  impostosPctVgv: number;      // % do VGV (lucro presumido/RET)
  taxaIncorporacaoPctVgv: number; // % do VGV — custos administrativos/legais iniciais

  // ── Cronograma ──
  inicioObraMes: number;
  duracaoObraMeses: number;
  inicioVendasMes: number;

  // ── Custos ──
  custoInfraM2Lote: number;    // R$/m² de área vendida (obra/infra)
  projetosLicencas: number;
  marketing: number;
  registroPorUnidade: number;
  contingenciaPctInfra: number;// fração sobre infra
  bdiPct: number;              // fração sobre infra
  taxaAdministracaoObraPct: number; // % sobre o custo de obra/infra
  manutencaoPctObra: number;        // % sobre o custo de obra, cobrado após a entrega
  inccObraMensal: number;           // correção mensal do custo de obra ao longo do tempo (fração a.m.)

  // ── Terreno (permuta) ──
  permutaPctVgv: number;       // fração do VGV entregue ao terreneiro

  // ── Financeiro ──
  taxaDescontoAnual: number;   // fração a.a. (VPL / TMA)
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

export interface ResultadoMixItem extends ItemMixProduto {
  areaTotalM2: number;
  vgv: number;
}

export interface ResultadoMix {
  itens: ResultadoMixItem[];
  totalUnidades: number;
  areaVendidaM2: number;
  vgv: number;
  precoMedioUnidade: number;
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
    capacidadeEstimadaUnidades: number; // capacidade da área vendável dado o tamanho médio do mix atual
    taxaAproveitamento: number; // vendável / bruta
  };
  mix: ResultadoMix;
  vgvGross: number;
  vgvNet: number;
  custoInfra: number;
  custosPreVenda: number;
  custosDuranteVenda: number;
  custoTotal: number;
  custoObraNominalTotal: number; // total efetivamente desembolsado na obra, já com correção INCC (custo futuro)
  custoTotalNominal: number;     // custoTotal ajustado pela correção INCC da obra
  custosDetalhados: {
    taxaAdministracaoObra: number;
    manutencao: number;
    taxaIncorporacao: number;
  };
  recebiveis: { voce: number; terreneiro: number; total: number };
  vpl: number;
  tirMensal: number | null;
  tirAnual: number | null;
  roi: number;
  margemLiquida: number;
  paybackMes: number | null;
  exposicaoMaxima: number;
  mesPico: number;
  breakEven: { unidadesNecessarias: number; receitaNecessaria: number; prazoMes: number | null };
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

/** Distribuição de áreas a partir dos parâmetros urbanísticos (independe do produto). */
export function calcularUrbanistico(p: Pick<
  PremissasLoteamento,
  "areaBrutaM2" | "pctAreaPublica" | "pctAreaVerde" | "pctSistemaViario" | "pctAPP" | "pctFaixaServidao"
>) {
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
  const taxaAproveitamento = bruta > 0 ? areaVendavelM2 / bruta : 0;
  return {
    areaBrutaM2: bruta, areaPublicaM2, areaVerdeM2, areaViarioM2, areaAppM2,
    areaServidaoM2, areaVendavelM2, taxaAproveitamento,
  };
}

/** Agrega o mix de produtos: VGV, área vendida e preço médio por unidade. */
export function calcularMix(itens: ItemMixProduto[]): ResultadoMix {
  const resultado: ResultadoMixItem[] = itens.map((it) => ({
    ...it,
    areaTotalM2: it.quantidade * it.areaUnidadeM2,
    vgv: it.quantidade * it.areaUnidadeM2 * it.precoM2,
  }));
  const totalUnidades = resultado.reduce((s, i) => s + i.quantidade, 0);
  const areaVendidaM2 = resultado.reduce((s, i) => s + i.areaTotalM2, 0);
  const vgvTotal = resultado.reduce((s, i) => s + i.vgv, 0);
  const precoMedioUnidade = totalUnidades > 0 ? vgvTotal / totalUnidades : 0;
  return { itens: resultado, totalUnidades, areaVendidaM2, vgv: vgvTotal, precoMedioUnidade };
}

/** Roda o estudo completo de viabilidade. */
export function calcularLoteamento(p: PremissasLoteamento): ResultadoLoteamento {
  const urb = calcularUrbanistico(p);
  const mix = calcularMix(p.itensMix);
  const vgvGross = mix.vgv;
  const areaMediaPonderada = mix.totalUnidades > 0 ? mix.areaVendidaM2 / mix.totalUnidades : 0;
  const capacidadeEstimadaUnidades =
    areaMediaPonderada > 0 ? Math.floor(urb.areaVendavelM2 / areaMediaPonderada) : 0;

  const vgvNet =
    vgvGross * (1 - p.comissaoPctVgv - p.despesasGeraisPctVgv - p.impostosPctVgv);

  // Custos de infraestrutura sobre a área efetivamente ocupada pelo mix de produtos.
  const custoInfraBase = p.custoInfraM2Lote * mix.areaVendidaM2;
  const custoInfra = custoInfraBase * (1 + p.bdiPct);
  const contingencia = custoInfraBase * p.contingenciaPctInfra;
  const registroTotal = p.registroPorUnidade * mix.totalUnidades;
  const taxaAdministracaoObra = custoInfra * p.taxaAdministracaoObraPct;
  const manutencao = custoInfra * p.manutencaoPctObra;
  const taxaIncorporacao = vgvGross * p.taxaIncorporacaoPctVgv;

  const custosPreVenda =
    custoInfra + contingencia + p.projetosLicencas + p.marketing + registroTotal +
    taxaAdministracaoObra + manutencao + taxaIncorporacao;

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
    ) + 4; // +4 meses de folga para caber a manutenção pós-obra (fim da obra + 3)

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

  // ── Custos mensais de obra (com correção INCC ao longo do tempo) + taxa de
  //    incorporação (12 primeiros meses do projeto) + manutenção pontual pós-obra ──
  const custoObraBaseMensal = p.duracaoObraMeses > 0 ? (custoInfra + contingencia) / p.duracaoObraMeses : 0;
  const taxaAdmMensal = p.duracaoObraMeses > 0 ? taxaAdministracaoObra / p.duracaoObraMeses : 0;
  const custosFixosMensal = p.duracaoObraMeses > 0
    ? (p.projetosLicencas + p.marketing + registroTotal) / p.duracaoObraMeses
    : 0;
  const taxaIncorpMeses = Math.min(12, horizonte);
  const taxaIncorpMensal = taxaIncorpMeses > 0 ? taxaIncorporacao / taxaIncorpMeses : 0;
  const mesManutencao = p.inicioObraMes + p.duracaoObraMeses + 3;

  const totalRecebido = recebimento.reduce((s, x) => s + x, 0);
  const fluxo: FluxoMesLote[] = [];
  let acumulado = 0;
  let obraNominalAcumulado = 0;

  for (let mes = 0; mes < horizonte; mes++) {
    const receitaBruta = recebimento[mes];
    const receitaTerreneiro = receitaBruta * p.permutaPctVgv;
    const receitaVoce = receitaBruta - receitaTerreneiro;

    let custoPreVenda = 0;
    if (mes >= p.inicioObraMes && mes < p.inicioObraMes + p.duracaoObraMeses) {
      const decorridos = mes - p.inicioObraMes;
      const obraMesNominal = custoObraBaseMensal * Math.pow(1 + p.inccObraMensal, decorridos);
      obraNominalAcumulado += obraMesNominal;
      custoPreVenda += obraMesNominal + taxaAdmMensal + custosFixosMensal;
    }
    if (mes < taxaIncorpMeses) custoPreVenda += taxaIncorpMensal;
    if (mes === mesManutencao) custoPreVenda += manutencao;

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

  // Custo de obra realmente desembolsado (nominal, já com INCC) vs. o valor-base
  // de hoje (custoInfra+contingencia) — a diferença é a inflação futura da obra.
  const custoObraNominalTotal = obraNominalAcumulado;
  const custoTotalNominal = custoTotal + (custoObraNominalTotal - (custoInfra + contingencia));

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

  // Break-even: quantas unidades (ao preço médio do mix) cobrem o custo total.
  const unidadesNecessarias = mix.precoMedioUnidade > 0 ? Math.ceil(custoTotal / mix.precoMedioUnidade) : 0;
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
      capacidadeEstimadaUnidades,
      taxaAproveitamento: urb.taxaAproveitamento,
    },
    mix: {
      itens: mix.itens.map((i) => ({ ...i, areaTotalM2: round2(i.areaTotalM2), vgv: round2(i.vgv) })),
      totalUnidades: mix.totalUnidades,
      areaVendidaM2: round2(mix.areaVendidaM2),
      vgv: round2(mix.vgv),
      precoMedioUnidade: round2(mix.precoMedioUnidade),
    },
    vgvGross: round2(vgvGross),
    vgvNet: round2(vgvNet),
    custoInfra: round2(custoInfra),
    custosPreVenda: round2(custosPreVenda),
    custosDuranteVenda: round2(custosDuranteVenda),
    custoTotal: round2(custoTotal),
    custoObraNominalTotal: round2(custoObraNominalTotal),
    custoTotalNominal: round2(custoTotalNominal),
    custosDetalhados: {
      taxaAdministracaoObra: round2(taxaAdministracaoObra),
      manutencao: round2(manutencao),
      taxaIncorporacao: round2(taxaIncorporacao),
    },
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
      unidadesNecessarias,
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
 * Três cenários variando o preço/m² de cada produto do mix (−10% / base / +10%)
 * e a velocidade de vendas (conservador vende mais devagar; agressivo mais rápido).
 */
export function calcularCenarios(p: PremissasLoteamento): CenariosLoteamento {
  const ajustarPreco = (fator: number): ItemMixProduto[] =>
    p.itensMix.map((it) => ({ ...it, precoM2: it.precoM2 * fator }));

  const conservador = calcularLoteamento({
    ...p,
    itensMix: ajustarPreco(0.9),
    duracaoVendasMeses: Math.round(p.duracaoVendasMeses * 1.4),
  });
  const ideal = calcularLoteamento(p);
  const agressivo = calcularLoteamento({
    ...p,
    itensMix: ajustarPreco(1.1),
    duracaoVendasMeses: Math.max(1, Math.round(p.duracaoVendasMeses * 0.7)),
  });
  return { conservador, ideal, agressivo };
}
