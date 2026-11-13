// Negociação do Terreno (2.7 Novos Negócios) — registro e acompanhamento das
// propostas trocadas com o proprietário/terreneiro até o fechamento (compra
// à vista/parcelada ou permuta física/financeira).

export type TipoProposta =
  | "compra_avista"
  | "compra_parcelada"
  | "permuta_fisica"
  | "permuta_financeira"
  | "misto";

export type StatusProposta = "enviada" | "em_analise" | "contraproposta" | "aceita" | "recusada";

export interface Proposta {
  id: string;
  data: string; // ISO yyyy-mm-dd
  autor: "grupo_santa_fe" | "proprietario";
  tipo: TipoProposta;
  valorTotal?: number; // compra à vista/parcelada ou parcela fixa da permuta física/mista
  entradaPct?: number; // compra parcelada
  prazoParcelamentoMeses?: number; // compra parcelada
  permutaPctVgv?: number; // permuta financeira: % do VGV bruto
  unidadesPermuta?: number; // permuta física: nº de unidades/lotes entregues
  condicoes?: string;
  status: StatusProposta;
}

export interface DadosNegociacao {
  proprietarioNome: string;
  proprietarioContato: string;
  /** Legado/fallback: VGV digitado à mão. A ordem de uso é Viabilidade › cenário do Estudo de Massa › este valor. */
  vgvGrossManual?: number;
  propostas: Proposta[];
  /** Proposta escolhida pelo usuário ("usar como atual") para o indicador "Valor estimado — proposta atual". */
  propostaSelecionadaId?: string | null;
  /** Auditoria das exclusões (snapshot da proposta removida, quem e quando). Nunca é apagada. */
  historicoExclusoes?: ExclusaoProposta[];
}

export interface ExclusaoProposta {
  proposta: Proposta;
  excluidaEm: string; // ISO
  excluidaPorId: string | null;
  excluidaPorNome: string | null;
  eraAceita: boolean;
}

export interface ResumoNegociacao {
  totalPropostas: number;
  propostaAtual: Proposta | null; // mais recente por data
  fechada: boolean;
  valorEstimadoAtual: number;
}

/** Valor estimado da proposta — usa o VGV bruto do estudo para a permuta financeira. */
export function valorEstimadoProposta(p: Proposta, vgvGross: number): number {
  switch (p.tipo) {
    case "permuta_financeira":
      return vgvGross > 0 && p.permutaPctVgv ? vgvGross * (p.permutaPctVgv / 100) : 0;
    case "compra_avista":
    case "compra_parcelada":
    case "permuta_fisica":
    case "misto":
      return p.valorTotal ?? 0;
    default:
      return 0;
  }
}

export function resumoNegociacao(dados: DadosNegociacao, vgvGross = 0): ResumoNegociacao {
  const propostas = [...dados.propostas].sort((a, b) => a.data.localeCompare(b.data));
  const propostaAtual = propostas.length > 0 ? propostas[propostas.length - 1] : null;
  const fechada = propostas.some((p) => p.status === "aceita");
  return {
    totalPropostas: propostas.length,
    propostaAtual,
    fechada,
    valorEstimadoAtual: propostaAtual ? valorEstimadoProposta(propostaAtual, vgvGross) : 0,
  };
}

/** Lê o JSON salvo do estudo e diz se a negociação já foi fechada — usado no progresso automático. */
export function negociacaoFechadaDoJson(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const dados = JSON.parse(json) as Partial<DadosNegociacao>;
    return Array.isArray(dados.propostas) && dados.propostas.some((p) => p.status === "aceita");
  } catch {
    return false;
  }
}


// Paridade Prospecta (13/11): mesma regra de shared/incorporacao/negociacao.ts.
// ─── Correção 08 — permuta sobre o VGV, proposta de referência e exclusão auditada ───

export type OrigemVgv = "viabilidade" | "cenario_massa" | "manual_legado";

export interface VgvBruto { valor: number; origem: OrigemVgv }

