/**
 * Preenche o .xls da CAIXA (a própria PCI enviada pelo cliente) com os dados
 * de uma medição: PLS, Repactuação de Prazo ou Alteração de Projeto.
 *
 * Pedido de 18/10. Só os campos de digitação do modelo são alterados; as
 * fórmulas continuam as originais (o Excel recalcula ao abrir) e os principais
 * resultados também são gravados em cache para quem lê o arquivo sem
 * recalcular.
 */
import type { DadosAlteracao, DadosMedicaoCaixa, DadosPls, DadosRepactuacao, TipoMedicao } from "../medicao-caixa";
import { PastaBiff8 } from "./biff8";
import { substituirFotos, type FotoXls, type QuadroFoto } from "./biff8-imagens";
import { ABA_ALTERACAO, ABA_PLS, ABA_REPACTUACAO, isoParaSerial, type DadosPci } from "./pci";

export interface FotoMedicao extends FotoXls {
  legenda: string | null;
}

export interface MedicaoHistorica {
  /** Data do levantamento (ISO). */
  data: string;
  /** Mensurado acumulado (%). */
  progresso: number;
}

export interface EntradaMedicaoCaixa {
  tipo: TipoMedicao;
  pci: DadosPci;
  /** Execução do Item (%) dos 20 serviços, na ordem da PCI. */
  execucoes: number[];
  /** Mensurado acumulado desta medição (%). */
  progresso: number;
  /** Medições anteriores (PLS), em ordem cronológica. */
  anteriores: MedicaoHistorica[];
  dados: DadosMedicaoCaixa;
  fotos: FotoMedicao[];
}

// ----- datas no padrão do modelo -----

