// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/shared/central-vendas/indicadores.ts).
// Indicadores do painel, calculados só com dados reais. Sem amostra, o valor é
// null (a tela mostra "sem dados"); nunca há estimativa.
import { campoCsv } from "@/lib/comissoes/exportacao-csv";
import { ROTULOS_STATUS } from "./config";

export type LinhaIndicador = {
  leadId: string; nome: string; criadoEm: Date; origem: string | null; campanha: string | null; produtoId: number | null;
  operadorId: string | null; primeiraMensagemEm: Date | null; primeiraRespostaEm: Date | null; qualificadoEm: Date | null;
  docsCompletosEm: Date | null; enviadoAnaliseEm: Date | null; decisaoEm: Date | null;
  statusAtendimento: string; statusDocumental: string; statusAnalise: string;
};
export type FiltrosIndicador = { de?: Date | null; ate?: Date | null; operadorId?: string | null; produtoId?: number | null; origem?: string | null };

export function filtrar(linhas: LinhaIndicador[], f: FiltrosIndicador) {
  return linhas.filter(l => (!f.de || l.criadoEm >= f.de) && (!f.ate || l.criadoEm <= f.ate)
    && (f.operadorId == null || l.operadorId === f.operadorId) && (f.produtoId == null || l.produtoId === f.produtoId)
    && (!f.origem || (l.origem ?? "sem origem") === f.origem));
}

const minutos = (a: Date | null, b: Date | null) => (a && b && b >= a ? (b.getTime() - a.getTime()) / 60_000 : null);
function media(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
}
function contar<T extends string | number>(chaves: T[]) {
  const m = new Map<T, number>();
  for (const k of chaves) m.set(k, (m.get(k) ?? 0) + 1);
  return Array.from(m.entries()).map(([chave, total]) => ({ chave, total })).sort((a, b) => b.total - a.total);
}

export function calcularIndicadores(todas: LinhaIndicador[], f: FiltrosIndicador = {}) {
  const l = filtrar(todas, f);
  const recebidos = l.length;
  const aprovados = l.filter(x => x.statusAnalise === "aprovado").length;
  return {
    recebidos,
    qualificados: l.filter(x => x.qualificadoEm).length,
    /** Minutos entre a primeira mensagem do cliente e a primeira resposta (automática ou humana). */
    tempoPrimeiraRespostaMin: media(l.map(x => minutos(x.primeiraMensagemEm, x.primeiraRespostaEm))),
    atendimentosPorOperador: contar(l.filter(x => x.operadorId != null).map(x => x.operadorId!)).map(r => ({ operadorId: r.chave, total: r.total })),
    aguardandoDocumentos: l.filter(x => x.statusDocumental === "aguardando_documentos" || x.statusDocumental === "parcial").length,
    documentacaoCompleta: l.filter(x => x.docsCompletosEm).length,
    enviadosAnalise: l.filter(x => x.enviadoAnaliseEm).length,
    emAnalise: l.filter(x => x.statusAnalise === "em_analise").length,
    pendencias: l.filter(x => x.statusAnalise === "pendente").length,
    aprovados,
    reprovados: l.filter(x => x.statusAnalise === "reprovado").length,
    /** Aprovados ÷ recebidos, em %; null sem leads no período. */
    taxaConversao: recebidos ? Math.round((aprovados / recebidos) * 1000) / 10 : null,
    tempoMedioEtapasMin: {
      entradaAteQualificacao: media(l.map(x => minutos(x.criadoEm, x.qualificadoEm))),
      qualificacaoAteDocumentos: media(l.map(x => minutos(x.qualificadoEm, x.docsCompletosEm))),
      documentosAteDecisao: media(l.map(x => minutos(x.enviadoAnaliseEm, x.decisaoEm))),
    },
    origens: contar(l.map(x => x.origem ?? "sem origem")).map(r => ({ origem: r.chave, total: r.total })),
  };
}
export type Indicadores = ReturnType<typeof calcularIndicadores>;

const dataBr = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) : "");

/** CSV (";" + BOM, como o resto do sistema) das oportunidades filtradas. Sem telefone, CPF ou renda. */
export function csvCentral(linhas: LinhaIndicador[], nomes: { operadores: Map<string, string>; produtos: Map<number, string> }): string {
  const cab = ["Lead", "Nome", "Entrada", "Origem", "Campanha", "Empreendimento/produto", "Operador", "Atendimento", "Documentação", "Análise", "Qualificado em", "Documentos completos em", "Decisão em"];
  const corpo = linhas.map(l => [
    l.leadId, l.nome, dataBr(l.criadoEm), l.origem ?? "", l.campanha ?? "", l.produtoId ? nomes.produtos.get(l.produtoId) ?? "" : "",
    l.operadorId ? nomes.operadores.get(l.operadorId) ?? "" : "", ROTULOS_STATUS[l.statusAtendimento] ?? l.statusAtendimento,
    ROTULOS_STATUS[l.statusDocumental] ?? l.statusDocumental, ROTULOS_STATUS[l.statusAnalise] ?? l.statusAnalise,
    dataBr(l.qualificadoEm), dataBr(l.docsCompletosEm), dataBr(l.decisaoEm),
  ].map(v => campoCsv(v)).join(";"));
  return `﻿${[cab.join(";"), ...corpo].join("\r\n")}`;
}
