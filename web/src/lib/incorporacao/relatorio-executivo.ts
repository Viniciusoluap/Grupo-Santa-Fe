// Relatório Executivo de Incorporação (Lote 6 do hardening) — consolida TODOS
// os sub-módulos do estudo (EstudoIncorporacao) em um único modelo de dados,
// sem nenhuma chamada de IA e sem I/O: lê só o que já está salvo no estudo.
//
// Regra central (não negociável): uma seção sem dado NUNCA é omitida — ela
// aparece no modelo como `{ pendencia: "<mensagem legível>" }`, para que a
// renderização do PDF sempre imprima uma linha de pendência explícita em vez
// de simplesmente não mostrar a seção.
//
// Separação arquitetural pedida no Lote 6: esta função é pura e testável
// isoladamente; a geração do PDF (jsPDF/autotable, difícil de testar) fica em
// relatorio-tab.tsx, que só lê o modelo abaixo e desenha.

import {
  calcularLoteamento,
  type FluxoMesLote,
  type PremissasLoteamento,
  type ResultadoLoteamento,
  type ResultadoMix,
} from "@/lib/finance/loteamento";
import { montarPremissasLoteamento } from "./premissas-loteamento";
import { calcularQuadroAreas, type ItemQuadroAreas, type ResultadoQuadroAreas } from "@/lib/urbanismo/quadro-areas";
import {
  resumoNegociacao,
  type DadosNegociacao,
  type ResumoNegociacao,
} from "./negociacao";
import {
  resumoAprovacaoProjeto,
  type ProcessoAprovacao,
  type ResumoAprovacaoProjeto,
} from "./aprovacao-projeto";
import {
  resumoRegistro,
  type DocumentoRegistro,
  type ResumoRegistro,
} from "./registro-incorporacao";
import {
  resumoCronogramaObra,
  type MedicaoMensal,
  type RiscoExecucao,
  type ResumoCronogramaObra,
} from "./cronograma-obra";
import {
  resumoPlanejamentoLancamento,
  type MarcoLancamento,
  type ResumoPlanejamentoLancamento,
} from "./planejamento-lancamento";
import {
  calcularPrecificacaoPorComparaveis,
  type AtributoComparavel,
  type Comparavel,
  type ResultadoPrecificacao,
} from "@/lib/mercado/precificacao";
import {
  resumoPesquisaPrimaria,
  type Entrevistado,
  type ResumoPesquisaPrimaria,
} from "./pesquisa-primaria";
import type { EstudoData } from "@/app/admin/incorporacao/_components/incorporacao-detail";

/** Toda seção do relatório é OU um dado presente, OU uma pendência explícita — nunca omitida. */
export type Secao<T> = { dado: T; pendencia?: undefined } | { dado?: undefined; pendencia: string };

export function temDado<T>(s: Secao<T>): s is { dado: T } {
  return (s as { dado?: T }).dado !== undefined;
}

function okSecao<T>(dado: T): Secao<T> {
  return { dado };
}

function pendenciaSecao<T>(msg: string): Secao<T> {
  return { pendencia: msg };
}

/** Faz JSON.parse defensivo — nunca lança, retorna null em qualquer falha. */
function parseJson<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v == null ? null : (v as T);
  } catch {
    return null;
  }
}

// ─── 1. Terreno / mapas / APP / restrições ──────────────────────────────────

export interface DadoTerreno {
  areaM2: number;
  perimetroM: number;
  centroLat: number | null;
  centroLng: number | null;
  appAreaM2: number | null;
  appLarguraM: number | null;
  appOrigem: string | null;
  appPendencia: string | null; // explícita quando a APP automática ainda não foi calculada
}

