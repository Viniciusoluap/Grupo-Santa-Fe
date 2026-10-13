// EPIC-020 Lote 4 (item 29) — conteúdo do relatório executivo da obra.
// Mesmo arquivo em Prospecta/shared/relatorio-obra.ts (só os imports mudam).
//
// Função pura: recebe os dados reais da obra (os mesmos das telas, calculados
// pelo motor único) e devolve as seções, tabelas e gráficos do PDF. Nunca
// inventa valor: ausente vira "Não informado" e indicador não calculável
// mostra o motivo. O desenho do PDF fica em cada sistema (jsPDF).

import type { Indicador, ResultadoObra } from "../financeiro/obra";
import type { ComissaoObraCalculada } from "../financeiro/comissao";
import { formatarPercentual, type ResultadoProgresso } from "../financeiro/progresso";

export interface MovimentoRelatorio {
  data: string;
  natureza: "entrada" | "recebimento_cef" | "pagamento";
  categoria: string | null;
  descricao: string;
  valor: string;
  status: "confirmado" | "cancelado";
  origem: string;
}

export interface DadosRelatorioObra {
  empresa: string;
  geradoEm: Date;
  info: {
    titulo: string;
    tipo: string | null;
    cliente: string | null;
    corretor: string | null;
    endereco: string | null;
    area: number | string | null;
    status: string;
    escritorioCef: string | null;
    dataInicio: string | Date | null;
    previsaoTermino: string | Date | null;
    terminoReal: string | Date | null;
    observacoes: string | null;
    /** Só existe no cadastro do Santa Fé; omitido quando o sistema não tem o campo. */
    engenheiro?: string | null;
    telefoneCliente?: string | null;
    emailCliente?: string | null;
  };
  valores: {
    vgv: string | null;
    financiamento: string | null;
    fgts: string | null;
    subsidio: string | null;
    custoTerreno: string | null;
    comissao: string | null;
    orcamentoPrevisto: string | null;
    taxaMensalPct: string | null;
    parcelas: number | null;
    percentualEmpreiteiro: string | null;
  };
  calculo: ResultadoObra;
  empreiteiro: string | null;
  investidores: { nome: string; percentual: string | number; lucro: Indicador | undefined }[];
  comissao: ComissaoObraCalculada | null;
  movimentos: MovimentoRelatorio[];
  progresso: ResultadoProgresso;
  fotos: { legenda: string | null; data: string | Date }[];
}

export interface CampoRelatorio { rotulo: string; valor: string }
export interface TabelaRelatorio { titulo: string; colunas: string[]; linhas: string[][]; vazio: string }
export interface GraficoRelatorio { titulo: string; itens: { rotulo: string; valor: number; texto: string }[]; unidade: "moeda" | "percentual" }
export interface SecaoRelatorio { id: string; titulo: string; campos: CampoRelatorio[]; tabelas: TabelaRelatorio[]; graficos: GraficoRelatorio[] }
export interface RelatorioObra { titulo: string; subtitulo: string; secoes: SecaoRelatorio[] }

/** Rótulos que o relatório SEMPRE precisa ter (o teste de completude falha se faltar algum). */
export const CAMPOS_OBRIGATORIOS: Record<string, string[]> = {
  info: ["Obra", "Tipo de projeto", "Cliente", "Telefone do cliente", "E-mail do cliente", "Corretor", "Endereço", "Área total", "Status", "Escritório CEF", "Data de início", "Previsão de término", "Término real", "Observações"],
  operacao: [
    "VGV", "Financiamento CEF", "FGTS", "Subsídio", "Entrada total", "Entrada paga", "Saldo de entrada", "Recebido da CEF",
    "A receber do banco", "Pró-soluto", "Taxa mensal", "Quantidade de parcelas", "Valor da parcela", "Dias de obra",
    "PLS Real", "Custo de construção", "Gasto realizado na obra", "Lucro estimado", "Lucro dos investidores",
    "Lucro do empreiteiro", "Lucro da empresa",
  ],
  custos: ["Orçamento previsto", "Empreiteiro", "Percentual do empreiteiro", "Custo do terreno", "Comissão", "Percentual de comissão", "Situação da comissão", "Corretor", "Total gasto", "Saldo restante"],
  progresso: ["Progresso geral", "Soma das incidências", "Distribuição"],
  fotos: ["Fotos no relatório"],
};

const NAO_INFORMADO = "Não informado";

