// Lotes avulsos de empreendimento SEM KML (correção 06 do Lote 02 · AD-03).
//
// Quando o estudo marca "Este empreendimento não possui KML", o usuário cadastra
// os lotes um a um (quadra, lote, área, testada, profundidade), em quadras
// distintas. A lista é guardada como JSON no próprio estudo. Nada é inventado:
// testada e profundidade são opcionais e nenhuma medida geométrica é derivada.
// Função pura, idêntica nos dois sistemas.

export interface LoteAvulso {
  id: string;
  quadra: string;
  lote: string;
  areaM2: number;
  testadaM: number | null;
  profundidadeM: number | null;
}

export const LIMITE_LOTES_AVULSOS = 2000;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numeroOuNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function chaveLoteAvulso(l: Pick<LoteAvulso, "quadra" | "lote">): string {
  return `${l.quadra.trim().toUpperCase()}|${l.lote.trim().toUpperCase()}`;
}

/** Lê o JSON salvo de forma tolerante (itens inválidos são descartados). */
export function parseLotesAvulsos(json: string | null | undefined): LoteAvulso[] {
  if (!json) return [];
  let bruto: unknown;
  try { bruto = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(bruto)) return [];
  const lotes: LoteAvulso[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lote: LoteAvulso = {
      id: texto(o.id, 60) || `${lotes.length + 1}`,
      quadra: texto(o.quadra, 40),
      lote: texto(o.lote, 40),
      areaM2: numeroOuNull(o.areaM2) ?? 0,
      testadaM: numeroOuNull(o.testadaM),
      profundidadeM: numeroOuNull(o.profundidadeM),
    };
    if (validarLoteAvulso(lote) === null) lotes.push(lote);
  }
  return ordenarLotesAvulsos(lotes);
}

export function validarLoteAvulso(l: LoteAvulso): string | null {
  if (!l.quadra.trim()) return "Informe a quadra.";
  if (!l.lote.trim()) return "Informe o número do lote.";
  if (!Number.isFinite(l.areaM2) || l.areaM2 <= 0) return "A área do lote deve ser maior que zero.";
  if (l.testadaM !== null && (!Number.isFinite(l.testadaM) || l.testadaM <= 0)) return "Testada inválida.";
  if (l.profundidadeM !== null && (!Number.isFinite(l.profundidadeM) || l.profundidadeM <= 0)) return "Profundidade inválida.";
  return null;
}

/** Valida a lista inteira: itens válidos, sem quadra+lote repetidos e dentro do limite. */
export function validarListaLotesAvulsos(lista: LoteAvulso[]): string | null {
  if (lista.length > LIMITE_LOTES_AVULSOS) return `Limite de ${LIMITE_LOTES_AVULSOS} lotes avulsos por estudo.`;
  const vistos = new Set<string>();
  for (const l of lista) {
    const erro = validarLoteAvulso(l);
    if (erro) return `Quadra ${l.quadra || "?"}, lote ${l.lote || "?"}: ${erro}`;
    const chave = chaveLoteAvulso(l);
    if (vistos.has(chave)) return `O lote ${l.lote.trim()} da quadra ${l.quadra.trim()} está repetido.`;
    vistos.add(chave);
  }
  return null;
}

const comparar = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

export function ordenarLotesAvulsos(lista: LoteAvulso[]): LoteAvulso[] {
  return [...lista].sort((a, b) => comparar(a.quadra, b.quadra) || comparar(a.lote, b.lote));
}

export interface ResumoLotesAvulsos {
  total: number;
  quadras: number;
  areaTotalM2: number;
  areaMediaM2: number;
}

export function resumoLotesAvulsos(lista: LoteAvulso[]): ResumoLotesAvulsos {
  const areaTotal = lista.reduce((s, l) => s + l.areaM2, 0);
  return {
    total: lista.length,
    quadras: new Set(lista.map((l) => l.quadra.trim().toUpperCase())).size,
    areaTotalM2: Math.round(areaTotal * 100) / 100,
    areaMediaM2: lista.length > 0 ? Math.round((areaTotal / lista.length) * 100) / 100 : 0,
  };
}

/** Serializa para gravação (ordenado; valida antes). */
export function serializarLotesAvulsos(lista: LoteAvulso[]): string {
  return JSON.stringify(ordenarLotesAvulsos(lista).map((l) => ({
    id: l.id, quadra: l.quadra.trim(), lote: l.lote.trim(), areaM2: l.areaM2,
    testadaM: l.testadaM, profundidadeM: l.profundidadeM,
  })));
}

/**
 * Os módulos que só dependem da existência do terreno ficam liberados quando há
 * poligonal (KML) OU quando o estudo declara que não possui KML.
 */
export function terrenoLiberado(estudo: { geojson: string | null; semKml?: boolean | null }): boolean {
  return !!estudo.geojson || !!estudo.semKml;
}

/** Aviso padrão das funções que exigem geometria quando não há poligonal. */
export const AVISO_SEM_POLIGONAL = "Sem poligonal: este empreendimento foi marcado como sem KML. Esta função depende da geometria do terreno e não exibe medidas estimadas. Envie o KML quando disponível.";

/** Valida estritamente a lista recebida para gravação (nada é descartado em silêncio). */
export function prepararLotesAvulsosParaGravar(json: string): { ok: true; json: string; lista: LoteAvulso[] } | { ok: false; erro: string } {
  let bruto: unknown;
  try { bruto = JSON.parse(json); } catch { return { ok: false, erro: "Lista de lotes inválida." }; }
  if (!Array.isArray(bruto)) return { ok: false, erro: "Lista de lotes inválida." };
  const lista: LoteAvulso[] = bruto.map((item, i) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : typeof v === "number" ? v : Number(v));
    return {
      id: texto(o.id, 60) || String(i + 1),
      quadra: texto(o.quadra, 40),
      lote: texto(o.lote, 40),
      areaM2: n(o.areaM2) ?? 0,
      testadaM: n(o.testadaM),
      profundidadeM: n(o.profundidadeM),
    };
  });
  const erro = validarListaLotesAvulsos(lista);
  if (erro) return { ok: false, erro };
  return { ok: true, json: serializarLotesAvulsos(lista), lista: ordenarLotesAvulsos(lista) };
}