function montarTerreno(estudo: EstudoData): Secao<DadoTerreno> {
  const temMapa = !!estudo.geojson && estudo.areaM2 > 0;
  if (!temMapa) {
    return pendenciaSecao(
      "Terreno ainda não delimitado no mapa (KML) nesta aba — área, perímetro e APP automática dependem do desenho do polígono em Terreno."
    );
  }
  return okSecao({
    areaM2: estudo.areaM2,
    perimetroM: estudo.perimetroM,
    centroLat: estudo.centroLat,
    centroLng: estudo.centroLng,
    appAreaM2: estudo.appAreaM2,
    appLarguraM: estudo.appLarguraM,
    appOrigem: estudo.appOrigem,
    appPendencia:
      estudo.appAreaM2 == null
        ? "APP automática ainda não calculada para este terreno (sem retorno do mapa/Overpass nem largura manual definida)."
        : null,
  });
}

// ─── 2. Dados cadastrais / urbanísticos ─────────────────────────────────────

export interface DadoCadastral {
  parametros: Record<string, unknown> | null;
  potencial: Record<string, unknown> | null;
  parecerUrbanistico: string | null;
  matriculaImovel: string | null;
  carRegistro: string | null;
  zoneamentoOficial: string | null;
  zoneamentoFonte: string | null;
  matriculaPendencia: string | null;
  carPendencia: string | null;
  zoneamentoOficialPendencia: string | null;
}

const MATRICULA_PENDENCIA =
  "Matrícula do imóvel não informada: consulte o cartório de registro de imóveis.";
const CAR_PENDENCIA =
  "CAR (Cadastro Ambiental Rural) não informado: verifique a aplicabilidade e consulte o órgão ambiental.";
const ZONEAMENTO_PENDENCIA =
  "Zoneamento oficial não informado com fonte: consulte a prefeitura/plano diretor.";

function montarDadosCadastrais(estudo: EstudoData): Secao<DadoCadastral> {
  const parametros = parseJson<Record<string, unknown>>(estudo.parametrosJson);
  const potencial = parseJson<Record<string, unknown>>(estudo.potencialJson);
  const parecerUrbanistico = estudo.urbanismoParecer ?? null;

  const matriculaImovel = estudo.matriculaImovel?.trim() || null;
  const carRegistro = estudo.carRegistro?.trim() || null;
  const zoneamentoOficial = estudo.zoneamentoOficial?.trim() || null;
  const zoneamentoFonte = estudo.zoneamentoFonte?.trim() || null;
  if (!parametros && !potencial && !parecerUrbanistico && !matriculaImovel && !carRegistro && !zoneamentoOficial) {
    return pendenciaSecao(
      "Parâmetros urbanísticos, potencial construtivo e parecer ainda não cadastrados nesta aba. Além disso: " +
        [MATRICULA_PENDENCIA, CAR_PENDENCIA, ZONEAMENTO_PENDENCIA].join(" ")
    );
  }
  return okSecao({
    parametros,
    potencial,
    parecerUrbanistico,
    matriculaImovel, carRegistro, zoneamentoOficial, zoneamentoFonte,
    matriculaPendencia: matriculaImovel ? null : MATRICULA_PENDENCIA,
    carPendencia: carRegistro ? null : CAR_PENDENCIA,
    zoneamentoOficialPendencia: zoneamentoOficial && zoneamentoFonte ? null : ZONEAMENTO_PENDENCIA,
  });
}

// ─── 3. Mercado / referências ───────────────────────────────────────────────

interface CidadeDados {
  populacao?: number;
  crescimentoAnualPct?: number;
  pibPerCapita?: number;
  rendaMediaMensal?: number;
  deficitHabitacional?: string;
  resumo?: string;
}
interface MercadoDados {
  fontes?: string[];
  confiabilidade?: string;
  precoM2Lote?: number;
  precoM2Casa?: number;
  precoM2Apartamento?: number;
  velocidadeVendas?: string;
  oportunidades?: string;
  riscos?: string;
  demandaPorProduto?: { produto: string; demanda: string; publico: string }[];
  concorrentes?: { nome: string; produto: string; faixaPreco: string }[];
}