export function moeda(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function moedaTexto(v: string | null): string {
  if (v === null || v === undefined || v === "") return NAO_INFORMADO;
  const n = Number(v);
  return Number.isFinite(n) ? moeda(Math.round(n * 100)) : NAO_INFORMADO;
}
function ind(i: Indicador | undefined): string {
  if (!i) return "Não calculado";
  return i.ok ? moeda(i.centavos) : `Não calculado — ${i.motivo}`;
}
function texto(v: string | number | null | undefined): string {
  return v === null || v === undefined || String(v).trim() === "" ? NAO_INFORMADO : String(v);
}
export function dataBR(v: string | Date | null | undefined): string {
  if (!v) return NAO_INFORMADO;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, d] = v.split("-");
    return `${d}/${m}/${a}`;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? NAO_INFORMADO : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function pct(v: string | number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || v === "") return NAO_INFORMADO;
  const n = Number(v);
  return Number.isFinite(n) ? formatarPercentual(n, casas) : NAO_INFORMADO;
}

const CATEGORIAS: Record<string, string> = {
  terreno: "Terreno", comissao: "Comissão", empreiteiro: "Empreiteiro", fornecedor: "Fornecedor", outros: "Outros", nao_detalhado: "Não detalhado", mao_de_obra: "Mão de obra", material: "Material",
};
const ORIGENS: Record<string, string> = { manual: "Manual", bpo: "BPO", migracao: "Migração" };
const STATUS_COMISSAO: Record<string, string> = { dados_incompletos: "Dados incompletos", pendente: "Pendente", parcial: "Paga parcialmente", paga: "Paga" };

function tabelaMovimentos(titulo: string, movs: MovimentoRelatorio[], comCategoria: boolean): TabelaRelatorio {
  const colunas = comCategoria ? ["Data", "Categoria", "Descrição", "Valor", "Origem", "Situação"] : ["Data", "Descrição", "Valor", "Origem", "Situação"];
  return {
    titulo,
    colunas,
    vazio: "Nenhum lançamento registrado.",
    linhas: movs.map((m) => {
      const base = [dataBR(m.data), m.descricao, moedaTexto(m.valor), ORIGENS[m.origem] ?? m.origem, m.status === "cancelado" ? "Cancelado" : "Confirmado"];
      if (comCategoria) base.splice(1, 0, m.categoria ? CATEGORIAS[m.categoria] ?? m.categoria : "—");
      return base;
    }),
  };
}

function grafico(titulo: string, itens: { rotulo: string; centavos: Indicador }[]): GraficoRelatorio | null {
  const validos = itens.filter((i): i is { rotulo: string; centavos: { ok: true; centavos: number } } => i.centavos.ok);
  if (validos.length < 2 || validos.every((i) => i.centavos.centavos === 0)) return null;
  return { titulo, unidade: "moeda", itens: validos.map((i) => ({ rotulo: i.rotulo, valor: i.centavos.centavos / 100, texto: moeda(i.centavos.centavos) })) };
}

/**
 * Progresso que o relatório mostra: o medido por serviço ou, enquanto a obra não
 * tiver medição salva, o valor antigo digitado à mão (nunca 0% inventado).
 */
export function progressoParaRelatorio(calculo: ResultadoProgresso, medido: boolean, legado: number): ResultadoProgresso {
  if (medido || !(legado > 0)) return calculo;
  return {
    ...calculo,
    progresso: legado,
    avisos: [...calculo.avisos, `Progresso de ${formatarPercentual(legado)} informado manualmente antes da medição por serviço (tabela abaixo ainda sem medição).`],
  };
}