export const ROTULO_ORIGEM_VGV: Record<OrigemVgv, string> = {
  viabilidade: "VGV bruto da Viabilidade (2.5)",
  cenario_massa: "VGV do cenário escolhido no Estudo de Massa",
  manual_legado: "VGV informado manualmente (legado)",
};

/** VGV bruto do estudo: Viabilidade > cenário escolhido do Estudo de Massa > valor manual legado. Null = indisponível. */
export function resolverVgvBruto(f: { viabilidade?: number | null; cenarioMassa?: number | null; manualLegado?: number | null }): VgvBruto | null {
  const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (ok(f.viabilidade)) return { valor: f.viabilidade, origem: "viabilidade" };
  if (ok(f.cenarioMassa)) return { valor: f.cenarioMassa, origem: "cenario_massa" };
  if (ok(f.manualLegado)) return { valor: f.manualLegado, origem: "manual_legado" };
  return null;
}

/**
 * VALOR DA PERMUTA = VGV BRUTO × (PERCENTUAL / 100), em aritmética inteira de centavos
 * (BigInt; percentual com até 4 casas) — sem erro de ponto flutuante. Arredondamento
 * meio-para-cima no centavo.
 */
export function calcularPermutaFinanceira(vgv: number, percentual: number): number {
  const centavos = BigInt(Math.round(vgv * 100));
  const pctE4 = BigInt(Math.round(percentual * 10_000));
  const ZERO = BigInt(0), UM = BigInt(1), DOIS = BigInt(2);
  const den = BigInt(1_000_000); // 100 (percentual) × 10.000 (casas do percentual)
  const num = centavos * pctE4;
  const sinal = num < ZERO ? -UM : UM;
  const abs = num < ZERO ? -num : num;
  const arred = (abs * DOIS + den) / (DOIS * den);
  return Number(sinal * arred) / 100;
}

export type EstimativaProposta =
  | { status: "calculado"; valor: number }
  | { status: "pendente"; motivo: string }
  | { status: "nao_informado" };

export const PENDENTE_SEM_VGV = "Cálculo pendente — VGV não disponível";

export function estimarProposta(p: Proposta, vgv: VgvBruto | null): EstimativaProposta {
  if (p.tipo === "permuta_financeira" || (p.tipo === "misto" && (p.permutaPctVgv ?? 0) > 0)) {
    const pct = p.permutaPctVgv ?? 0;
    if (!(pct > 0)) return p.tipo === "misto" && (p.valorTotal ?? 0) > 0 ? { status: "calculado", valor: p.valorTotal! } : { status: "nao_informado" };
    if (!vgv) return { status: "pendente", motivo: PENDENTE_SEM_VGV };
    const permuta = calcularPermutaFinanceira(vgv.valor, pct);
    // misto: parcela em dinheiro + parcela de permuta financeira
    const total = p.tipo === "misto" ? Math.round((permuta + (p.valorTotal ?? 0)) * 100) / 100 : permuta;
    return { status: "calculado", valor: total };
  }
  const v = p.valorTotal ?? 0;
  return v > 0 ? { status: "calculado", valor: v } : { status: "nao_informado" };
}

export type OrigemReferencia = "selecionada" | "aceita" | "mais_recente";

export interface ResumoNegociacaoV2 {
  totalPropostas: number;
  fechada: boolean;
  propostaAceita: Proposta | null;
  propostaMaisRecente: Proposta | null;
  propostaSelecionada: Proposta | null;
  /** Proposta que alimenta "Valor estimado — proposta atual": selecionada > aceita > mais recente. */
  referencia: Proposta | null;
  origemReferencia: OrigemReferencia | null;
  estimativa: EstimativaProposta | null;
  vgv: VgvBruto | null;
}

function ordenarPorData(ps: Proposta[]): Proposta[] {
  // data, e em empate a ordem de cadastro (estável)
  return ps.map((p, i) => ({ p, i })).sort((a, b) => a.p.data.localeCompare(b.p.data) || a.i - b.i).map((x) => x.p);
}