export interface DadoMercado {
  cidade: CidadeDados | null;
  mercado: MercadoDados | null;
  precificacaoComparaveis: ResultadoPrecificacao | null;
  pesquisaPrimaria: ResumoPesquisaPrimaria | null;
  fontesPendencia: string | null;
  fontes: string[] | null;
  confiabilidade: string | null;
}

const FONTES_PESQUISA_IA_PENDENCIA =
  "Fontes/confiabilidade da pesquisa de mercado por IA não constam deste estudo. Para estudos anteriores, refaça a pesquisa se precisar desses dados; não é possível reconstruí-los com segurança.";

function montarMercado(estudo: EstudoData): Secao<DadoMercado> {
  const cidade = parseJson<CidadeDados>(estudo.pesquisaCidadeJson);
  const mercado = parseJson<MercadoDados>(estudo.estudoMercadoJson);

  let precificacaoComparaveis: ResultadoPrecificacao | null = null;
  const comp = parseJson<{ atributos: AtributoComparavel[]; notasNovo: number[]; comparaveis: Comparavel[] }>(
    estudo.precificacaoComparaveisJson
  );
  if (comp?.atributos?.length) {
    try {
      precificacaoComparaveis = calcularPrecificacaoPorComparaveis(
        comp.atributos,
        comp.notasNovo ?? [],
        comp.comparaveis ?? []
      );
    } catch {
      precificacaoComparaveis = null;
    }
  }

  let pesquisaPrimaria: ResumoPesquisaPrimaria | null = null;
  const prim = parseJson<{ entrevistados: Entrevistado[] }>(estudo.pesquisaPrimariaJson);
  if (prim?.entrevistados?.length) {
    try {
      pesquisaPrimaria = resumoPesquisaPrimaria(prim.entrevistados);
    } catch {
      pesquisaPrimaria = null;
    }
  }

  if (!cidade && !mercado && !precificacaoComparaveis && !pesquisaPrimaria) {
    return pendenciaSecao(
      "Pesquisa de cidade & mercado, precificação por comparáveis e pesquisa primária ainda não realizadas nesta aba. " +
        FONTES_PESQUISA_IA_PENDENCIA
    );
  }
  const fontes = Array.isArray(mercado?.fontes) ? mercado.fontes.filter((f): f is string => typeof f === "string" && !!f.trim()) : [];
  return okSecao({ cidade, mercado, precificacaoComparaveis, pesquisaPrimaria,
    fontes: fontes.length ? fontes : null,
    confiabilidade: mercado?.confiabilidade || null,
    fontesPendencia: fontes.length ? null : FONTES_PESQUISA_IA_PENDENCIA,
  });
}

// ─── 4. Estudo de massa / cenários ──────────────────────────────────────────

interface CenarioMassaKpis {
  lotesVendaveis: number;
  areaVendavelM2: number;
  aproveitamento: number;
  vgv: number;
}
interface CenarioMassaDados {
  id: string;
  testadaLoteM: number;
  profundidadeLoteM: number;
  larguraViaM: number;
  kpis: CenarioMassaKpis;
}

export interface DadoMassa {
  cenario: CenarioMassaDados;
  totalCenarios: number;
}

function montarMassa(estudo: EstudoData): Secao<DadoMassa> {
  const massa = parseJson<{ cenarios?: CenarioMassaDados[] }>(estudo.massaCenariosJson);
  const cenarios = massa?.cenarios ?? [];
  if (cenarios.length === 0) {
    return pendenciaSecao("Estudo de massa ainda não gerado nesta aba (nenhum cenário calculado).");
  }
  const cenario = cenarios.find((c) => c.id === estudo.cenarioEscolhidoId) ?? cenarios[0];
  return okSecao({ cenario, totalCenarios: cenarios.length });
}

// ─── 5. Quadro de áreas ─────────────────────────────────────────────────────

