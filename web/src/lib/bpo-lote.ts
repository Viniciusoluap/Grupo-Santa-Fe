// Lote 3 (29/10/2026), itens 13B e 16: confirmação forte, proteção de registros financeiros,
// filtros da aba aplicados no servidor e "Combinar pagamentos". Regras puras (sem banco/rede).
// Gêmeo da Prospecta: shared/financeiro/bpo-lote.ts.

/** Texto exigido para confirmar exclusões (case-sensitive, sem acento). */
export const CONFIRMACAO_EXCLUSAO = "EXCLUIR";
export const confirmacaoExclusaoValida = (texto: string | null | undefined) => String(texto ?? "").trim() === CONFIRMACAO_EXCLUSAO;

export type MotivoProtecao = "asaas" | "extrato" | "baixa" | "obra" | "regularizacao" | "combinada";
export const ROTULOS_PROTECAO: Record<MotivoProtecao, string> = {
  asaas: "cobrança do Asaas",
  extrato: "vinda do extrato bancário",
  baixa: "com baixa/recebimento registrado",
  obra: "vinculada a movimento de obra",
  regularizacao: "vinculada a recebimento de regularização",
  combinada: "faz parte de uma combinação de pagamentos",
};

export type SituacaoProtecao = {
  asaasPaymentId?: string | null;
  /** Prospecta: bankTransactionId; Santa Fé: transacaoId. */
  transacaoBancaria?: string | number | null;
  pago?: boolean | null;
  valorRecebido?: string | number | null;
  baixas?: number;
  movimentosObra?: number;
  recebimentosRegularizacao?: number;
  combinadaEmId?: string | number | null;
  combinadas?: number;
};

/**
 * Protegido = nunca é apagado (nem no "Excluir tudo"): Asaas, extrato/transação bancária, baixa ou
 * conciliação (parcial ou total), vínculo com movimento de obra ou recebimento de regularização e
 * qualquer lado de uma combinação de pagamentos (rastreabilidade).
 */
export function motivosProtecao(l: SituacaoProtecao): MotivoProtecao[] {
  const m: MotivoProtecao[] = [];
  if (l.asaasPaymentId) m.push("asaas");
  if (l.transacaoBancaria != null && l.transacaoBancaria !== "") m.push("extrato");
  if (l.pago || Number(l.valorRecebido ?? 0) > 0 || (l.baixas ?? 0) > 0) m.push("baixa");
  if ((l.movimentosObra ?? 0) > 0) m.push("obra");
  if ((l.recebimentosRegularizacao ?? 0) > 0) m.push("regularizacao");
  if ((l.combinadaEmId != null && l.combinadaEmId !== "") || (l.combinadas ?? 0) > 0) m.push("combinada");
  return m;
}

/**
 * Revisão do PR (Codex P1): a original de uma combinação continua no banco só para rastreabilidade —
 * quem estiver com a lista antiga aberta não pode mais dar baixa, quitar, editar nem vincular nela.
 */
export const mensagemLancamentoCombinado = (combinadaEmId: string | number) =>
  `Esta cobrança já foi combinada na cobrança #${combinadaEmId} e não pode mais ser baixada, quitada ou alterada. Atualize a tela e use a cobrança combinada.`;
export function exigirNaoCombinada(l: { combinadaEmId?: string | number | null }) {
  if (l.combinadaEmId != null && l.combinadaEmId !== "") throw new Error(mensagemLancamentoCombinado(l.combinadaEmId));
}

export type FiltrosLote = {
  busca?: string | null;
  clienteId?: string | number | null;
  mes?: string | null;
  ano?: string | null;
  status?: "todas" | "pendentes" | "pagas" | "vencidas" | "parciais" | null;
  tipo?: "todos" | "honorario" | "reembolso" | "outros" | null;
  categoriaOperacional?: string | null;
  vinculoOperacionalId?: string | null;
};

export type LancamentoFiltravel = {
  tipo: string; clienteId: string | number | null; clienteNome?: string | null; descricao: string; competencia: string;
  vencimento: Date | string; pago: boolean; valorRecebido?: string | number | null;
  categoriaOperacional?: string | null; vinculoOperacionalId?: string | null;
};

export const ehSaida = (tipo: string) => tipo === "despesa" || tipo.startsWith("despesa_");

/** Os mesmos filtros da tela, aplicados no servidor para o "Excluir tudo" alcançar a aba inteira. */
export function filtrarLancamentosLote<T extends LancamentoFiltravel>(itens: T[], f: FiltrosLote, agora = new Date()): T[] {
  const busca = (f.busca ?? "").trim().toLowerCase();
  return itens.filter(l => {
    if (f.categoriaOperacional && l.categoriaOperacional !== f.categoriaOperacional) return false;
    if (f.vinculoOperacionalId && l.vinculoOperacionalId !== f.vinculoOperacionalId) return false;
    if (busca && !String(l.clienteNome ?? "").toLowerCase().includes(busca) && !l.descricao.toLowerCase().includes(busca)) return false;
    if (f.clienteId != null && f.clienteId !== "" && String(l.clienteId) !== String(f.clienteId)) return false;
    if (f.mes && !l.competencia.endsWith(`-${f.mes}`)) return false;
    if (f.ano && !l.competencia.startsWith(`${f.ano}-`)) return false;
    const vencido = !l.pago && new Date(l.vencimento) < agora;
    if (f.status === "pendentes" && (l.pago || vencido)) return false;
    if (f.status === "pagas" && !l.pago) return false;
    if (f.status === "vencidas" && !vencido) return false;
    if (f.status === "parciais" && (l.pago || Number(l.valorRecebido ?? 0) <= 0)) return false;
    if (f.tipo === "honorario" && l.tipo !== "honorario") return false;
    if (f.tipo === "reembolso" && l.tipo !== "reembolso") return false;
    if (f.tipo === "outros" && (l.tipo === "honorario" || l.tipo === "reembolso" || ehSaida(l.tipo))) return false;
    return true;
  });
}

