// Pedido de 12/11 (noite): aba "A classificar" e divisão de pagamentos (split). Regras puras (sem banco).
// Nada do banco entra em Cobranças/Despesas/DRE sem o dono classificar, exceto o que o sistema já sabe
// ligar com segurança (cobrança Asaas conhecida, lançamento do Conta Azul já pago, regra por titular).
// Um pagamento pode quitar vários lançamentos (1 → N) e um lançamento pode ser quitado por vários
// pagamentos (N → 1, parciais). Valores sempre em centavos.
// Paridade BPO (13/11): gêmeo de Prospecta/shared/financeiro/bpo-a-classificar.ts (ids texto; despesa = "despesa"/"despesa_*").
import { ehDespesa, normalizarTitular } from "@/lib/bpo-categorias";

export const MAX_SUGESTOES_BAIXA = 5;

export const centavosDe = (v: string | number) => Math.round(Number(v) * 100);

/** Crédito do banco ↔ receita/honorário/reembolso; débito ↔ despesa. */
export function sentidoCompativel(tipoMovimento: "credito" | "debito", tipoLancamento: string): boolean {
  return tipoMovimento === "debito" ? ehDespesa(tipoLancamento) : !ehDespesa(tipoLancamento);
}

/** Chave determinística da alocação (repetir a mesma chamada não duplica). */
export const chaveAlocacao = (movimentacaoId: string, lancamentoId: string) => `bt:${movimentacaoId}:${lancamentoId}`;

export type MovimentoParaBaixa = {
  id: string; tipo: "credito" | "debito" | string; valor: string | number; data: Date | string;
  bpoClienteId?: string | null; titular?: string | null;
};

export type LancamentoEmAberto = {
  id: string; tipo: string; valor: string | number; valorRecebido?: string | number | null; vencimento: Date | string;
  clienteId: string | null; clienteNome?: string | null; pago: boolean;
};

export const saldoEmCentavos = (l: { valor: string | number; valorRecebido?: string | number | null }) =>
  centavosDe(l.valor) - centavosDe(l.valorRecebido ?? 0);

const dia = (d: Date | string) => Math.floor(new Date(typeof d === "string" && d.length === 10 ? `${d}T12:00:00Z` : d).getTime() / 86_400_000);

/**
 * Sugestões de baixa para uma movimentação: em aberto do mesmo sentido; primeiro os de saldo igual ao valor
 * (data de vencimento mais próxima primeiro), depois os do mesmo cliente BPO ou com o nome do titular. Máx. 5.
 */
export function sugestoesDeBaixa<T extends LancamentoEmAberto>(m: MovimentoParaBaixa, abertos: T[], max = MAX_SUGESTOES_BAIXA): T[] {
  const valor = centavosDe(m.valor);
  const dm = dia(m.data);
  const titular = normalizarTitular(m.titular);
  const elegiveis = abertos.filter(l => !l.pago && saldoEmCentavos(l) > 0 && sentidoCompativel(m.tipo === "debito" ? "debito" : "credito", l.tipo));
  const distancia = (l: T) => Math.abs(dia(l.vencimento) - dm);
  const ordenar = (xs: T[]) => [...xs].sort((a, b) => distancia(a) - distancia(b) || a.id.localeCompare(b.id));
  const mesmoValor = ordenar(elegiveis.filter(l => saldoEmCentavos(l) === valor || centavosDe(l.valor) === valor));
  const ja = new Set(mesmoValor.map(l => l.id));
  const mesmoCliente = ordenar(elegiveis.filter(l => !ja.has(l.id) && (
    (m.bpoClienteId != null && l.clienteId === m.bpoClienteId)
    || (titular.length >= 3 && normalizarTitular(l.clienteNome) === titular)
  )));
  return [...mesmoValor, ...mesmoCliente].slice(0, max);
}

export type Alocacao = { lancamentoId: string; valor: number };
export type LancamentoParaAlocar = {
  id: string; tipo: string; valor: string | number; valorRecebido: string | number; pago: boolean;
  combinadaEmId?: string | null; exclusaoLoteBackupId?: string | null; asaasPaymentId?: string | null; transacaoId?: string | null;
};

/**
 * Valida a divisão de um pagamento: pelo menos um lançamento, sem repetir, cada valor positivo em centavos
 * exatos e no máximo o saldo do lançamento, mesmo sentido da movimentação, e a soma EXATAMENTE igual ao
 * valor da movimentação. Recusa lançamento pago, combinado, arquivado, de cobrança Asaas ou já ligado 1:1.
 */
export function validarDivisao(m: { tipo: "credito" | "debito" | string; valor: string | number }, alocacoes: Alocacao[], lancamentos: LancamentoParaAlocar[]): string[] {
  const erros: string[] = [];
  if (!alocacoes.length) return ["Escolha ao menos um lançamento."];
  const porId = new Map(lancamentos.map(l => [l.id, l]));
  const vistos = new Set<string>();
  let soma = 0;
  for (const a of alocacoes) {
    const cents = Math.round(a.valor * 100);
    if (!Number.isFinite(a.valor) || !Number.isSafeInteger(cents) || cents <= 0 || Math.abs(a.valor * 100 - cents) > 0.00001) {
      erros.push(`Valor inválido para o lançamento #${a.lancamentoId}.`); continue;
    }
    if (vistos.has(a.lancamentoId)) { erros.push(`O lançamento #${a.lancamentoId} aparece mais de uma vez.`); continue; }
    vistos.add(a.lancamentoId);
    soma += cents;
    const l = porId.get(a.lancamentoId);
    if (!l) { erros.push(`Lançamento #${a.lancamentoId} não encontrado.`); continue; }
    if (l.exclusaoLoteBackupId != null) erros.push(`O lançamento #${l.id} foi arquivado.`);
    else if (l.combinadaEmId != null) erros.push(`O lançamento #${l.id} foi combinado em outra cobrança.`);
    else if (l.asaasPaymentId) erros.push(`O lançamento #${l.id} é uma cobrança do Asaas (a baixa vem do Asaas).`);
    else if (l.transacaoId != null) erros.push(`O lançamento #${l.id} já está ligado a outra movimentação do banco.`);
    else if (l.pago) erros.push(`O lançamento #${l.id} já está pago.`);
    else if (!sentidoCompativel(m.tipo === "debito" ? "debito" : "credito", l.tipo)) erros.push(`O lançamento #${l.id} é de outro sentido (${m.tipo === "debito" ? "saída só baixa despesa" : "entrada só baixa cobrança"}).`);
    else if (cents > saldoEmCentavos(l)) erros.push(`O valor aplicado no lançamento #${l.id} passa do saldo dele.`);
  }
  const total = centavosDe(m.valor);
  if (!erros.length && soma !== total) {
    erros.push(`A soma aplicada (${(soma / 100).toFixed(2)}) tem que ser exatamente o valor da movimentação (${(total / 100).toFixed(2)}).`);
  }
  return erros;
}

/** Depois da baixa: valor recebido, se ficou pago (só quando recebido = valor) e o saldo. */
export function resultadoDaBaixa(l: { valor: string | number; valorRecebido: string | number }, aplicado: number) {
  const recebido = centavosDe(l.valorRecebido) + Math.round(aplicado * 100);
  const valor = centavosDe(l.valor);
  return { valorRecebido: (recebido / 100).toFixed(2), pago: recebido === valor, saldo: (valor - recebido) / 100 };
}