export interface DadoQuadroAreas {
  itens: ItemQuadroAreas[];
  coeficienteAproveitamento: number;
  resultado: ResultadoQuadroAreas;
}

function montarQuadroAreas(estudo: EstudoData): Secao<DadoQuadroAreas> {
  const salvo = parseJson<{ itens?: ItemQuadroAreas[]; coeficienteAproveitamento?: number }>(estudo.quadroAreasJson);
  const itens = salvo?.itens ?? [];
  if (itens.length === 0) {
    return pendenciaSecao("Quadro de áreas (NBR 12721) ainda não preenchido nesta aba.");
  }
  const coeficienteAproveitamento = salvo?.coeficienteAproveitamento ?? 1;
  const resultado = calcularQuadroAreas(itens, estudo.areaM2, coeficienteAproveitamento);
  return okSecao({ itens, coeficienteAproveitamento, resultado });
}

// ─── Núcleo comum: motor de viabilidade (atual) + fallback legado (EVE) ─────

interface ViabilidadeLegadoResultado {
  vgv: number;
  custoTerreno: number;
  custoTotal: number;
  lucroBruto: number;
  margemLiquida: number;
  vpl: number;
  tir: number | null; // a.m.
  paybackMes: number | null;
  exposicaoMaxima: number;
  fluxo?: {
    mes: number;
    receitas: number;
    custosObra: number;
    custoTerreno: number;
    saldoMes: number;
    saldoAcumulado: number;
  }[];
}

interface ViabilidadeLegado {
  resultado: ViabilidadeLegadoResultado;
}

function montarViabilidade(estudo: EstudoData): {
  premissas: PremissasLoteamento | null;
  r: ResultadoLoteamento | null;
  legado: ViabilidadeLegado | null;
} {
  const premissas = montarPremissasLoteamento(estudo);
  const r = premissas ? calcularLoteamento(premissas) : null;
  const legado = !premissas ? parseJson<ViabilidadeLegado>(estudo.viabilidadeJson) : null;
  return { premissas, r, legado };
}

// ─── 6. Mix de produtos ─────────────────────────────────────────────────────

export interface DadoMixProdutos {
  mix: ResultadoMix;
}

function montarMixProdutos(r: ResultadoLoteamento | null): Secao<DadoMixProdutos> {
  if (!r) {
    return pendenciaSecao(
      "Mix de produtos depende do motor de viabilidade (aba Viabilidade), ainda não configurado para este estudo."
    );
  }
  return okSecao({ mix: r.mix });
}

// ─── 7. Custos / receitas / VGV ─────────────────────────────────────────────

export type DadoCustosReceitasVgv =
  | {
      modo: "motor_atual";
      vgvGross: number;
      vgvNet: number;
      custoInfra: number;
      custosPreVenda: number;
      custosDuranteVenda: number;
      custoTotal: number;
      custoTotalNominal: number;
      custosDetalhados: { taxaAdministracaoObra: number; manutencao: number; taxaIncorporacao: number };
    }
  | {
      modo: "legado";
      vgv: number;
      custoTerreno: number;
      custoTotal: number;
      lucroBruto: number;
    };

function montarCustosReceitasVgv(
  r: ResultadoLoteamento | null,
  legado: ViabilidadeLegado | null
): Secao<DadoCustosReceitasVgv> {
  if (r) {
    return okSecao({
      modo: "motor_atual",
      vgvGross: r.vgvGross,
      vgvNet: r.vgvNet,
      custoInfra: r.custoInfra,
      custosPreVenda: r.custosPreVenda,
      custosDuranteVenda: r.custosDuranteVenda,
      custoTotal: r.custoTotal,
      custoTotalNominal: r.custoTotalNominal,
      custosDetalhados: r.custosDetalhados,
    });
  }
  if (legado?.resultado) {
    return okSecao({
      modo: "legado",
      vgv: legado.resultado.vgv,
      custoTerreno: legado.resultado.custoTerreno,
      custoTotal: legado.resultado.custoTotal,
      lucroBruto: legado.resultado.lucroBruto,
    });
  }
  return pendenciaSecao(
    "Custos, receitas e VGV dependem da aba Viabilidade (motor determinístico atual ou estudo legado), ainda não configurados."
  );
}

