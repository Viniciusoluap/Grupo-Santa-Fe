// Pedido de 12/11 (noite), bloco 4: filtros do BPO (Cobranças, Despesas, A classificar, Clientes e DRE).
// Regras puras; a lista de lançamentos usa filtrarLancamentosLote (shared/financeiro/bpo-lote.ts), a mesma do
// "Excluir tudo" no servidor, para os totais e as ações em lote nunca alcançarem o que está oculto.
// Paridade BPO (13/11): gêmeo de Prospecta/shared/financeiro/bpo-filtros.ts. No Santa Fé não há aba "Clientes"
// na página do BPO: a busca/situação de clientes vale para a lista de clientes BPO (filtrarClientes).
import { valorRealizado } from "@/lib/bpo-parciais";
import { valorNoFiltro, type FiltrosLote } from "@/lib/bpo-lote";
import { lancamentoNoCentro } from "./centros-custo";

export type StatusFiltro = "todas" | "pendentes" | "pagas" | "vencidas" | "parciais";
export const ROTULOS_STATUS: Record<StatusFiltro, string> = {
  todas: "Todos", pagas: "Pago", pendentes: "Em aberto", vencidas: "Vencido", parciais: "Parcial",
};

/** Filtros da tela (texto dos campos) → filtros do lote (os mesmos aplicados no servidor). */
export type FiltrosTela = { mes: string; ano: string; busca: string; valorMin: string; valorMax: string; status: StatusFiltro; centroCusto: string };
export const FILTROS_VAZIOS: FiltrosTela = { mes: "", ano: "", busca: "", valorMin: "", valorMax: "", status: "todas", centroCusto: "" };

/** "1.234,56", "1234.56" ou "R$ 10" → número; vazio/inválido → null. */
export function numeroDoCampo(v: string | null | undefined): number | null {
  const t = String(v ?? "").replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function filtrosDoLote(f: FiltrosTela): FiltrosLote {
  return {
    mes: f.mes || null, ano: f.ano || null, busca: f.busca.trim() || null, status: f.status,
    valorMin: numeroDoCampo(f.valorMin), valorMax: numeroDoCampo(f.valorMax), centroCusto: f.centroCusto || null,
  };
}

export const algumFiltro = (f: FiltrosTela) => (Object.keys(FILTROS_VAZIOS) as (keyof FiltrosTela)[]).some(k => f[k] !== FILTROS_VAZIOS[k]);

/** Totais do que está visível: quantidade, total, recebido/pago e em aberto (em reais, somados em centavos). */
export function resumoDosLancamentos(lancamentos: { valor: number; pago: boolean; valorRecebido?: number | null }[]) {
  let total = 0, recebido = 0;
  for (const l of lancamentos) { total += Math.round(Number(l.valor) * 100); recebido += Math.round(valorRealizado(l) * 100); }
  return { quantidade: lancamentos.length, total: total / 100, recebido: recebido / 100, emAberto: (total - recebido) / 100 };
}

export type MovimentacaoFiltravel = { data: Date | string; descricao: string; titular?: string | null; valor: string | number };

/** Movimentações do banco (A classificar): mês/ano pela data, busca em titular/descrição, valor. */
export function filtrarMovimentacoes<T extends MovimentacaoFiltravel>(movs: T[], f: FiltrosLote): T[] {
  const busca = (f.busca ?? "").trim().toLowerCase();
  return movs.filter(m => {
    const dia = (typeof m.data === "string" ? m.data : m.data.toISOString()).slice(0, 10);
    if (f.ano && !dia.startsWith(`${f.ano}-`)) return false;
    if (f.mes && dia.slice(5, 7) !== f.mes) return false;
    if (busca && !m.descricao.toLowerCase().includes(busca) && !String(m.titular ?? "").toLowerCase().includes(busca)) return false;
    return valorNoFiltro(m.valor, f);
  });
}

export type ClienteFiltravel = { razaoSocial: string; nomeLead?: string | null; cpf?: string | null; cnpj?: string | null; status: string };

/** Clientes: busca por nome (cadastro ou lead) ou documento (só os dígitos) e status. */
export function filtrarClientes<T extends ClienteFiltravel>(clientes: T[], f: { busca?: string | null; status?: string | null }): T[] {
  const busca = (f.busca ?? "").trim().toLowerCase();
  const digitos = busca.replace(/\D/g, "");
  return clientes.filter(c => {
    if (f.status && f.status !== "todos" && c.status !== f.status) return false;
    if (!busca) return true;
    if (c.razaoSocial.toLowerCase().includes(busca) || String(c.nomeLead ?? "").toLowerCase().includes(busca)) return true;
    return digitos.length >= 3 && [c.cpf, c.cnpj].some(d => (d ?? "").replace(/\D/g, "").includes(digitos));
  });
}

/** DRE: só os lançamentos do centro de custo (os combinados "A / B" entram nos dois). */
export function filtrarPorCentro<T extends { centroCustos?: string | null }>(lancamentos: T[], centro: string | null | undefined): T[] {
  return centro ? lancamentos.filter(l => lancamentoNoCentro(l.centroCustos, centro)) : lancamentos;
}