/** DAYS360 (método americano, padrão do Excel). */
export function dias360(inicioIso: string, fimIso: string): number {
  const [a1, m1, d1i] = inicioIso.split("-").map(Number);
  const [a2, m2, d2i] = fimIso.split("-").map(Number);
  const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();
  const fevUltimo = (a: number, m: number, d: number) => m === 2 && d === ultimoDia(a, 2);
  let d1 = d1i;
  let d2 = d2i;
  if (fevUltimo(a1, m1, d1) && fevUltimo(a2, m2, d2)) d2 = 30;
  if (fevUltimo(a1, m1, d1)) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;
  if (d1 === 31) d1 = 30;
  return (a2 - a1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Mesmo dia N meses depois (ajustando fim de mês), como EDATE. */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Início da contagem do prazo: contratação + 30 dias (fórmula do modelo). */
export function inicioDaObra(dataContratacao: string | null): string | null {
  return dataContratacao ? somarDias(dataContratacao, 30) : null;
}

/** Etapa prevista na data da vistoria: INT(DAYS360(início; levantamento)/30). */
export function etapaDaData(inicio: string | null, data: string): number | null {
  if (!inicio) return null;
  const e = Math.floor(dias360(inicio, data) / 30);
  return e < 0 ? 0 : e;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function localEData(municipio: string, iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  const cidade = municipio
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
  return `${cidade ? cidade + " " : ""}${d} de ${MESES[m - 1]} de ${a}`;
}

/** Acumulado medido por etapa (última medição de cada etapa). */
export function acumuladoPorEtapa(inicio: string | null, medicoes: MedicaoHistorica[]): Map<number, number> {
  const mapa = new Map<number, number>();
  for (const m of [...medicoes].sort((x, y) => x.data.localeCompare(y.data))) {
    const e = etapaDaData(inicio, m.data);
    if (e !== null) mapa.set(e, m.progresso);
  }
  return mapa;
}

// ----- quadros de foto de cada modelo (linhas/colunas base zero) -----

const COLUNAS_FOTO: [number, number][] = [[6, 26], [28, 48]];
function quadros(linhas: [number, number][]): QuadroFoto[] {
  return linhas.flatMap(([l1, l2]) => COLUNAS_FOTO.map(([c1, c2]) => ({ coluna1: c1, linha1: l1, coluna2: c2, linha2: l2 })));
}
export const QUADROS: Record<TipoMedicao, { aba: string; quadros: QuadroFoto[] }> = {
  pls: { aba: ABA_PLS, quadros: quadros([[197, 210], [213, 226], [229, 242], [246, 259], [262, 275], [278, 291]]) },
  repactuacao: { aba: ABA_REPACTUACAO, quadros: quadros([[144, 157], [163, 176], [179, 192]]) },
  alteracao: { aba: ABA_ALTERACAO, quadros: quadros([[134, 147], [153, 166], [169, 182]]) },
};

const colunaLetra = (c: number) => {
  let s = "";
  let n = c + 1;
  while (n) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Célula da legenda ("Descrever foto") logo abaixo de cada quadro. */
function celulaLegenda(q: QuadroFoto) {
  return `${colunaLetra(q.coluna1)}${q.linha2 + 2}`;
}

const simNao = (v: boolean, minusculo: boolean) => (v ? (minusculo ? "sim" : "Sim") : minusculo ? "não" : "Não");
const textoOuNulo = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Resultados da PLS calculados aqui (mesmas fórmulas do modelo). */
export function calcularPls(e: EntradaMedicaoCaixa) {
  const inc = e.pci.incidencias;
  const execucaoObra = inc.map((i, k) => (i === 0 ? 0 : (i * (e.execucoes[k] ?? 0)) / 100));
  const acumulado = execucaoObra.reduce((s, v) => s + v, 0);
  const anterior = e.anteriores.length ? e.anteriores[e.anteriores.length - 1].progresso : 0;
  const inicio = inicioDaObra(e.pci.dataContratacao);
  const etapa = etapaDaData(inicio, e.dados.pls.dataLevantamento);
  const prazo = e.dados.pls.houveRepactuacao && e.dados.pls.etapasRepactuadas ? e.dados.pls.etapasRepactuadas : e.pci.prazoMeses;
  const termino = inicio && prazo ? somarMeses(inicio, prazo) : null;
  return { execucaoObra, acumulado, anterior, executadoEtapa: acumulado - anterior, inicio, etapa, prazo, termino };
}

function preencherPls(pasta: PastaBiff8, e: EntradaMedicaoCaixa) {
  const p: DadosPls = e.dados.pls;
  const r = calcularPls(e);
  // Execução do Item (fração) e Execução na Obra em cache.
  e.execucoes.forEach((v, k) => {
    pasta.escrever(ABA_PLS, `V${85 + k}`, v > 0 ? v / 100 : null);
    pasta.gravarResultado(ABA_PLS, `Y${85 + k}`, r.execucaoObra[k]);
  });
  pasta.gravarResultado(ABA_PLS, "Y105", r.acumulado);
  pasta.escrever(ABA_PLS, "Y106", r.anterior);
  pasta.gravarResultado(ABA_PLS, "Y108", r.executadoEtapa);

  pasta.escrever(ABA_PLS, "AL81", isoParaSerial(p.dataLevantamento));
  pasta.escrever(ABA_PLS, "AN82", simNao(p.houveRepactuacao, true));
  pasta.escrever(ABA_PLS, "AV82", p.houveRepactuacao ? p.etapasRepactuadas : null);
  pasta.escrever(ABA_PLS, "AU84", simNao(p.condicoesContratadas, true));
  pasta.escrever(ABA_PLS, "AS85", simNao(p.placaAfixada, true));
  pasta.escrever(ABA_PLS, "AS88", simNao(p.projetoCumprido, true));
  pasta.escrever(ABA_PLS, "AS89", simNao(p.prevencaoDanos, true));
  pasta.escrever(ABA_PLS, "AI87", p.alvaraEmissao ? isoParaSerial(p.alvaraEmissao) : null);
  pasta.escrever(ABA_PLS, "AS87", p.alvaraVigencia ? isoParaSerial(p.alvaraVigencia) : null);
  pasta.escrever(ABA_PLS, "AS170", simNao(p.seloCasaAzul, false));
  pasta.escrever(ABA_PLS, "G113", textoOuNulo(p.observacoes));
  pasta.escrever(ABA_PLS, "H301", localEData(e.pci.identificacao.municipio, p.dataLevantamento));

  // Curva de evolução: acumulado medido em cada etapa (anteriores + esta).
  if (r.etapa !== null) {
    const porEtapa = acumuladoPorEtapa(r.inicio, [...e.anteriores, { data: p.dataLevantamento, progresso: r.acumulado }]);
    for (let etapa = 0; etapa <= 72; etapa++) {
      const celula = `AF${95 + etapa}`;
      if (porEtapa.has(etapa)) pasta.escrever(ABA_PLS, celula, Number(porEtapa.get(etapa)!.toFixed(2)));
      else if (etapa > r.etapa) pasta.escrever(ABA_PLS, celula, null);
    }
  }
}

function preencherRepactuacao(pasta: PastaBiff8, e: EntradaMedicaoCaixa, d: DadosRepactuacao) {
  const A = ABA_REPACTUACAO;
  if (e.pci.dataContratacao) pasta.escrever(A, "L57", isoParaSerial(e.pci.dataContratacao));
  pasta.escrever(A, "X57", d.prazoOriginal);
  pasta.escrever(A, "L59", isoParaSerial(d.dataRepactuacao));
  pasta.escrever(A, "X59", d.prazoProposto);
  const inicio = inicioDaObra(e.pci.dataContratacao);
  const real = acumuladoPorEtapa(inicio, [...e.anteriores, { data: e.dados.pls.dataLevantamento, progresso: calcularPls(e).acumulado }]);
  const etapaRepact = etapaDaData(inicio, d.dataRepactuacao) ?? 0;
  for (let etapa = 0; etapa <= 24; etapa++) {
    const linha = 63 + etapa;
    const previsto = d.previstoOriginal[etapa] ?? e.pci.cronogramaProposto[etapa] ?? null;
    pasta.escrever(A, `O${linha}`, previsto);
    pasta.escrever(A, `S${linha}`, real.has(etapa) && etapa <= etapaRepact ? Number(real.get(etapa)!.toFixed(2)) : null);
    const proposto = d.acumuladoProposto[etapa];
    if (proposto !== null && proposto !== undefined && etapa > etapaRepact) {
      try {
        pasta.escrever(A, `AT${linha}`, proposto, { sobreFormula: true });
      } catch {
        // fórmula compartilhada do modelo: fica a do modelo (repete o real)
      }
    }
  }
  pasta.escrever(A, "G138", textoOuNulo(d.motivo));
  pasta.escrever(A, "H200", localEData(e.pci.identificacao.municipio, d.dataRepactuacao));
}

function preencherAlteracao(pasta: PastaBiff8, e: EntradaMedicaoCaixa, d: DadosAlteracao) {
  const A = ABA_ALTERACAO;
  pasta.escrever(A, "G59", textoOuNulo(d.justificativa));
  pasta.escrever(A, "Q64", textoOuNulo(d.alteraEspecificacoes));
  pasta.escrever(A, "Q72", textoOuNulo(d.alteraArea));
  pasta.escrever(A, "U73", d.alteraArea === "Sim" ? d.novaAreaCoberta : null);
  pasta.escrever(A, "AB73", d.alteraArea === "Sim" ? d.novaAreaPermeavel : null);
  pasta.escrever(A, "AI73", d.alteraArea === "Sim" ? d.novaAreaAcessoria : null);
  pasta.escrever(A, "Q75", textoOuNulo(d.comodos));
  pasta.escrever(A, "AE75", textoOuNulo(d.comodosQuais));
  pasta.escrever(A, "Q79", textoOuNulo(d.servicos));
  pasta.escrever(A, "AE79", textoOuNulo(d.servicosQuais));
  pasta.escrever(A, "V81", textoOuNulo(d.alteraSistema));
  pasta.escrever(A, "P82", textoOuNulo(d.novoSistema));
  pasta.escrever(A, "Q84", textoOuNulo(d.especificacaoSistema));
  pasta.escrever(A, "P85", textoOuNulo(d.montagemParedes));
  pasta.escrever(A, "AB85", textoOuNulo(d.tipoFormas));
  pasta.escrever(A, "AU85", textoOuNulo(d.formasIncorporadas));
  pasta.escrever(A, "R86", textoOuNulo(d.paredesEstruturais));
  pasta.escrever(A, "AT88", d.docComplementar ? d.docComplementar.toLowerCase() : null);

  const adicionais = d.adicionais.slice(0, 4);
  adicionais.forEach((s, k) => {
    pasta.escrever(A, `I${127 + k}`, textoOuNulo(s.descricao));
    pasta.escrever(A, `Z${127 + k}`, s.custo);
  });
  for (let k = adicionais.length; k < 4; k++) {
    pasta.escrever(A, `I${127 + k}`, null);
    pasta.escrever(A, `Z${127 + k}`, null);
  }
  const totalAdicionais = adicionais.reduce((s, a) => s + (a.custo ?? 0), 0);
  const custos = [...d.custos.slice(0, 19).map((c) => c ?? 0), totalAdicionais];
  d.custos.slice(0, 19).forEach((c, k) => pasta.escrever(A, `AB${98 + k}`, c));
  pasta.escrever(A, "X119", d.bdi);
  pasta.escrever(A, "AN118", textoOuNulo(d.executor));

  const r = calcularAlteracao(d);
  custos.forEach((_, k) => {
    pasta.gravarResultado(A, `X${98 + k}`, r.incidencias[k]);
    pasta.gravarResultado(A, `AI${98 + k}`, r.acumulados[k]);
  });
  pasta.gravarResultado(A, "AB117", totalAdicionais);
  pasta.gravarResultado(A, "AB118", r.total);
  pasta.gravarResultado(A, "AB119", r.valorBdi);
  pasta.gravarResultado(A, "AB120", r.totalComBdi);
}

/** Incidências e totais da proposta de alteração (mesmas fórmulas do modelo). */
export function calcularAlteracao(d: DadosAlteracao) {
  const totalAdicionais = d.adicionais.slice(0, 4).reduce((s, a) => s + (a.custo ?? 0), 0);
  const custos = [...d.custos.slice(0, 19).map((c) => c ?? 0), totalAdicionais];
  const total = custos.reduce((s, c) => s + c, 0);
  const incidencias = custos.map((c) => (total > 0 ? (c / total) * 100 : 0));
  let soma = 0;
  const acumulados = incidencias.map((i) => (soma += i));
  const valorBdi = total * ((d.bdi ?? 0) / 100);
  return { custos, total, incidencias, acumulados, valorBdi, totalComBdi: total + valorBdi, totalAdicionais };
}

/** Gera o .xls final a partir do arquivo da PCI do cliente. */
export function gerarXlsMedicao(arquivoPci: Uint8Array, e: EntradaMedicaoCaixa): Uint8Array {
  const pasta = PastaBiff8.abrir(arquivoPci);
  preencherPls(pasta, e);
  if (e.tipo === "repactuacao" && e.dados.repactuacao) preencherRepactuacao(pasta, e, e.dados.repactuacao);
  if (e.tipo === "alteracao" && e.dados.alteracao) preencherAlteracao(pasta, e, e.dados.alteracao);

  const { aba, quadros: q } = QUADROS[e.tipo];
  const fotos = e.fotos.slice(0, q.length);
  substituirFotos(pasta, aba, q, fotos);
  q.forEach((quadro, k) => {
    const legenda = fotos[k] ? fotos[k].legenda?.trim() || "Descrever foto" : "Descrever foto";
    try {
      pasta.escrever(aba, celulaLegenda(quadro), legenda.slice(0, 250));
    } catch {
      // modelo sem a célula de legenda neste quadro: segue sem legenda
    }
  });
  return pasta.salvar();
}