// ─── 8. VPL / TIR / ROI / payback / fluxo de caixa ──────────────────────────

export interface FluxoCaixaLinha {
  mes: number;
  receitaBruta: number;
  custoTotalMes: number;
  saldoMes: number;
  saldoAcumulado: number;
}

export type DadoIndicadoresFinanceiros =
  | {
      modo: "motor_atual";
      vpl: number;
      tirAnual: number | null;
      roi: number;
      margemLiquida: number;
      paybackMes: number | null;
      exposicaoMaxima: number;
      fluxo: FluxoCaixaLinha[];
    }
  | {
      modo: "legado";
      vpl: number;
      tirMensal: number | null;
      margemLiquida: number;
      paybackMes: number | null;
      exposicaoMaxima: number;
      fluxo: FluxoCaixaLinha[];
    };

function fluxoAtualParaLinhas(fluxo: FluxoMesLote[]): FluxoCaixaLinha[] {
  return fluxo.map((f) => ({
    mes: f.mes,
    receitaBruta: f.receitaBruta,
    custoTotalMes: f.custoPreVenda + f.custoDuranteVenda,
    saldoMes: f.saldoMes,
    saldoAcumulado: f.saldoAcumulado,
  }));
}

function montarIndicadoresFinanceiros(
  r: ResultadoLoteamento | null,
  legado: ViabilidadeLegado | null
): Secao<DadoIndicadoresFinanceiros> {
  if (r) {
    return okSecao({
      modo: "motor_atual",
      vpl: r.vpl,
      tirAnual: r.tirAnual,
      roi: r.roi,
      margemLiquida: r.margemLiquida,
      paybackMes: r.paybackMes,
      exposicaoMaxima: r.exposicaoMaxima,
      fluxo: fluxoAtualParaLinhas(r.fluxo),
    });
  }
  if (legado?.resultado) {
    const fluxo = (legado.resultado.fluxo ?? []).map((f) => ({
      mes: f.mes,
      receitaBruta: f.receitas,
      custoTotalMes: f.custosObra + f.custoTerreno,
      saldoMes: f.saldoMes,
      saldoAcumulado: f.saldoAcumulado,
    }));
    return okSecao({
      modo: "legado",
      vpl: legado.resultado.vpl,
      tirMensal: legado.resultado.tir,
      margemLiquida: legado.resultado.margemLiquida,
      paybackMes: legado.resultado.paybackMes,
      exposicaoMaxima: legado.resultado.exposicaoMaxima,
      fluxo,
    });
  }
  return pendenciaSecao(
    "VPL, TIR, ROI, payback e fluxo de caixa dependem da aba Viabilidade (motor determinístico atual ou estudo legado), ainda não configurados."
  );
}

// ─── 9. Impostos / comissões / permutas ─────────────────────────────────────

export interface DadoImpostosComissoesPermutas {
  comissaoPct: number;
  despesasGeraisPct: number;
  impostosPct: number;
  permutaPct: number;
  comissaoValor: number;
  despesasGeraisValor: number;
  impostosValor: number;
  permutaValorTerreneiro: number;
  observacao: string;
}

const OBS_IMPOSTOS =
  "Estimativa baseada nas premissas de viabilidade (aba Viabilidade) — não é um controle de pagamentos real, apenas a projeção do motor determinístico.";

