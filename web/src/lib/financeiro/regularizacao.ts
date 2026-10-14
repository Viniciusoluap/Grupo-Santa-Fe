// EPIC-020 Lote 6 (itens 30 e 31) — regras da Regularização.
// Mesmo arquivo em Prospecta/shared/financeiro/regularizacao.ts.
//
// 30: o Status do Processo (Em análise, Em andamento, Concluído) é independente
//     das Etapas do Processo, que cada processo cria livremente (nome, ordem,
//     progresso 0–100% e observações).
// 31: tabela financeira por processo, com 17 itens iniciais em dois grupos.
//     Previsto é digitado; Recebido é a soma dos recebimentos confirmados
//     (manuais ou do BPO); Saldo = Previsto − Recebido. Totais por grupo e geral.
//     Tudo em centavos inteiros; nada é arredondado no meio do caminho.

import { centavosDe, dividirHalfUp } from "./obra";

export const STATUS_PROCESSO = ["em_analise", "em_andamento", "concluido"] as const;
export type StatusProcesso = (typeof STATUS_PROCESSO)[number];

export const STATUS_PROCESSO_LABEL: Record<string, string> = {
  em_analise: "Em análise",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  // Situações fora da escolha manual, mantidas só para exibir registros existentes.
  cancelado: "Cancelado",
  aguardando_configuracao: "Pendente de configuração",
};

export function rotuloStatusProcesso(status: string): string {
  return STATUS_PROCESSO_LABEL[status] ?? status;
}

export function ehStatusProcesso(valor: unknown): valor is StatusProcesso {
  return typeof valor === "string" && (STATUS_PROCESSO as readonly string[]).includes(valor);
}

/**
 * Conversão dos status antigos (Prospecta e Santa Fé) para o novo Status do
 * Processo. O valor original fica preservado em `status_legado`.
 */
export function statusProcessoDeLegado(antigo: string): string {
  switch (antigo) {
    case "analysis":
    case "analise":
    case "analise_inicial":
      return "em_analise";
    case "documentation":
    case "protocol":
    case "registry":
    case "documentacao":
    case "protocolo":
    case "em_analise_orgao":
    case "pendencias":
    case "aprovado":
    case "registrado":
      return "em_andamento";
    case "completed":
    case "concluido":
      return "concluido";
    case "cancelled":
    case "cancelado":
      return "cancelado";
    default:
      return antigo;
  }
}

// ── Etapas do Processo (30) ─────────────────────────────────────────────

export const LIMITE_NOME_ETAPA = 120;
export const LIMITE_OBSERVACAO_ETAPA = 2000;

export interface EtapaEntrada {
  nome: string;
  progresso: number;
  observacoes?: string | null;
}

/** Valida uma etapa; devolve a lista de erros (vazia quando está correta). */
export function validarEtapa(etapa: EtapaEntrada): string[] {
  const erros: string[] = [];
  const nome = etapa.nome?.trim() ?? "";
  if (nome.length < 2) erros.push("Informe o nome da etapa.");
  if (nome.length > LIMITE_NOME_ETAPA) erros.push(`O nome da etapa deve ter até ${LIMITE_NOME_ETAPA} caracteres.`);
  if (!Number.isInteger(etapa.progresso) || etapa.progresso < 0 || etapa.progresso > 100)
    erros.push("O progresso da etapa deve ser um número inteiro de 0% a 100%.");
  if ((etapa.observacoes ?? "").length > LIMITE_OBSERVACAO_ETAPA)
    erros.push(`As observações devem ter até ${LIMITE_OBSERVACAO_ETAPA} caracteres.`);
  return erros;
}

/**
 * Progresso das etapas = média simples dos progressos, em centésimos de ponto
 * percentual (HALF_UP). Sem etapas → null (não existe progresso a mostrar).
 */
