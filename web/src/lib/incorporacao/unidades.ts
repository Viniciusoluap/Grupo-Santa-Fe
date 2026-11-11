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

/** Identidade física estável entre versões de cenários: evita duplicar vendas e tombstones. */
export function unidadesDoCenario(c: import("./estudos-massa").CenarioPrincipal | null) {
  if (!c) return [];
  const chaves = new Set<string>();
  return c.lotes.map((l) => {
    const codigo = `Q${l.quadra} / L${l.lote}`;
    const chave = chaveUnidade(codigo);
    if (codigo.length > 120 || chaves.has(chave)) throw new Error("Cenário com identificação de lote repetida ou longa demais. Revise quadra e lote.");
    chaves.add(chave);
    return { codigo, chave, origem: chave, cenario: c.cenarioId ?? "lotes_avulsos", valor: c.precoM2Lote && c.precoM2Lote > 0 ? (l.areaM2 * c.precoM2Lote).toFixed(2) : null };
  });
}

// ─── Exibição, ordenação numérica e paginação (correção 07) ─────────────────
//
// O CÓDIGO PERSISTIDO ("Q1 / L1") é a identidade comercial (chaveUnidade) e NÃO muda:
// vendas, reservas, histórico e vínculos continuam apontando para a mesma unidade.
// Só a EXIBIÇÃO é normalizada para "Q01 / L01" e a ordenação passa a ser numérica.

/** "Q01 / L01" a partir de quadra e lote (aceita "1", "01", "A"). */
export function formatarCodigoLote(quadra: string, lote: string): string {
  const pad = (v: string) => (/^\d+$/.test(v.trim()) ? v.trim().padStart(2, "0") : v.trim());
  return `Q${pad(quadra)} / L${pad(lote)}`;
}

/** Extrai quadra e lote de um código ("Q1 / L10", "q01/l3", "Quadra 2 Lote 7"); null quando não segue o padrão. */
export function parseCodigoUnidade(codigo: string): { quadra: string; lote: string } | null {
  const m = codigo.normalize("NFKC").trim().match(/^q(?:uadra)?\s*([0-9a-z]+)\s*[/\-–,·]?\s*l(?:ote)?\s*([0-9a-z]+)$/i);
  return m ? { quadra: m[1], lote: m[2] } : null;
}

/** Código de exibição: padrão Q/L normalizado; demais códigos (avulsos) ficam como foram cadastrados. */
export function codigoExibicao(codigo: string): string {
  const p = parseCodigoUnidade(codigo);
  return p ? formatarCodigoLote(p.quadra, p.lote) : codigo;
}

const coletor = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Ordenação numérica real: Q1/L2 < Q1/L10 < Q2/L1; códigos fora do padrão vão depois, em ordem natural. */
export function compararCodigoUnidade(a: string, b: string): number {
  const pa = parseCodigoUnidade(a), pb = parseCodigoUnidade(b);
  if (pa && pb) return coletor.compare(pa.quadra, pb.quadra) || coletor.compare(pa.lote, pb.lote) || coletor.compare(a, b);
  if (pa) return -1;
  if (pb) return 1;
  return coletor.compare(a, b);
}

export const UNIDADES_POR_PAGINA = 6;

/** Página (1-based, limitada ao intervalo válido) de uma lista já filtrada/ordenada. */
export function paginar<T>(itens: T[], pagina: number, porPagina = UNIDADES_POR_PAGINA) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(totalPaginas, Math.max(1, Math.floor(pagina) || 1));
  const inicio = (atual - 1) * porPagina;
  return {
    itens: itens.slice(inicio, inicio + porPagina),
    pagina: atual,
    totalPaginas,
    total: itens.length,
    temAnterior: atual > 1,
    temProxima: atual < totalPaginas,
  };
}