function montarImpostosComissoesPermutas(
  premissas: PremissasLoteamento | null,
  r: ResultadoLoteamento | null
): Secao<DadoImpostosComissoesPermutas> {
  if (!premissas || !r) {
    return pendenciaSecao(
      "Impostos, comissões e permuta dependem das premissas do motor de viabilidade atual (aba Viabilidade), ainda não configuradas. " +
        "Estudos no formato legado (EVE) não têm esses percentuais extraídos neste relatório."
    );
  }
  return okSecao({
    comissaoPct: premissas.comissaoPctVgv,
    despesasGeraisPct: premissas.despesasGeraisPctVgv,
    impostosPct: premissas.impostosPctVgv,
    permutaPct: premissas.permutaPctVgv,
    comissaoValor: r.vgvGross * premissas.comissaoPctVgv,
    despesasGeraisValor: r.vgvGross * premissas.despesasGeraisPctVgv,
    impostosValor: r.vgvGross * premissas.impostosPctVgv,
    permutaValorTerreneiro: r.recebiveis.terreneiro,
    observacao: OBS_IMPOSTOS,
  });
}

// ─── 10. Negociações / proposta aceita ──────────────────────────────────────

export interface DadoNegociacao {
  resumo: ResumoNegociacao;
  proprietarioNome: string;
}

function montarNegociacao(estudo: EstudoData, vgvReferencia: number): Secao<DadoNegociacao> {
  const dados = parseJson<DadosNegociacao>(estudo.negociacaoTerrenoJson);
  if (!dados || !Array.isArray(dados.propostas) || dados.propostas.length === 0) {
    return pendenciaSecao("Negociação do terreno ainda não registrada nesta aba (nenhuma proposta cadastrada).");
  }
  const resumo = resumoNegociacao(dados, vgvReferencia);
  return okSecao({ resumo, proprietarioNome: dados.proprietarioNome ?? "—" });
}

// ─── 11. Documentos / licenças / pendências ─────────────────────────────────

export interface DadoDocumentosLicencas {
  aprovacaoProjeto: ResumoAprovacaoProjeto | null;
  registroIncorporacao: ResumoRegistro | null;
}

function montarDocumentosLicencas(estudo: EstudoData): Secao<DadoDocumentosLicencas> {
  const aprovacao = parseJson<{ processos?: ProcessoAprovacao[] }>(estudo.aprovacaoProjetoJson);
  const registro = parseJson<{ documentos?: DocumentoRegistro[] }>(estudo.registroIncorporacaoJson);
  const processos = aprovacao?.processos ?? [];
  const documentos = registro?.documentos ?? [];

  if (processos.length === 0 && documentos.length === 0) {
    return pendenciaSecao(
      "Aprovação do projeto (licenças/órgãos) e registro da incorporação (documentos do art. 32) ainda não cadastrados nestas abas."
    );
  }
  return okSecao({
    aprovacaoProjeto: processos.length > 0 ? resumoAprovacaoProjeto(processos) : null,
    registroIncorporacao: documentos.length > 0 ? resumoRegistro(documentos) : null,
  });
}

// ─── 12. Cronograma / tarefas / responsáveis / riscos ───────────────────────

export interface DadoCronograma {
  cronogramaObra: ResumoCronogramaObra | null;
  planejamentoLancamento: ResumoPlanejamentoLancamento | null;
  responsavelDoEstudo: string | null;
  responsaveisPorTarefa: { tarefa: string; responsavel: string }[];
  riscosExecucao: { descricao: string; impacto: string; mitigacao: string; responsavel: string; status: string }[];
  responsavelPorTarefaPendencia: string | null;
  riscosExecucaoPendencia: string | null;
}

const RESPONSAVEL_POR_TAREFA_PENDENCIA =
  "Há marcos ou medições sem responsável individual atribuído.";
const RISCOS_EXECUCAO_PENDENCIA =
  "Nenhum risco de execução foi registrado no cronograma. Verifique e registre os riscos ou documente a ausência após análise.";