export function progressoDasEtapas(etapas: { progresso: number }[]): number | null {
  if (!etapas.length) return null;
  const soma = etapas.reduce((acc, e) => acc + BigInt(Math.round(e.progresso)) * BigInt(100), BigInt(0));
  return Number(dividirHalfUp(soma, BigInt(etapas.length))) / 100;
}

/** Nova ordem depois de mover a etapa `id` uma posição para cima (-1) ou para baixo (+1). */
export function reordenarEtapas<T extends { id: string | number }>(etapas: T[], id: T["id"], direcao: -1 | 1): T[] {
  const lista = [...etapas];
  const i = lista.findIndex((e) => e.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return lista;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista;
}

// ── Tabela financeira (31) ──────────────────────────────────────────────

export const GRUPOS_FINANCEIROS = ["durante_obra", "casa_pronta"] as const;
export type GrupoFinanceiro = (typeof GRUPOS_FINANCEIROS)[number];

export const GRUPO_FINANCEIRO_LABEL: Record<GrupoFinanceiro, string> = {
  durante_obra: "Durante a Obra",
  casa_pronta: "Casa Pronta",
};

export function ehGrupoFinanceiro(valor: unknown): valor is GrupoFinanceiro {
  return typeof valor === "string" && (GRUPOS_FINANCEIROS as readonly string[]).includes(valor);
}

/** Os 17 itens iniciais (mesma lista usada pela migration para semear o banco). */
export const ITENS_FINANCEIROS_PADRAO: { chave: string; nome: string; grupo: GrupoFinanceiro; ordem: number }[] = [
  { chave: "projetos", nome: "Projetos", grupo: "durante_obra", ordem: 1 },
  { chave: "pci", nome: "PCI", grupo: "durante_obra", ordem: 2 },
  { chave: "impressoes", nome: "Impressões", grupo: "durante_obra", ordem: 3 },
  { chave: "agua", nome: "Água", grupo: "durante_obra", ordem: 4 },
  { chave: "despachante", nome: "Despachante", grupo: "durante_obra", ordem: 5 },
  { chave: "cert_inteiro_teor", nome: "Cert. Inteiro Teor", grupo: "durante_obra", ordem: 6 },
  { chave: "art", nome: "ART", grupo: "durante_obra", ordem: 7 },
  { chave: "alvara", nome: "Alvará", grupo: "durante_obra", ordem: 8 },
  { chave: "vistoria_cef", nome: "Vistoria CEF", grupo: "durante_obra", ordem: 9 },
  { chave: "tx_ass_cef", nome: "Tx Ass CEF", grupo: "durante_obra", ordem: 10 },
  { chave: "seguro_cef", nome: "Seguro CEF", grupo: "durante_obra", ordem: 11 },
  { chave: "itbi", nome: "ITBI", grupo: "durante_obra", ordem: 12 },
  { chave: "registro_cartorio", nome: "Registro Cartório", grupo: "durante_obra", ordem: 13 },
  { chave: "encargos_obra", nome: "Encargos de Obra", grupo: "durante_obra", ordem: 14 },
  { chave: "habite_se", nome: "Habite-se", grupo: "casa_pronta", ordem: 15 },
  { chave: "cnd_cno", nome: "CND e CNO", grupo: "casa_pronta", ordem: 16 },
  { chave: "averbacao", nome: "Averbação", grupo: "casa_pronta", ordem: 17 },
];

export const LIMITE_NOME_ITEM = 120;

export interface ItemFinanceiroEntrada {
  id: string | number;
  nome: string;
  grupo: string;
  ordem: number;
  previsto: string | number | null;
}

export interface RecebimentoEntrada {
  itemId: string | number | null;
  valor: string | number;
  status: string;
}

export interface Totais {
  previsto: number;
  recebido: number;
  saldo: number;
}

export interface LinhaFinanceira {
  id: string | number;
  nome: string;
  grupo: GrupoFinanceiro;
  ordem: number;
  /** Centavos. */
  previsto: number;
  recebido: number;
  saldo: number;
  /** Recebido acima do previsto (saldo negativo). */
  recebidoAMaior: boolean;
}

export interface FinanceiroRegularizacao {
  linhas: LinhaFinanceira[];
  grupos: Record<GrupoFinanceiro, Totais>;
  geral: Totais;
}

const totalZero = (): Totais => ({ previsto: 0, recebido: 0, saldo: 0 });

/**
 * Monta a tabela financeira. Recebimentos cancelados não contam; recebimentos
 * de itens que não estão na lista lançam erro (nunca são somados em silêncio).
 */
export function calcularFinanceiroRegularizacao(
  itens: ItemFinanceiroEntrada[],
  recebimentos: RecebimentoEntrada[],
): FinanceiroRegularizacao {
  const recebidoPorItem = new Map<string, number>();
  for (const r of recebimentos) {
    if (r.status !== "confirmado") continue;
    const chave = String(r.itemId);
    if (!itens.some((i) => String(i.id) === chave)) throw new Error(`Recebimento ligado a item inexistente (${chave}).`);
    const valor = centavosDe(r.valor);
    if (valor === null) throw new Error("Valor de recebimento inválido.");
    recebidoPorItem.set(chave, (recebidoPorItem.get(chave) ?? 0) + valor);
  }

  const linhas: LinhaFinanceira[] = [...itens]
    .sort((a, b) => a.ordem - b.ordem || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
    .map((i) => {
      if (!ehGrupoFinanceiro(i.grupo)) throw new Error(`Grupo financeiro inválido: ${i.grupo}`);
      const previsto = centavosDe(i.previsto ?? 0) ?? 0;
      const recebido = recebidoPorItem.get(String(i.id)) ?? 0;
      const saldo = previsto - recebido;
      return { id: i.id, nome: i.nome, grupo: i.grupo, ordem: i.ordem, previsto, recebido, saldo, recebidoAMaior: saldo < 0 };
    });

  const grupos = { durante_obra: totalZero(), casa_pronta: totalZero() };
  const geral = totalZero();
  for (const l of linhas) {
    for (const alvo of [grupos[l.grupo], geral]) {
      alvo.previsto += l.previsto;
      alvo.recebido += l.recebido;
      alvo.saldo += l.saldo;
    }
  }
  return { linhas, grupos, geral };
}

/** Mensagens das garantias gravadas no banco (triggers da migration do Lote 6 e do Lote 2). */
export const MENSAGENS_BANCO_REGULARIZACAO: Record<string, string> = {
  BPO_ALOCACAO_EXCEDIDA: "Este lançamento do BPO já está totalmente alocado (ou o valor ultrapassa o disponível).",
  BPO_LANCAMENTO_NAO_PAGO: "Só lançamentos do BPO já pagos/recebidos podem ser vinculados.",
  BPO_NATUREZA_INCOMPATIVEL: "Recebimentos da regularização usam receitas do BPO (não despesas).",
  BPO_LANCAMENTO_INEXISTENTE: "Lançamento do BPO não encontrado.",
  ITEM_COM_RECEBIMENTOS: "Este item tem recebimentos registrados. Exclua os recebimentos dele antes de excluir o item.",
};

/** Traduz o erro do banco para a mensagem ao usuário; null quando não é uma garantia conhecida. */
export function mensagemErroRegularizacao(erro: unknown): string | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const codigo = Object.keys(MENSAGENS_BANCO_REGULARIZACAO).find((c) => texto.includes(c));
  if (!codigo) return null;
  const disponivel = codigo === "BPO_ALOCACAO_EXCEDIDA" ? texto.match(/disponível R\$ ([\d.-]+)/)?.[1] : undefined;
  if (disponivel === undefined) return MENSAGENS_BANCO_REGULARIZACAO[codigo];
  const brl = Number(disponivel).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${MENSAGENS_BANCO_REGULARIZACAO[codigo]} Disponível: R$ ${brl}.`;
}