export function montarRelatorioObra(d: DadosRelatorioObra): RelatorioObra {
  const c = d.calculo;
  const i = d.info;
  const info: CampoRelatorio[] = [
    { rotulo: "Obra", valor: texto(i.titulo) },
    { rotulo: "Tipo de projeto", valor: texto(i.tipo) },
    { rotulo: "Cliente", valor: texto(i.cliente) },
    { rotulo: "Telefone do cliente", valor: texto(i.telefoneCliente) },
    { rotulo: "E-mail do cliente", valor: texto(i.emailCliente) },
    { rotulo: "Corretor", valor: texto(i.corretor) },
    { rotulo: "Endereço", valor: texto(i.endereco) },
    { rotulo: "Área total", valor: i.area === null || i.area === undefined || i.area === "" ? NAO_INFORMADO : `${Number(i.area).toLocaleString("pt-BR")} m²` },
    { rotulo: "Status", valor: texto(i.status) },
    { rotulo: "Escritório CEF", valor: texto(i.escritorioCef) },
    { rotulo: "Data de início", valor: dataBR(i.dataInicio) },
    { rotulo: "Previsão de término", valor: dataBR(i.previsaoTermino) },
    { rotulo: "Término real", valor: i.terminoReal ? dataBR(i.terminoReal) : "Em andamento" },
    ...(i.engenheiro !== undefined ? [{ rotulo: "Engenheiro responsável", valor: texto(i.engenheiro) }] : []),
    { rotulo: "Observações", valor: texto(i.observacoes) },
  ];

  const v = d.valores;
  const entradas = d.movimentos.filter((m) => m.natureza === "entrada");
  const recebimentos = d.movimentos.filter((m) => m.natureza === "recebimento_cef");
  const pagamentos = d.movimentos.filter((m) => m.natureza === "pagamento");
  const operacao: SecaoRelatorio = {
    id: "operacao",
    titulo: "Valores da Operação",
    campos: [
      { rotulo: "VGV", valor: moedaTexto(v.vgv) },
      { rotulo: "Financiamento CEF", valor: moedaTexto(v.financiamento) },
      { rotulo: "FGTS", valor: moedaTexto(v.fgts) },
      { rotulo: "Subsídio", valor: moedaTexto(v.subsidio) },
      { rotulo: "Entrada total", valor: ind(c.entradaTotal) },
      { rotulo: "Entrada paga", valor: ind(c.entradaPaga) },
      { rotulo: "Saldo de entrada", valor: ind(c.saldoEntrada) },
      { rotulo: "Recebido da CEF", valor: ind(c.recebidoCef) },
      { rotulo: "A receber do banco", valor: ind(c.receberBanco) },
      { rotulo: "Pró-soluto", valor: ind(c.proSoluto) },
      { rotulo: "Taxa mensal", valor: v.taxaMensalPct === null ? NAO_INFORMADO : pct(v.taxaMensalPct, 4) },
      { rotulo: "Quantidade de parcelas", valor: v.parcelas === null ? NAO_INFORMADO : String(v.parcelas) },
      { rotulo: "Valor da parcela", valor: ind(c.valorParcela) },
      { rotulo: "Dias de obra", valor: c.diasObra.ok ? `${c.diasObra.dias} dias` : `Não calculado — ${c.diasObra.motivo}` },
      { rotulo: "Base do PLS", valor: ind(c.basePls) },
      { rotulo: "PLS Real", valor: c.plsReal.ok ? formatarPercentual(c.plsReal.percentual) : `Não calculado — ${c.plsReal.motivo}` },
      { rotulo: "Custo de construção", valor: ind(c.custoConstrucao) },
      { rotulo: "Gasto realizado na obra", valor: ind(c.gastoObraRealizado) },
      { rotulo: "Lucro estimado", valor: ind(c.lucroEstimado) },
      { rotulo: "Lucro dos investidores", valor: ind(c.lucroInvestidores) },
      { rotulo: "Lucro do empreiteiro", valor: `${ind(c.lucroEmpreiteiro)}${d.empreiteiro && v.percentualEmpreiteiro ? ` (${pct(v.percentualEmpreiteiro, 4)})` : ""}` },
      { rotulo: "Lucro da empresa", valor: ind(c.lucroEmpresa) },
    ],
    tabelas: [
      {
        titulo: "Investidores",
        colunas: ["Investidor", "Participação", "Lucro"],
        vazio: "Nenhum investidor vinculado.",
        linhas: d.investidores.map((inv) => [inv.nome, pct(inv.percentual, 4), ind(inv.lucro)]),
      },
      tabelaMovimentos("Histórico de entradas", entradas, false),
      tabelaMovimentos("Histórico de recebimentos da CEF", recebimentos, false),
    ],
    graficos: [
      grafico("Recebimentos", [
        { rotulo: "Entrada paga", centavos: c.entradaPaga },
        { rotulo: "Recebido da CEF", centavos: c.recebidoCef },
        { rotulo: "A receber do banco", centavos: c.receberBanco },
      ]),
      grafico("Saldos", [
        { rotulo: "Saldo de entrada", centavos: c.saldoEntrada },
        { rotulo: "Saldo restante", centavos: c.saldoRestante },
      ]),
      grafico("Distribuição dos lucros", [
        { rotulo: "Investidores", centavos: c.lucroInvestidores },
        { rotulo: "Empreiteiro", centavos: c.lucroEmpreiteiro },
        { rotulo: d.empresa, centavos: c.lucroEmpresa },
      ]),
      c.plsReal.ok && d.progresso.progresso >= 0
        ? {
            titulo: "PLS Real × Progresso físico",
            unidade: "percentual" as const,
            itens: [
              { rotulo: "PLS Real", valor: c.plsReal.percentual, texto: formatarPercentual(c.plsReal.percentual) },
              { rotulo: "Progresso físico", valor: d.progresso.progresso, texto: formatarPercentual(d.progresso.progresso) },
            ],
          }
        : null,
    ].filter((g): g is GraficoRelatorio => g !== null),
  };

  const com = d.comissao;
  const custos: SecaoRelatorio = {
    id: "custos",
    titulo: "Custos",
    campos: [
      { rotulo: "Orçamento previsto", valor: moedaTexto(v.orcamentoPrevisto) },
      { rotulo: "Empreiteiro", valor: texto(d.empreiteiro) },
      { rotulo: "Percentual do empreiteiro", valor: d.empreiteiro ? pct(v.percentualEmpreiteiro, 4) : "Sem empreiteiro" },
      { rotulo: "Custo do terreno", valor: moedaTexto(v.custoTerreno) },
      { rotulo: "Comissão", valor: com && com.elegivel ? (com.valorCentavos === null ? `Não calculado — ${com.pendencias.join("; ")}` : moeda(com.valorCentavos)) : moedaTexto(v.comissao) },
      { rotulo: "Percentual de comissão", valor: com && com.elegivel ? (com.percentual ? `${pct(com.percentual, 4)} (${com.fontePercentual === "obra" ? "da obra" : "padrão do corretor"})` : NAO_INFORMADO) : "Comissão manual (obra sem corretor)" },
      { rotulo: "Situação da comissão", valor: com && com.elegivel ? STATUS_COMISSAO[com.status] : "Não se aplica" },
      { rotulo: "Corretor", valor: texto(i.corretor) },
      { rotulo: "Total gasto", valor: ind(c.totalGasto) },
      { rotulo: "Saldo restante", valor: ind(c.saldoRestante) },
    ],
    tabelas: [tabelaMovimentos("Histórico de pagamentos", pagamentos, true)],
    graficos: [
      grafico("Orçamento × Gasto realizado", [
        { rotulo: "Orçamento previsto", centavos: c.custoConstrucao },
        { rotulo: "Gasto realizado", centavos: c.gastoObraRealizado },
      ]),
    ].filter((g): g is GraficoRelatorio => g !== null),
  };

  const p = d.progresso;
  const progresso: SecaoRelatorio = {
    id: "progresso",
    titulo: "Progresso da Obra",
    campos: [
      { rotulo: "Progresso geral", valor: formatarPercentual(p.progresso) },
      { rotulo: "Soma das incidências", valor: formatarPercentual(p.somaIncidencia) },
      { rotulo: "Distribuição", valor: p.distribuicaoCompleta ? "Completa (100%)" : p.avisos.join(" ") || "Incompleta" },
    ],
    tabelas: [{
      titulo: "Medição por serviço",
      colunas: ["Serviço", "Incidência", "Execução do item", "Execução na obra"],
      vazio: "",
      linhas: p.itens.map((it) => [it.nome, formatarPercentual(it.incidencia), formatarPercentual(it.execucao), formatarPercentual(it.execucaoObra, 4)]),
    }],
    graficos: p.progresso > 0
      ? [{
          titulo: "Execução na obra por serviço",
          unidade: "percentual",
          itens: p.itens.filter((it) => it.execucaoObra > 0).map((it) => ({ rotulo: it.nome, valor: it.execucaoObra, texto: formatarPercentual(it.execucaoObra) })),
        }]
      : [],
  };

  const fotos: SecaoRelatorio = {
    id: "fotos",
    titulo: "Fotos da Obra",
    campos: [{ rotulo: "Fotos no relatório", valor: d.fotos.length ? String(d.fotos.length) : "Nenhuma foto marcada para o relatório" }],
    tabelas: [],
    graficos: [],
  };

  return {
    titulo: "Relatório Executivo da Obra",
    subtitulo: `${i.titulo} — gerado em ${d.geradoEm.toLocaleString("pt-BR")}`,
    secoes: [{ id: "info", titulo: "Informações", campos: info, tabelas: [], graficos: [] }, operacao, custos, progresso, fotos],
  };
}

/** Lista o que falta para o relatório estar completo (vazio = completo). */
export function verificarCompletude(r: RelatorioObra): string[] {
  const faltas: string[] = [];
  for (const [id, rotulos] of Object.entries(CAMPOS_OBRIGATORIOS)) {
    const secao = r.secoes.find((s) => s.id === id);
    if (!secao) {
      faltas.push(`Seção ausente: ${id}`);
      continue;
    }
    for (const rotulo of rotulos) {
      const campo = secao.campos.find((cp) => cp.rotulo === rotulo);
      if (!campo) faltas.push(`${secao.titulo}: falta "${rotulo}"`);
      else if (!campo.valor.trim()) faltas.push(`${secao.titulo}: "${rotulo}" sem valor`);
    }
  }
  const prog = r.secoes.find((s) => s.id === "progresso");
  if (prog && prog.tabelas[0]?.linhas.length !== 20) faltas.push("Progresso: a tabela precisa dos 20 serviços");
  return faltas;
}