function montarCronograma(estudo: EstudoData): Secao<DadoCronograma> {
  const obra = parseJson<{ medicoes?: MedicaoMensal[]; riscos?: RiscoExecucao[] }>(estudo.cronogramaObraJson);
  const lancamento = parseJson<{ marcos?: MarcoLancamento[] }>(estudo.planejamentoLancamentoJson);
  const medicoes = obra?.medicoes ?? [];
  const marcos = lancamento?.marcos ?? [];
  const usuarios = new Map((estudo.colaboradores ?? []).map((u) => [u.id, u.nome]));
  const tarefas = [
    ...medicoes.map((m) => ({ tarefa: `Medição do mês ${m.mes + 1}`, responsavelId: m.responsavelId })),
    ...marcos.map((m) => ({ tarefa: m.nome, responsavelId: m.responsavelId })),
  ];
  const responsaveisPorTarefa = tarefas.filter((t) => t.responsavelId && usuarios.has(t.responsavelId))
    .map((t) => ({ tarefa: t.tarefa, responsavel: usuarios.get(t.responsavelId!)! }));
  const riscosExecucao = (obra?.riscos ?? []).map((r) => ({ descricao: r.descricao, impacto: r.impacto,
    mitigacao: r.mitigacao, responsavel: usuarios.get(r.responsavelId ?? "") ?? "Não atribuído", status: r.status }));

  if (medicoes.length === 0 && marcos.length === 0) {
    return pendenciaSecao(
      "Cronograma de obra (curva S) e planejamento do lançamento (marcos) ainda não cadastrados nestas abas. " +
        `${RESPONSAVEL_POR_TAREFA_PENDENCIA} ${RISCOS_EXECUCAO_PENDENCIA}`
    );
  }

  const premissas = montarPremissasLoteamento(estudo);
  return okSecao({
    cronogramaObra: medicoes.length > 0 ? resumoCronogramaObra(medicoes, premissas?.duracaoObraMeses) : null,
    planejamentoLancamento: marcos.length > 0 ? resumoPlanejamentoLancamento(marcos) : null,
    responsavelDoEstudo: estudo.responsavel ?? null,
    responsaveisPorTarefa, riscosExecucao,
    responsavelPorTarefaPendencia: responsaveisPorTarefa.length === tarefas.length ? null : RESPONSAVEL_POR_TAREFA_PENDENCIA,
    riscosExecucaoPendencia: riscosExecucao.length ? null : RISCOS_EXECUCAO_PENDENCIA,
  });
}

// ─── 13. Premissas / fontes / data / versão ─────────────────────────────────

export interface PremissaNumerica {
  label: string;
  valor: string;
}

