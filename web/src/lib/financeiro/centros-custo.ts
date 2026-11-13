// Pedido de 12/11 (noite): centros de custo do BPO. Regras puras (sem banco).
// Paridade BPO (13/11): gêmeo de Prospecta/shared/financeiro/centros-custo.ts (mesmo texto).
// O lançamento guarda o nome em bpo_lancamentos."centroCustos" (texto): um nome ou dois juntos "A / B"
// (backup do Conta Azul com a mesma linha em dois centros). O lançamento combinado aparece no filtro dos dois.

export const SEPARADOR_CENTROS = " / ";
export const MAX_CENTRO_CUSTOS = 100;

/** Nome como é gravado: sem espaços sobrando, no máximo 100 caracteres. */
export function normalizarNomeCentro(nome: string | null | undefined): string {
  return String(nome ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CENTRO_CUSTOS);
}

/** Chave de comparação: sem diferenciar maiúsculas, acentos e espaços extras. */
export function chaveCentro(nome: string | null | undefined): string {
  return normalizarNomeCentro(nome).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Os centros de um lançamento ("A / B" → ["A", "B"]). */
export function centrosDoLancamento(centroCustos: string | null | undefined): string[] {
  return String(centroCustos ?? "").split(SEPARADOR_CENTROS).map(normalizarNomeCentro).filter(Boolean);
}

/** O lançamento é do centro (inclui os combinados "A / B"). */
export function lancamentoNoCentro(centroCustos: string | null | undefined, centro: string | null | undefined): boolean {
  const alvo = chaveCentro(centro);
  return Boolean(alvo) && centrosDoLancamento(centroCustos).some(c => chaveCentro(c) === alvo);
}

/**
 * Texto do lançamento depois de renomear o centro `antigo` para `novo` (só a parte correspondente; nos
 * combinados "A / B" a outra parte fica). `null` = o lançamento não usa o centro. Erro se passar de 100.
 */
export function renomearCentroNoTexto(centroCustos: string | null | undefined, antigo: string, novo: string): string | null {
  const partes = centrosDoLancamento(centroCustos);
  const alvo = chaveCentro(antigo);
  if (!partes.some(p => chaveCentro(p) === alvo)) return null;
  const nome = normalizarNomeCentro(novo);
  const vistas = new Set<string>();
  const resultado = partes.map(p => (chaveCentro(p) === alvo ? nome : p)).filter(p => {
    const k = chaveCentro(p);
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  }).join(SEPARADOR_CENTROS);
  if (resultado.length > MAX_CENTRO_CUSTOS) throw new Error(`O nome novo deixa um lançamento com mais de ${MAX_CENTRO_CUSTOS} caracteres em centro de custo ("${resultado}").`);
  return resultado;
}

/** Nomes distintos (pela chave) usados nos lançamentos, separando os combinados. */
export function centrosUsados(lancamentos: { centroCustos: string | null }[]): string[] {
  const porChave = new Map<string, string>();
  for (const l of lancamentos) for (const c of centrosDoLancamento(l.centroCustos)) if (!porChave.has(chaveCentro(c))) porChave.set(chaveCentro(c), c);
  return Array.from(porChave.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
