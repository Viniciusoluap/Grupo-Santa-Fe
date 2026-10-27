import { cenarioPrincipalDe } from "@/lib/incorporacao/estudos-massa";
// Conversão "formulário salvo (loteamentoJson) → premissas completas do motor
// de viabilidade" — extraída da aba Viabilidade para ser reaproveitada também
// pelo Relatório Executivo de Incorporação (Lote 6), sem duplicar a lógica de
// conversão de formulário → motor nem acoplar o relatório a um componente
// "use client".
//
// Funções puras (sem I/O, sem React) — testáveis isoladamente.

import {
  type PremissasLoteamento,
  type ItemMixProduto,
  type PerfilVendas,
} from "@/lib/finance/loteamento";
import {
  calcularPrecificacaoPorComparaveis,
  type AtributoComparavel,
  type Comparavel,
} from "@/lib/mercado/precificacao";
import {
  calcularOrcamentoParametrizado,
  type PremissasOrcamentoParametrizado,
} from "@/lib/orcamento/parametrizado";
import type { EstudoData } from "@/app/admin/incorporacao/_components/incorporacao-detail";

// Percentuais são representados em % (ex.: 10) neste formulário e convertidos
// para fração (0..1) só na conversão para o motor (paraMotor).
export interface PremissasForm {
  custoInfraModo?: "orcamento" | "manual";
  mixModo?: "cenario" | "manual";
  urbanismoModo?: "cenario" | "manual";
  urbanismoFonte?: string | null;
  areaBrutaM2: number;
  pctAreaPublica: number;
  pctAreaVerde: number;
  pctSistemaViario: number;
  pctFaixaServidao: number;
  duracaoVendasMeses: number;
  perfilVendas: PerfilVendas;
  entradaPct: number;
  prazoParcelamentoMeses: number;
  jurosClienteMensal: number;
  indexacaoMensal: number;
  vendasAVistaPct: number;
  descontoAVistaPct: number;
  inadimplenciaPct: number;
  comissaoPctVgv: number;
  despesasGeraisPctVgv: number;
  impostosPctVgv: number;
  taxaIncorporacaoPctVgv: number;
  inicioObraMes: number;
  duracaoObraMeses: number;
  inicioVendasMes: number;
  custoInfraM2Lote: number;
  projetosLicencas: number;
  marketing: number;
  registroPorUnidade: number;
  contingenciaPctInfra: number;
  bdiPct: number;
  taxaAdministracaoObraPct: number;
  manutencaoPctObra: number;
  inccObraMensal: number;
  permutaPctVgv: number;
  taxaDescontoAnual: number;
}

/**
 * Custo/m² real vindo do Orçamento Parametrizado (2.4), quando já preenchido —
 * substitui o valor genérico de custoInfraM2Lote enquanto o usuário não
 * definir um valor próprio na Viabilidade.
 */
export function custoInfraDoOrcamentoParametrizado(estudo: EstudoData): number {
  if (!estudo.orcamentoParametrizadoJson) return 0;
  try {
    const salvo = JSON.parse(estudo.orcamentoParametrizadoJson) as PremissasOrcamentoParametrizado;
    const r = calcularOrcamentoParametrizado(salvo);
    if (salvo.metodo === "infraestrutura" || salvo.metodo === "excel") return salvo.areaReferenciaM2 && salvo.areaReferenciaM2 > 0 ? r.custoTotal / salvo.areaReferenciaM2 : 0;
    return r.custoM2Real > 0 ? r.custoM2Real : 0;
  } catch {
    return 0;
  }
}

/** Fonte única das áreas: cenário principal espelhado, inclusive lotes sem KML. */
export function urbanismoDoCenario(estudo: EstudoData) {
  return cenarioPrincipalDe({ massaCenariosJson: estudo.massaCenariosJson, cenarioEscolhidoId: estudo.cenarioEscolhidoId,
    areaBrutaM2: estudo.areaM2, semKml: estudo.semKml ?? false, lotesAvulsosJson: estudo.lotesAvulsosJson ?? null });
}