export type ResumoExclusao = {
  totalAba: number; alcancados: number; selecionados: number; excluiveis: number; protegidos: number;
  porMotivo: Partial<Record<MotivoProtecao, number>>;
};

/** Prévia: total da aba, alcançados (filtro ou seleção), excluíveis e protegidos (por motivo). */
export function resumirExclusao<T extends SituacaoProtecao & { id: string | number }>(totalAba: number, alcancados: T[], selecionados: number) {
  const porMotivo: Partial<Record<MotivoProtecao, number>> = {};
  const excluiveis: T[] = [];
  let protegidos = 0;
  for (const l of alcancados) {
    const m = motivosProtecao(l);
    if (m.length) { protegidos++; m.forEach(x => { porMotivo[x] = (porMotivo[x] ?? 0) + 1; }); }
    else excluiveis.push(l);
  }
  const resumo: ResumoExclusao = { totalAba, alcancados: alcancados.length, selecionados, excluiveis: excluiveis.length, protegidos, porMotivo };
  return { resumo, excluiveis };
}

export type CobrancaParaCombinar = SituacaoProtecao & {
  id: string | number; tipo: string; clienteId: string | number | null; clienteNomeLivre?: string | null;
  descricao: string; valor: string | number; vencimento: Date | string; competencia: string; pago: boolean;
  categoriaOperacional?: string | null; vinculoOperacionalId?: string | null; categoria?: string | null;
};

export type ResultadoCombinacao =
  | { ok: true; total: number; vencimento: Date; competencia: string; descricao: string; tipo: string; clienteId: string | number | null; clienteNomeLivre: string | null; categoriaOperacional: string | null; vinculoOperacionalId: string | null; categoria: string | null }
  | { ok: false; erros: string[]; bloqueados: { id: string | number; motivo: string }[] };

const chaveCliente = (c: CobrancaParaCombinar) => c.clienteId != null ? `id:${c.clienteId}` : `livre:${(c.clienteNomeLivre ?? "").trim().toLowerCase()}`;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/**
 * "Combinar pagamentos": só cobranças do MESMO cliente e MESMO tipo, todas pendentes, sem Asaas,
 * extrato, baixa, vínculo de obra/regularização ou combinação anterior. A nova cobrança soma os
 * valores (centavos), vence no vencimento mais próximo e lista as originais na descrição.
 */
export function validarCombinacao(cobrancas: CobrancaParaCombinar[]): ResultadoCombinacao {
  const erros: string[] = [];
  const bloqueados: { id: string | number; motivo: string }[] = [];
  if (cobrancas.length < 2) erros.push("Selecione pelo menos duas cobranças.");
  for (const c of cobrancas) {
    if (ehSaida(c.tipo)) bloqueados.push({ id: c.id, motivo: "é despesa (só cobranças podem ser combinadas)" });
    const m = motivosProtecao(c);
    if (m.length) bloqueados.push({ id: c.id, motivo: m.map(x => ROTULOS_PROTECAO[x]).join(", ") });
    else if (c.pago) bloqueados.push({ id: c.id, motivo: "já está paga" });
  }
  if (new Set(cobrancas.map(chaveCliente)).size > 1) erros.push("As cobranças precisam ser do mesmo cliente.");
  if (cobrancas.some(c => !c.clienteId && !(c.clienteNomeLivre ?? "").trim())) erros.push("Cobrança sem cliente identificado não pode ser combinada.");
  if (new Set(cobrancas.map(c => c.tipo)).size > 1) erros.push("As cobranças precisam ser do mesmo tipo.");
  if (erros.length || bloqueados.length) return { ok: false, erros, bloqueados };
  const centavos = cobrancas.reduce((s, c) => s + Math.round(Number(c.valor) * 100), 0);
  const ordenadas = [...cobrancas].sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
  const vencimento = new Date(ordenadas[0].vencimento);
  const itens = ordenadas.map(c => `#${c.id} ${c.descricao} (${brl(Number(c.valor))}, venc. ${dataBr(new Date(c.vencimento))})`);
  const unico = <K extends "categoriaOperacional" | "vinculoOperacionalId" | "categoria">(k: K) => {
    const v = new Set(cobrancas.map(c => c[k] ?? null));
    return v.size === 1 ? (cobrancas[0][k] ?? null) : null;
  };
  // Mesma categoria operacional E mesmo registro vinculado → a nova cobrança herda; senão fica sem.
  const mesmoVinculo = new Set(cobrancas.map(c => c.vinculoOperacionalId ?? null)).size === 1;
  const categoriaOperacional = mesmoVinculo ? unico("categoriaOperacional") : null;
  return {
    ok: true,
    total: centavos / 100,
    vencimento,
    competencia: ordenadas[0].competencia,
    descricao: `Pagamento combinado de ${cobrancas.length} cobranças: ${itens.join("; ")}`.slice(0, 500),
    tipo: cobrancas[0].tipo,
    clienteId: cobrancas[0].clienteId,
    clienteNomeLivre: cobrancas[0].clienteId ? null : cobrancas[0].clienteNomeLivre ?? null,
    categoriaOperacional,
    vinculoOperacionalId: categoriaOperacional ? unico("vinculoOperacionalId") : null,
    categoria: unico("categoria"),
  };
}
