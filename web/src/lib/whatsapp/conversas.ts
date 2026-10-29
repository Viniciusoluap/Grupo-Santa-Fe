// Lote 03 (29/10/2026) — correções 01 a 04 da Central WhatsApp. Regras puras, usadas pelo servidor
// e pela tela (e testadas sem banco). Gêmeo de Prospecta/shared/whatsapp/conversas.ts.

/**
 * Chave do telefone: DDD + 8 últimos dígitos (o WhatsApp às vezes omite o 9º dígito; o 55 é opcional).
 * Mesma normalização de `mesmoTelefone` (src/lib/evolution.ts), que passa a usar esta função.
 */
export function chaveTelefone(x: string | null | undefined): string {
  let d = (x ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : d;
}

export type OrigemVinculo = "manual" | "telefone" | "mensagem";

/**
 * Correção 02: lead da conversa. O vínculo manual (botão "Vincular lead") vale mais que a
 * inferência pelo telefone, que vale mais que o lead gravado nas mensagens antigas.
 */
export function resolverLeadConversa(p: { manual?: string | null; porTelefone?: string | null; gravado?: string | null }): { leadId: string | null; origem: OrigemVinculo | null } {
  if (p.manual) return { leadId: p.manual, origem: "manual" };
  if (p.porTelefone) return { leadId: p.porTelefone, origem: "telefone" };
  if (p.gravado) return { leadId: p.gravado, origem: "mensagem" };
  return { leadId: null, origem: null };
}

const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type LeadCandidato = { id: string; nome: string; telefone: string | null; cpf: string | null };

/**
 * Correção 02: candidatos para vincular — por nome (sem acento), telefone normalizado ou CPF (só dígitos).
 * Os leads com o mesmo telefone da conversa vêm primeiro e marcados (`mesmoTelefone`), para o usuário
 * escolher quando o número está em mais de um lead.
 */
export function candidatosVinculo(lista: LeadCandidato[], termo: string, numeroConversa?: string | null, limite = 30) {
  const t = semAcento(termo.trim());
  const dig = termo.replace(/\D/g, "");
  const chaveConversa = chaveTelefone(numeroConversa);
  const marcados = lista.map(l => ({ ...l, mesmoTelefone: Boolean(chaveConversa) && chaveTelefone(l.telefone) === chaveConversa }));
  const casa = (l: (typeof marcados)[number]) => {
    if (!t) return l.mesmoTelefone;
    if (semAcento(l.nome).includes(t)) return true;
    if (dig.length >= 8 && chaveTelefone(l.telefone) === chaveTelefone(dig)) return true;
    if (dig.length >= 4 && (l.telefone ?? "").replace(/\D/g, "").includes(dig)) return true;
    if (dig.length >= 3 && (l.cpf ?? "").replace(/\D/g, "").includes(dig)) return true;
    return false;
  };
  return marcados.filter(casa)
    .sort((a, b) => Number(b.mesmoTelefone) - Number(a.mesmoTelefone) || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite);
}

// ── Correção 01/03: seleção múltipla ──

/** Marca/desmarca um item. */
export function alternarItem<T>(sel: T[], item: T): T[] {
  return sel.includes(item) ? sel.filter(x => x !== item) : [...sel, item];
}

/** "Selecionar todos" age só sobre os itens visíveis (filtro da busca): se todos já estão marcados, desmarca. */
export function alternarTodosVisiveis<T>(sel: T[], visiveis: T[]): T[] {
  const todos = visiveis.length > 0 && visiveis.every(v => sel.includes(v));
  if (todos) return sel.filter(x => !visiveis.includes(x));
  return [...sel, ...visiveis.filter(v => !sel.includes(v))];
}

/** Remove da seleção o que deixou de existir (conversa apagada, lead excluído no CRM). Mantém a referência se nada mudou. */
export function podarSelecao<T>(sel: T[], existentes: T[]): T[] {
  const s = new Set(existentes);
  const r = sel.filter(x => s.has(x));
  return r.length === sel.length ? sel : r;
}

// ── Correção 04: indicadores do dashboard ──

export const STATUS_ENVIO_SUCESSO = ["enviada", "entregue", "lida"] as const;
export const PERIODOS_DASHBOARD = ["7", "30", "90", "tudo"] as const;
export type PeriodoDashboard = (typeof PERIODOS_DASHBOARD)[number];
export const PERIODO_PADRAO: PeriodoDashboard = "30";
export const ROTULO_PERIODO: Record<PeriodoDashboard, string> = {
  "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias", tudo: "Todo o período",
};

/** Início do período (null = sem limite). */
export function inicioPeriodo(p: PeriodoDashboard, agora = new Date()): Date | null {
  if (p === "tudo") return null;
  return new Date(agora.getTime() - Number(p) * 24 * 60 * 60 * 1000);
}

/** Taxa de leitura sobre as enviadas com sucesso (0 quando não houve envio). */
export function taxaLeitura(enviadas: number, lidas: number): number {
  return enviadas > 0 ? Math.round((lidas / enviadas) * 100) : 0;
}

/** Texto da confirmação da exclusão em lote. */
export function textoConfirmacaoExclusao(conversas: number, mensagens: number): string {
  const c = `${conversas} conversa${conversas === 1 ? "" : "s"}`;
  const m = `${mensagens} mensage${mensagens === 1 ? "m" : "ns"}`;
  return `Excluir ${c} (${m}) do sistema? As mensagens e arquivos saem só daqui: continuam no celular, porque o WhatsApp não permite apagar por aqui. Leads e documentos do CRM não são alterados.`;
}