/** Ajustes manuais e viabilidades legadas salvas nunca são sobrescritos. */
export function sincronizarUrbanismo(estudo: EstudoData, form: PremissasForm): PremissasForm {
  if (form.custoInfraModo === "orcamento") {
    const custo = custoInfraDoOrcamentoParametrizado(estudo);
    if (custo > 0) form = { ...form, custoInfraM2Lote: custo };
  }
  if (form.urbanismoModo !== "cenario") return form;
  const origem = urbanismoDoCenario(estudo);
  const q = origem?.quadroAreas;
  if (!q || q.areaBrutaM2 <= 0) return form;
  const pct = (area: number) => area / q.areaBrutaM2 * 100;
  return { ...form, urbanismoFonte: origem!.cenarioId ?? "lotes_avulsos", areaBrutaM2: q.areaBrutaM2,
    // Área pública total JÁ inclui vias e verde: aqui entra só a institucional.
    pctAreaPublica: pct(q.areaInstitucionalM2), pctAreaVerde: pct(q.areaVerdeM2), pctSistemaViario: pct(q.sistemaViarioM2),
    pctFaixaServidao: pct(q.faixaServidaoM2 + q.faixaTransmissaoM2 + q.supressaoVegetalM2 + q.outrasNaoParcelaveisM2) };
}

export function appDaViabilidade(estudo: EstudoData, form: PremissasForm): number {
  return form.urbanismoModo === "cenario" ? urbanismoDoCenario(estudo)?.quadroAreas?.appM2 ?? estudo.appAreaM2 ?? 0 : estudo.appAreaM2 ?? 0;
}

export function defaultsForm(estudo: EstudoData): PremissasForm {
  const custoParametrizado = custoInfraDoOrcamentoParametrizado(estudo);
  return {
    custoInfraModo: estudo.loteamentoJson ? "manual" : "orcamento",
    mixModo: estudo.loteamentoJson ? "manual" : "cenario",
    urbanismoModo: estudo.loteamentoJson ? "manual" : "cenario",
    areaBrutaM2: Math.round(estudo.areaM2) || 100_000,
    pctAreaPublica: 10,
    pctAreaVerde: 5,
    pctSistemaViario: 25,
    pctFaixaServidao: 0,
    duracaoVendasMeses: 24,
    perfilVendas: "lancamento_forte",
    entradaPct: 10,
    prazoParcelamentoMeses: 180,
    jurosClienteMensal: 0.52,
    indexacaoMensal: 0.4,
    vendasAVistaPct: 5,
    descontoAVistaPct: 10,
    inadimplenciaPct: 5,
    comissaoPctVgv: 5,
    despesasGeraisPctVgv: 3,
    impostosPctVgv: 6.58,
    taxaIncorporacaoPctVgv: 1,
    inicioObraMes: 0,
    duracaoObraMeses: 24,
    inicioVendasMes: 12,
    custoInfraM2Lote: custoParametrizado || 245,
    projetosLicencas: 500_000,
    marketing: 500_000,
    registroPorUnidade: 400,
    contingenciaPctInfra: 10,
    bdiPct: 10,
    taxaAdministracaoObraPct: 10,
    manutencaoPctObra: 1.5,
    inccObraMensal: 0.3,
    permutaPctVgv: 40,
    taxaDescontoAnual: 12,
  };
}

export function defaultsMix(estudo: EstudoData): ItemMixProduto[] {
  // 1) mix vindo do Estudo de Massa (cenário gerador), se existir.
  if (estudo.mixJson) {
    try {
      const mix = JSON.parse(estudo.mixJson) as ItemMixProduto[];
      if (Array.isArray(mix) && mix.length > 0) return mix;
    } catch { /* ignora JSON corrompido */ }
  }
  // 2) preço sugerido pela precificação por comparáveis ponderados (2.2), se existir.
  let precoM2 = 0;
  if (estudo.precificacaoComparaveisJson) {
    try {
      const salvo = JSON.parse(estudo.precificacaoComparaveisJson) as {
        atributos: AtributoComparavel[]; notasNovo: number[]; comparaveis: Comparavel[];
      };
      const r = calcularPrecificacaoPorComparaveis(salvo.atributos, salvo.notasNovo, salvo.comparaveis);
      if (r.precoSugeridoM2 > 0) precoM2 = r.precoSugeridoM2;
    } catch { /* ignora */ }
  }
  // 3) senão, preço sugerido pela pesquisa de Cidade & Mercado (IA), se existir.
  if (!precoM2 && estudo.estudoMercadoJson) {
    try {
      const m = JSON.parse(estudo.estudoMercadoJson) as { precoM2Lote?: number };
      if (m.precoM2Lote) precoM2 = m.precoM2Lote;
    } catch { /* ignora */ }
  }
  return [{ nome: "Lotes", quantidade: 100, areaUnidadeM2: 160, precoM2: precoM2 || 500 }];
}

