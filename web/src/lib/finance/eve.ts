// EVE — Estudo de Viabilidade Econômica (metodologia Carolina Caribé / Incorporação na Prática)
//
// Funções puras (sem I/O) que transformam os inputs do empreendimento em:
//   VGV, fluxo de caixa mensal indexado, VPL, TIR, payback, exposição máxima de
//   caixa e margem líquida — além do tratamento do terreno (compra x permuta).
//
// Todas as funções são determinísticas e testáveis isoladamente.

// ─── Tipos de entrada ────────────────────────────────────────────────────────

export interface UnidadeMix {
  /** Rótulo do produto (ex.: "Lote 300m²", "Casa 2Q", "Apto 3Q"). */
  nome: string;
  /** Quantidade de unidades desse produto. */
  quantidade: number;
  /** Área privativa/vendável de cada unidade (m²). */
  areaUnidadeM2: number;
  /** Preço de venda por m² desse produto (R$). */
  precoM2: number;
}

export type TipoTerreno = "compra" | "permuta_fisica" | "permuta_financeira";

export interface TerrenoInput {
  tipo: TipoTerreno;
  /** Valor de compra (à vista ou financiado) — usado quando tipo = "compra". */
  valorCompra?: number;
  /** Mês em que a compra do terreno é paga (0 = início). */
  mesPagamento?: number;
  /** % do VGV entregue ao terreneiro (permuta financeira) — ex.: 0.15. */
  percentualVgv?: number;
  /** Nº de unidades entregues ao terreneiro (permuta física). */
  unidadesPermutadas?: number;
}

export interface CustoInput {
  /** Custo de obra/infra por m² de área construída/vendável (R$). */
  custoObraM2: number;
  /** Custos indiretos como % do VGV (projetos, taxas, marketing, tributos). */
  indiretosPercentualVgv: number;
  /** Comissão de vendas como % do VGV. */
  comissaoPercentualVgv: number;
}

export interface CronogramaInput {
  /** Nº de meses de obra. */
  mesesObra: number;
  /** Nº de meses de vendas (absorção). */
  mesesVendas: number;
  /** Mês de início da obra (0 = início do projeto). */
  inicioObraMes: number;
  /** Mês de início das vendas (0 = início do projeto). */
  inicioVendasMes: number;
}

export interface FinanceiroInput {
  /** Taxa de desconto mensal para VPL (ex.: 0.008 = 0,8% a.m.). */
  taxaDescontoMensal: number;
  /** Índice de correção mensal das parcelas (INCC/IGPM), ex.: 0.005. */
  indexacaoMensal: number;
  /** % do preço pago como entrada no ato da venda (0..1). */
  entradaPercentual: number;
}

export interface EveInput {
  mix: UnidadeMix[];
  terreno: TerrenoInput;
  custos: CustoInput;
  cronograma: CronogramaInput;
  financeiro: FinanceiroInput;
}

// ─── Tipos de saída ──────────────────────────────────────────────────────────

export interface FluxoMes {
  mes: number;
  receitas: number;
  custosObra: number;
  custoTerreno: number;
  indiretos: number;
  comissao: number;
  saldoMes: number;
  saldoAcumulado: number;
}

export interface EveResultado {
  vgv: number;
  areaVendavelM2: number;
  custoObraTotal: number;
  custoTerreno: number;
  custosIndiretos: number;
  comissaoTotal: number;
  custoTotal: number;
  lucroBruto: number;
  margemLiquida: number; // lucro / VGV
  vpl: number;
  tir: number | null; // taxa mensal; null se não convergir
  paybackMes: number | null;
  exposicaoMaxima: number; // maior saldo acumulado negativo (valor absoluto)
  fluxo: FluxoMes[];
}

// ─── Cálculos básicos ────────────────────────────────────────────────────────

/** VGV = soma(quantidade × área × preço/m²) de cada produto do mix. */
export function calcularVgv(mix: UnidadeMix[]): number {
  return mix.reduce((s, u) => s + u.quantidade * u.areaUnidadeM2 * u.precoM2, 0);
}

/** Área vendável total (m²) = soma(quantidade × área). */
export function calcularAreaVendavel(mix: UnidadeMix[]): number {
  return mix.reduce((s, u) => s + u.quantidade * u.areaUnidadeM2, 0);
}

/**
 * Custo do terreno em reais para efeito de fluxo de caixa.
 * - compra: valorCompra
 * - permuta financeira: percentualVgv × VGV
 * - permuta física: valor das unidades permutadas (preço médio × área média)
 */
