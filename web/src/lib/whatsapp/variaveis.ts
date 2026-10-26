// Pedido de 25/10: as variáveis dos templates ({{nome}}, {{servico}}…) são preenchidas por destinatário
// antes do envio. Regra pura, gêmea de Prospecta/shared/whatsapp/variaveis.ts.
import { DOCUMENTOS_CLIENTE } from "@/lib/documentos-cliente-padrao";

export const VARIAVEIS_TEMPLATE: Record<string, string> = {
  nome: "Nome do cliente",
  servico: "Serviço",
  corretor: "Corretor",
  imovel: "Imóvel",
  banco: "Banco",
  horario: "Horário",
  endereco: "Endereço",
  documentos: "Documentos",
};

const PADRAO = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/** Nomes das variáveis usadas no texto, sem repetir, na ordem em que aparecem. */
export function variaveisDoTexto(texto: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(texto.matchAll(PADRAO))) {
    const nome = m[1].toLowerCase();
    if (!out.includes(nome)) out.push(nome);
  }
  return out;
}

/** Troca as variáveis pelos valores; devolve também as que ficaram sem valor (o envio é bloqueado). */
export function preencherTemplate(texto: string, valores: Record<string, string | null | undefined>) {
  const faltando: string[] = [];
  const final = texto.replace(PADRAO, (inteiro, bruto: string) => {
    const nome = bruto.toLowerCase();
    const v = valores[nome]?.toString().trim();
    if (v) return v;
    if (!faltando.includes(nome)) faltando.push(nome);
    return inteiro;
  });
  return { texto: final, faltando };
}

export const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] ?? "";

/** "a, b e c" */
export function listaPorExtenso(itens: string[]): string {
  const u = Array.from(new Set(itens.filter(Boolean)));
  if (u.length <= 1) return u[0] ?? "";
  return `${u.slice(0, -1).join(", ")} e ${u[u.length - 1]}`;
}

export { DOCUMENTOS_CLIENTE as DOCUMENTOS_CHECKLIST } from "@/lib/documentos-cliente-padrao";
export function textoDocumentosMarcados(chaves: string[], livre = ""): string {
  return listaPorExtenso([...DOCUMENTOS_CLIENTE.filter((d) => chaves.includes(d.chave)).map((d) => d.nome), livre.trim()]);
}

/** Campos preenchidos na tela: só os não vazios, aparados e com tamanho limitado. */
export function limparExtras(extras: unknown): Record<string, string> {
  if (!extras || typeof extras !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(extras as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k.toLowerCase()] = v.trim().slice(0, 500);
  }
  return out;
}

/**
 * Texto final de cada destinatário (dados do lead + campos da tela). Se algum ficar com {{…}},
 * devolve o erro que bloqueia o envio inteiro (mesma mensagem da Prospecta).
 */
export function textosPorDestinatario(texto: string, ids: string[], valores: Map<string, Record<string, string>>, extras: Record<string, string>, extrasPorLead: Record<string, Record<string, string>> = {}) {
  const r = new Map(ids.map((id) => [id, preencherTemplate(texto, { ...(valores.get(id) ?? {}), ...limparExtras(extras), ...limparExtras(extrasPorLead[id]) })]));
  const pendentes = ids.filter((id) => r.get(id)!.faltando.length);
  const nomes = Array.from(new Set(pendentes.flatMap((id) => r.get(id)!.faltando))).map((n) => `{{${n}}}`).join(", ");
  return {
    textos: new Map(ids.map((id) => [id, r.get(id)!.texto])),
    previa: ids.map((id) => ({ id, ...r.get(id)! })),
    erro: pendentes.length ? `Preencha ${nomes} antes de enviar (${pendentes.length} destinatário(s) sem esse dado).` : null,
  };
}