export function paraMotor(f: PremissasForm, itensMix: ItemMixProduto[], pctAPP: number): PremissasLoteamento {
  const pct = (v: number) => v / 100;
  return {
    areaBrutaM2: f.areaBrutaM2,
    pctAreaPublica: pct(f.pctAreaPublica),
    pctAreaVerde: pct(f.pctAreaVerde),
    pctSistemaViario: pct(f.pctSistemaViario),
    pctAPP,
    pctFaixaServidao: pct(f.pctFaixaServidao),
    itensMix,
    duracaoVendasMeses: f.duracaoVendasMeses,
    perfilVendas: f.perfilVendas,
    entradaPct: pct(f.entradaPct),
    prazoParcelamentoMeses: f.prazoParcelamentoMeses,
    jurosClienteMensal: pct(f.jurosClienteMensal),
    indexacaoMensal: pct(f.indexacaoMensal),
    vendasAVistaPct: pct(f.vendasAVistaPct),
    descontoAVistaPct: pct(f.descontoAVistaPct),
    inadimplenciaPct: pct(f.inadimplenciaPct),
    comissaoPctVgv: pct(f.comissaoPctVgv),
    despesasGeraisPctVgv: pct(f.despesasGeraisPctVgv),
    impostosPctVgv: pct(f.impostosPctVgv),
    taxaIncorporacaoPctVgv: pct(f.taxaIncorporacaoPctVgv),
    inicioObraMes: f.inicioObraMes,
    duracaoObraMeses: f.duracaoObraMeses,
    inicioVendasMes: f.inicioVendasMes,
    custoInfraM2Lote: f.custoInfraM2Lote,
    projetosLicencas: f.projetosLicencas,
    marketing: f.marketing,
    registroPorUnidade: f.registroPorUnidade,
    contingenciaPctInfra: pct(f.contingenciaPctInfra),
    bdiPct: pct(f.bdiPct),
    taxaAdministracaoObraPct: pct(f.taxaAdministracaoObraPct),
    manutencaoPctObra: pct(f.manutencaoPctObra),
    inccObraMensal: pct(f.inccObraMensal),
    permutaPctVgv: pct(f.permutaPctVgv),
    taxaDescontoAnual: pct(f.taxaDescontoAnual),
  };
}

/**
 * Reconstrói as premissas completas do motor a partir do estudo salvo — usada
 * pela aba Viabilidade e pelo Relatório Executivo consolidado para gerar os
 * mesmos indicadores sem duplicar a lógica de conversão de formulário → motor.
 * Retorna null se o estudo ainda não tem premissas de viabilidade salvas.
 */
export function montarPremissasLoteamento(estudo: EstudoData): PremissasLoteamento | null {
  if (!estudo.loteamentoJson) return null;
  let salvo: (Partial<PremissasForm> & { itensMix?: ItemMixProduto[] }) | null = null;
  try {
    salvo = JSON.parse(estudo.loteamentoJson);
  } catch {
    return null;
  }
  if (!salvo) return null;

  const form: PremissasForm = sincronizarUrbanismo(estudo, { ...defaultsForm(estudo), ...salvo });
  const itensMix = form.mixModo === "cenario" ? defaultsMix(estudo) : salvo.itensMix && salvo.itensMix.length > 0 ? salvo.itensMix : defaultsMix(estudo);
  const appAreaM2 = appDaViabilidade(estudo, form);
  const pctAPP = form.areaBrutaM2 > 0 ? appAreaM2 / form.areaBrutaM2 : 0;
  return paraMotor(form, itensMix, pctAPP);
}