export function calcularCustoTerreno(terreno: TerrenoInput, mix: UnidadeMix[], vgv: number): number {
  switch (terreno.tipo) {
    case "compra":
      return terreno.valorCompra ?? 0;
    case "permuta_financeira":
      return (terreno.percentualVgv ?? 0) * vgv;
    case "permuta_fisica": {
      const totalUnidades = mix.reduce((s, u) => s + u.quantidade, 0);
      if (totalUnidades === 0) return 0;
      const valorMedioUnidade = vgv / totalUnidades;
      return (terreno.unidadesPermutadas ?? 0) * valorMedioUnidade;
    }
  }
}

// ─── Indicadores financeiros ─────────────────────────────────────────────────

/** Valor Presente Líquido de uma série de fluxos (fluxo[0] = mês 0). */
export function vpl(fluxos: number[], taxaMensal: number): number {
  return fluxos.reduce((acc, f, t) => acc + f / Math.pow(1 + taxaMensal, t), 0);
}

/**
 * Taxa Interna de Retorno mensal via bisseção no intervalo [-0,99; 1].
 * Retorna null se não houver troca de sinal (sem raiz no intervalo).
 */
export function tir(fluxos: number[]): number | null {
  const f = (taxa: number) => vpl(fluxos, taxa);
  let lo = -0.99;
  let hi = 1.0;
  let flo = f(lo);
  let fhi = f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return null; // sem raiz no intervalo
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < 1e-6) return mid;
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

/** Primeiro mês em que o saldo acumulado fica ≥ 0. null se nunca acontecer. */
export function payback(saldoAcumulado: number[]): number | null {
  for (let i = 0; i < saldoAcumulado.length; i++) {
    if (saldoAcumulado[i] >= 0) return i;
  }
  return null;
}

// ─── Motor principal do EVE ──────────────────────────────────────────────────

/**
 * Roda o estudo completo: distribui receitas (com entrada + parcelas indexadas),
 * custos de obra (curva linear na janela de obra), terreno, indiretos e comissão
 * ao longo dos meses, e calcula os indicadores.
 */