export function resumoNegociacaoV2(dados: DadosNegociacao, vgv: VgvBruto | null): ResumoNegociacaoV2 {
  const propostas = ordenarPorData(dados.propostas ?? []);
  const aceitas = propostas.filter((p) => p.status === "aceita");
  // uma proposta aceita NÃO é invalidada por outra enviada depois
  const propostaAceita = aceitas.length > 0 ? aceitas[aceitas.length - 1] : null;
  const propostaMaisRecente = propostas.length > 0 ? propostas[propostas.length - 1] : null;
  const propostaSelecionada = dados.propostaSelecionadaId ? propostas.find((p) => p.id === dados.propostaSelecionadaId) ?? null : null;
  const referencia = propostaSelecionada ?? propostaAceita ?? propostaMaisRecente;
  const origemReferencia: OrigemReferencia | null = propostaSelecionada ? "selecionada" : propostaAceita ? "aceita" : propostaMaisRecente ? "mais_recente" : null;
  return {
    totalPropostas: propostas.length,
    fechada: aceitas.length > 0,
    propostaAceita, propostaMaisRecente, propostaSelecionada, referencia, origemReferencia,
    estimativa: referencia ? estimarProposta(referencia, vgv) : null,
    vgv,
  };
}

export type ResultadoExclusao = { ok: true; dados: DadosNegociacao; exclusao: ExclusaoProposta } | { ok: false; erro: string };

/** Exclui SOMENTE a proposta indicada e registra a auditoria. Proposta aceita exige confirmação reforçada. */
export function excluirProposta(
  dados: DadosNegociacao, propostaId: string, autor: { id: string | null; nome: string | null }, agoraIso: string, confirmacaoReforcada: boolean
): ResultadoExclusao {
  const alvo = (dados.propostas ?? []).find((p) => p.id === propostaId);
  if (!alvo) return { ok: false, erro: "Proposta não encontrada (pode já ter sido excluída). Recarregue a página." };
  if (alvo.status === "aceita" && !confirmacaoReforcada) {
    return { ok: false, erro: "Esta proposta está ACEITA. Confirme a exclusão reforçada para continuar." };
  }
  const exclusao: ExclusaoProposta = { proposta: alvo, excluidaEm: agoraIso, excluidaPorId: autor.id, excluidaPorNome: autor.nome, eraAceita: alvo.status === "aceita" };
  return {
    ok: true,
    exclusao,
    dados: {
      ...dados,
      propostas: dados.propostas.filter((p) => p.id !== propostaId),
      propostaSelecionadaId: dados.propostaSelecionadaId === propostaId ? null : dados.propostaSelecionadaId ?? null,
      historicoExclusoes: [...(dados.historicoExclusoes ?? []), exclusao],
    },
  };
}

/**
 * Salvamento sem perda de auditoria: o JSON que vem da tela (possivelmente desatualizado)
 * nunca apaga exclusões já registradas nem ressuscita propostas excluídas.
 */
export function mesclarNegociacaoParaGravar(gravado: DadosNegociacao | null, recebido: DadosNegociacao): DadosNegociacao {
  const historico = new Map<string, ExclusaoProposta>();
  for (const h of [...(gravado?.historicoExclusoes ?? []), ...(recebido.historicoExclusoes ?? [])]) {
    historico.set(`${h.proposta.id}|${h.excluidaEm}`, h);
  }
  const excluidas = new Set(Array.from(historico.values()).map((h) => h.proposta.id));
  const propostas = (recebido.propostas ?? []).filter((p) => !excluidas.has(p.id));
  const sel = recebido.propostaSelecionadaId && propostas.some((p) => p.id === recebido.propostaSelecionadaId) ? recebido.propostaSelecionadaId : null;
  return { ...recebido, propostas, propostaSelecionadaId: sel, historicoExclusoes: Array.from(historico.values()).sort((a, b) => a.excluidaEm.localeCompare(b.excluidaEm)) };
}

export function parseNegociacao(json: string | null | undefined): DadosNegociacao | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as Partial<DadosNegociacao>;
    return { proprietarioNome: d.proprietarioNome ?? "", proprietarioContato: d.proprietarioContato ?? "", ...d, propostas: Array.isArray(d.propostas) ? d.propostas : [] };
  } catch {
    return null;
  }
}