export interface DadoPremissasFontesVersao {
  geradoEm: string; // timestamp ISO real, no momento da geração do PDF
  premissasNumericas: Secao<PremissaNumerica[]>;
  versao: Secao<string>;
  fontesPesquisaMercado: Secao<string>;
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function montarPremissasFontesVersao(
  premissas: PremissasLoteamento | null,
  geradoEm: Date,
  estudo: EstudoData
): DadoPremissasFontesVersao {
  const mercado = parseJson<MercadoDados>(estudo.estudoMercadoJson);
  const fontes = Array.isArray(mercado?.fontes) ? mercado.fontes.filter((f): f is string => typeof f === "string" && !!f.trim()) : [];
  const premissasNumericas: Secao<PremissaNumerica[]> = premissas
    ? okSecao([
        { label: "Comissão sobre VGV", valor: formatPct(premissas.comissaoPctVgv) },
        { label: "Despesas gerais sobre VGV", valor: formatPct(premissas.despesasGeraisPctVgv) },
        { label: "Impostos sobre VGV", valor: formatPct(premissas.impostosPctVgv) },
        { label: "Permuta do terreneiro sobre VGV", valor: formatPct(premissas.permutaPctVgv) },
        { label: "Área pública (urbanístico)", valor: formatPct(premissas.pctAreaPublica) },
        { label: "Área verde (urbanístico)", valor: formatPct(premissas.pctAreaVerde) },
        { label: "Sistema viário (urbanístico)", valor: formatPct(premissas.pctSistemaViario) },
        { label: "APP (automática, do mapa)", valor: formatPct(premissas.pctAPP) },
        { label: "Faixa de servidão (urbanístico)", valor: formatPct(premissas.pctFaixaServidao) },
        { label: "Taxa de desconto (VPL/TMA) a.a.", valor: formatPct(premissas.taxaDescontoAnual) },
      ])
    : pendenciaSecao(
        "Premissas numéricas de viabilidade (impostos, comissão, permuta, parâmetros urbanísticos, taxa de desconto) ainda não configuradas na aba Viabilidade."
      );

  return {
    geradoEm: geradoEm.toISOString(),
    premissasNumericas,
    versao: estudo.versaoNumero ? okSecao(`Versão ${estudo.versaoNumero} (retrato salvo no histórico)`) : pendenciaSecao(
      "Histórico de versões indisponível para este estudo. Este PDF reflete o estado atual no momento da geração."
    ),
    fontesPesquisaMercado: fontes.length ? okSecao(fontes.join("; ")) : pendenciaSecao(FONTES_PESQUISA_IA_PENDENCIA),
  };
}

// ─── Modelo consolidado ──────────────────────────────────────────────────────

export interface RelatorioExecutivoModel {
  nome: string;
  municipio: string;
  estado: string;
  terreno: Secao<DadoTerreno>;
  dadosCadastrais: Secao<DadoCadastral>;
  mercado: Secao<DadoMercado>;
  massa: Secao<DadoMassa>;
  quadroAreas: Secao<DadoQuadroAreas>;
  mixProdutos: Secao<DadoMixProdutos>;
  custosReceitasVgv: Secao<DadoCustosReceitasVgv>;
  indicadoresFinanceiros: Secao<DadoIndicadoresFinanceiros>;
  impostosComissoesPermutas: Secao<DadoImpostosComissoesPermutas>;
  negociacao: Secao<DadoNegociacao>;
  documentosLicencas: Secao<DadoDocumentosLicencas>;
  cronograma: Secao<DadoCronograma>;
  premissasFontesVersao: DadoPremissasFontesVersao;
  parecerIa: Secao<string>;
}

/**
 * Monta o modelo consolidado do Relatório Executivo de Incorporação a partir
 * de um único estudo (EstudoIncorporacao) — função pura, sem I/O, sem React,
 * testável isoladamente. Nunca lança excessão: qualquer dado ausente ou JSON
 * corrompido se transforma em `{ pendencia: "..." }` na seção correspondente.
 */
export function montarRelatorioExecutivo(
  estudo: EstudoData,
  geradoEm: Date = new Date()
): RelatorioExecutivoModel {
  const { premissas, r, legado } = montarViabilidade(estudo);
  const vgvReferencia = r?.vgvGross ?? legado?.resultado?.vgv ?? 0;

  return {
    nome: estudo.nome,
    municipio: estudo.municipio,
    estado: estudo.estado,
    terreno: montarTerreno(estudo),
    dadosCadastrais: montarDadosCadastrais(estudo),
    mercado: montarMercado(estudo),
    massa: montarMassa(estudo),
    quadroAreas: montarQuadroAreas(estudo),
    mixProdutos: montarMixProdutos(r),
    custosReceitasVgv: montarCustosReceitasVgv(r, legado),
    indicadoresFinanceiros: montarIndicadoresFinanceiros(r, legado),
    impostosComissoesPermutas: montarImpostosComissoesPermutas(premissas, r),
    negociacao: montarNegociacao(estudo, vgvReferencia),
    documentosLicencas: montarDocumentosLicencas(estudo),
    cronograma: montarCronograma(estudo),
    premissasFontesVersao: montarPremissasFontesVersao(premissas, geradoEm, estudo),
    parecerIa: estudo.parecerIa
      ? okSecao(estudo.parecerIa)
      : pendenciaSecao("Parecer de viabilidade por IA ainda não gerado para este estudo."),
  };
}