export function calcularEve(input: EveInput): EveResultado {
  const { mix, terreno, custos, cronograma, financeiro } = input;

  const vgv = calcularVgv(mix);
  const areaVendavelM2 = calcularAreaVendavel(mix);
  const custoObraTotal = areaVendavelM2 * custos.custoObraM2;
  const custoTerreno = calcularCustoTerreno(terreno, mix, vgv);
  const custosIndiretos = vgv * custos.indiretosPercentualVgv;
  const comissaoTotal = vgv * custos.comissaoPercentualVgv;
  const custoTotal = custoObraTotal + custoTerreno + custosIndiretos + comissaoTotal;
  const lucroBruto = vgv - custoTotal;
  const margemLiquida = vgv > 0 ? lucroBruto / vgv : 0;

  const horizonte = Math.max(
    cronograma.inicioObraMes + cronograma.mesesObra,
    cronograma.inicioVendasMes + cronograma.mesesVendas
  ) + 1;

  const fluxo: FluxoMes[] = [];
  let acumulado = 0;

  // Distribuição de receitas: cada mês de venda "vende" uma fatia igual do VGV.
  // Cada venda paga uma entrada no mês e o restante em parcelas iguais indexadas
  // até o fim do horizonte. Modelo simplificado, fiel ao espírito do EVE.
  const vgvPorMesVenda = cronograma.mesesVendas > 0 ? vgv / cronograma.mesesVendas : 0;

  for (let mes = 0; mes < horizonte; mes++) {
    // Receitas do mês: soma das entradas de vendas iniciadas neste mês +
    // parcelas de vendas iniciadas em meses anteriores (indexadas).
    let receitas = 0;
    for (let vmes = cronograma.inicioVendasMes; vmes < cronograma.inicioVendasMes + cronograma.mesesVendas; vmes++) {
      if (vmes > mes) continue;
      const entrada = vgvPorMesVenda * financeiro.entradaPercentual;
      const saldoParcelar = vgvPorMesVenda - entrada;
      const nParcelas = horizonte - vmes;
      const parcelaBase = nParcelas > 0 ? saldoParcelar / nParcelas : 0;
      if (vmes === mes) {
        receitas += entrada;
      }
      // parcela indexada pelo nº de meses decorridos desde a venda
      const decorridos = mes - vmes;
      if (decorridos >= 0) {
        receitas += parcelaBase * Math.pow(1 + financeiro.indexacaoMensal, decorridos);
      }
    }

    // Custos de obra: distribuídos linearmente na janela de obra.
    let custosObra = 0;
    if (
      mes >= cronograma.inicioObraMes &&
      mes < cronograma.inicioObraMes + cronograma.mesesObra &&
      cronograma.mesesObra > 0
    ) {
      custosObra = custoObraTotal / cronograma.mesesObra;
    }

    // Terreno: pago de uma vez no mês configurado (compra) ou diluído como
    // dedução proporcional às vendas (permutas). Simplificação: no mês de pagamento.
    let custoTerrenoMes = 0;
    const mesPagTerreno = terreno.mesPagamento ?? 0;
    if (terreno.tipo === "compra" && mes === mesPagTerreno) {
      custoTerrenoMes = custoTerreno;
    } else if (terreno.tipo !== "compra") {
      // Permuta: o custo do terreno é "pago" em unidades/‰ do VGV → deduz proporcional às receitas.
      custoTerrenoMes = vgv > 0 ? (receitas / vgv) * custoTerreno : 0;
    }

    // Indiretos e comissão: proporcionais às receitas do mês.
    const indiretos = vgv > 0 ? (receitas / vgv) * custosIndiretos : 0;
    const comissao = vgv > 0 ? (receitas / vgv) * comissaoTotal : 0;

    const saldoMes = receitas - custosObra - custoTerrenoMes - indiretos - comissao;
    acumulado += saldoMes;

    fluxo.push({
      mes,
      receitas: round2(receitas),
      custosObra: round2(custosObra),
      custoTerreno: round2(custoTerrenoMes),
      indiretos: round2(indiretos),
      comissao: round2(comissao),
      saldoMes: round2(saldoMes),
      saldoAcumulado: round2(acumulado),
    });
  }

  const fluxosSaldo = fluxo.map((f) => f.saldoMes);
  const saldoAcum = fluxo.map((f) => f.saldoAcumulado);
  const exposicaoMaxima = Math.abs(Math.min(0, ...saldoAcum));

  return {
    vgv: round2(vgv),
    areaVendavelM2: round2(areaVendavelM2),
    custoObraTotal: round2(custoObraTotal),
    custoTerreno: round2(custoTerreno),
    custosIndiretos: round2(custosIndiretos),
    comissaoTotal: round2(comissaoTotal),
    custoTotal: round2(custoTotal),
    lucroBruto: round2(lucroBruto),
    margemLiquida,
    vpl: round2(vpl(fluxosSaldo, financeiro.taxaDescontoMensal)),
    tir: tir(fluxosSaldo),
    paybackMes: payback(saldoAcum),
    exposicaoMaxima: round2(exposicaoMaxima),
    fluxo,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Análise de sensibilidade ────────────────────────────────────────────────

export interface CenarioSensibilidade {
  variavel: "preco" | "custo" | "velocidade_vendas";
  rotulo: string;
  delta: number; // ex.: -0.1 = -10%
  vgv: number;
  margemLiquida: number;
  vpl: number;
  tir: number | null;
}

/**
 * Recalcula o EVE variando preço de venda, custo de obra e velocidade de
 * vendas (± delta), para medir a robustez do resultado. Metodologia clássica
 * de stress test do EVE.
 */
export function analiseSensibilidade(
  input: EveInput,
  deltas: number[] = [-0.1, 0.1]
): CenarioSensibilidade[] {
  const out: CenarioSensibilidade[] = [];

  for (const d of deltas) {
    // Preço de venda ±d
    const precoInput: EveInput = {
      ...input,
      mix: input.mix.map((u) => ({ ...u, precoM2: u.precoM2 * (1 + d) })),
    };
    const rp = calcularEve(precoInput);
    out.push({
      variavel: "preco", delta: d,
      rotulo: `Preço ${d > 0 ? "+" : ""}${Math.round(d * 100)}%`,
      vgv: rp.vgv, margemLiquida: rp.margemLiquida, vpl: rp.vpl, tir: rp.tir,
    });

    // Custo de obra ±d (diretos e indiretos)
    const custoInput: EveInput = {
      ...input,
      custos: {
        ...input.custos,
        custoObraM2: input.custos.custoObraM2 * (1 + d),
        indiretosPercentualVgv: input.custos.indiretosPercentualVgv * (1 + d),
      },
    };
    const rc = calcularEve(custoInput);
    out.push({
      variavel: "custo", delta: d,
      rotulo: `Custo ${d > 0 ? "+" : ""}${Math.round(d * 100)}%`,
      vgv: rc.vgv, margemLiquida: rc.margemLiquida, vpl: rc.vpl, tir: rc.tir,
    });

    // Velocidade de vendas ±d (delta positivo = vende mais rápido = menos meses)
    const mesesAjustados = Math.max(1, Math.round(input.cronograma.mesesVendas / (1 + d)));
    const vendasInput: EveInput = {
      ...input,
      cronograma: { ...input.cronograma, mesesVendas: mesesAjustados },
    };
    const rv = calcularEve(vendasInput);
    out.push({
      variavel: "velocidade_vendas", delta: d,
      rotulo: `Vendas ${d > 0 ? "+" : ""}${Math.round(d * 100)}% velocidade`,
      vgv: rv.vgv, margemLiquida: rv.margemLiquida, vpl: rv.vpl, tir: rv.tir,
    });
  }

  return out;
}
