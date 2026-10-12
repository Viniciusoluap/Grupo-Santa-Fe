export interface VendaLegada { id: string; unidade: string; comprador: string; valorVenda: number }

/** Identidade comercial exata: espaços/case Unicode, sem similaridade de nomes. */
export function chaveUnidade(codigo: string): string {
  return codigo.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export function vendasLegadas(json: string | null): { vendas: VendaLegada[]; invalido: boolean } {
  if (!json) return { vendas: [], invalido: false };
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || !("vendas" in parsed)) return { vendas: [], invalido: false };
    const vendas = (parsed as { vendas?: unknown }).vendas;
    if (!Array.isArray(vendas)) return { vendas: [], invalido: true };
    const validas: VendaLegada[] = [];
    const ids = new Set<string>(); const chaves = new Set<string>();
    for (const v of vendas) {
      if (!v || typeof v.id !== "string" || !v.id.trim() || typeof v.unidade !== "string" ||
        !chaveUnidade(v.unidade) || typeof v.comprador !== "string" || !v.comprador.trim() ||
        typeof v.valorVenda !== "number" || !Number.isFinite(v.valorVenda) || v.valorVenda <= 0 ||
        ids.has(v.id) || chaves.has(chaveUnidade(v.unidade))) return { vendas: [], invalido: true };
      ids.add(v.id); chaves.add(chaveUnidade(v.unidade));
      validas.push({ id: v.id, unidade: v.unidade.trim(), comprador: v.comprador.trim(), valorVenda: v.valorVenda });
    }
    return { vendas: validas, invalido: false };
  } catch { return { vendas: [], invalido: true }; }
}
