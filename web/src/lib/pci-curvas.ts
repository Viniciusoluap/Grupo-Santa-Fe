/**
 * Lote 03, correções 06 e 08 — curvas padrão da CAIXA e regras do cronograma
 * (aba `Curvas_padrão` do modelo oficial da PCI) recalculadas no sistema, sem
 * depender do valor em cache das fórmulas da planilha.
 *
 * Fonte: PCI-CAIXA.xls oficial (29/10/2026), `Curvas_padrão!B22:Q45`, conferida
 * com a fixture anônima do modelo; regras em `docs/handoffs/lote3/MAPEAMENTO-PCI.md`
 * §3 (cronograma, coluna AX, BF157, G162) e §4 (PLS, U110/U111, BL89).
 *
 * Gêmeo idêntico: Prospecta `shared/pci-curvas.ts` ↔ Santa Fé `web/src/lib/pci-curvas.ts`.
 */

export type TipoCurvaPci = "lenta" | "normal" | "rapida";
export interface CurvasPci {
  /** % acumulado por etapa; índice = nº da etapa (0..24; etapa 0 = 0). */
  lenta: number[];
  normal: number[];
  rapida: number[];
}

/** Curvas_padrão: etapas 1..24 (lenta, normal, rápida) das faixas 1, 2 e 3. */
const TABELA: Record<1 | 2 | 3, [number, number, number][]> = {
  1: [
    [0, 5, 8], [19, 22, 33], [28, 39, 59], [38, 59, 84], [50, 74, 100], [58, 90, 100], [65, 100, 100], [70, 100, 100],
    [75, 100, 100], [80, 100, 100], [84, 100, 100], [87, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100],
    [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100],
  ],
  2: [
    [0, 5, 9], [14, 15, 25], [20, 27, 42], [28, 39, 59], [35, 52, 75], [44, 63, 90], [51, 74, 95], [57, 82, 100],
    [62, 92, 100], [66, 100, 100], [71, 100, 100], [75, 100, 100], [80, 100, 100], [82, 100, 100], [85, 100, 100], [89, 100, 100],
    [94, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100],
  ],
  3: [
    [0, 3, 5], [8, 10, 17], [13, 14, 25], [18, 23, 39], [25, 32, 53], [31, 42, 64], [38, 51, 76], [42, 59, 87],
    [48, 67, 94], [54, 73, 100], [59, 80, 100], [65, 89, 100], [69, 95, 100], [75, 100, 100], [79, 100, 100], [81, 100, 100],
    [83, 100, 100], [86, 100, 100], [89, 100, 100], [92, 100, 100], [95, 100, 100], [100, 100, 100], [100, 100, 100], [100, 100, 100],
  ],
};

export const ETAPAS_CURVA_PADRAO_PCI = 24;

/** Faixa da curva pelo valor do imóvel (Proposta!AK74 / PLS!AQ77): ≤264.000 → 1; >500.000 → 3; senão 2. Sem valor → null. */
export function faixaCurvaPci(valorImovel: number | null | undefined): 1 | 2 | 3 | null {
  if (valorImovel === null || valorImovel === undefined || !Number.isFinite(valorImovel) || valorImovel <= 0) return null;
  if (valorImovel <= 264000) return 1;
  if (valorImovel > 500000) return 3;
  return 2;
}

/** Curvas lenta/normal/rápida (etapas 0..24) da faixa do imóvel; sem valor → null. */
export function curvasPadraoPci(valorImovel: number | null | undefined): CurvasPci | null {
  const faixa = faixaCurvaPci(valorImovel);
  if (!faixa) return null;
  const t = TABELA[faixa];
  return {
    lenta: [0, ...t.map((l) => l[0])],
    normal: [0, ...t.map((l) => l[1])],
    rapida: [0, ...t.map((l) => l[2])],
  };
}

/**
 * Valor da curva numa etapa. Depois da etapa 24 todas as curvas já estão em 100
 * (a PLS repete a última linha), então vale 100.
 */
export function valorCurvaPci(curva: number[], etapa: number): number {
  if (etapa <= 0) return 0;
  return etapa < curva.length ? curva[etapa] : 100;
}

/** Incremento máximo por etapa quando há pré-executado (Proposta!BF157): 23 / 17 / 14 p.p. */
export function incrementoMaximoEtapaPci(valorImovel: number | null | undefined): number | null {
  const faixa = faixaCurvaPci(valorImovel);
  return faixa === 1 ? 23 : faixa === 2 ? 17 : faixa === 3 ? 14 : null;
}

/** Primeira etapa em que a curva chega a 100% (BD158/BF158/BH158). */
export function etapaCemPorCentoPci(curva: number[]): number | null {
  const i = curva.findIndex((v, k) => k > 0 && v >= 100);
  return i > 0 ? i : null;
}

// ─── PLS: situação da obra (U110 e U111) ─────────────────────────────────────

export type SituacaoCurvaPls = "OBRA LENTA" | "OBRA RÁPIDA" | "NORMAL" | "ATRASADA" | "ADIANTADA" | "PRAZO EXTRAPOLADO" | "";
export type SituacaoPropostoPls = "ATRASADA" | "ADIANTADA" | "NORMAL" | "PRAZO EXTRAPOLADO" | "";

/** Tolerância (p.p.) do cronograma proposto na PLS (BB95: ±10). */
export const TOLERANCIA_PROPOSTO_PLS = 10;

/**
 * U110 (= BN98): "PRAZO EXTRAPOLADO" quando a vistoria passa do fim do contrato;
 * senão compara o Acumul. Adotado da etapa da vistoria com as curvas lenta e
 * rápida: abaixo da lenta → "OBRA LENTA"; acima da rápida → "OBRA RÁPIDA";
 * senão "NORMAL". Etapas 31+ (repactuação longa) usam "ATRASADA"/"ADIANTADA"
 * (BL126:BL167). A busca do modelo cobre as etapas 1..37; fora disso (ou etapa 0) → "".
 */
export function situacaoCurvaPls(p: { etapa: number | null; adotado: number | null; curvas: CurvasPci | null; prazoExtrapolado: boolean }): SituacaoCurvaPls {
  if (p.prazoExtrapolado) return "PRAZO EXTRAPOLADO";
  if (p.etapa === null || p.etapa < 1 || p.etapa > 37 || !p.curvas || p.adotado === null) return "";
  const lenta = valorCurvaPci(p.curvas.lenta, p.etapa);
  const rapida = valorCurvaPci(p.curvas.rapida, p.etapa);
  const longa = p.etapa >= 31;
  if (p.adotado < lenta) return longa ? "ATRASADA" : "OBRA LENTA";
  if (p.adotado > rapida) return longa ? "ADIANTADA" : "OBRA RÁPIDA";
  return "NORMAL";
}

/**
 * U111 (= BN100): "PRAZO EXTRAPOLADO" igual ao U110; senão compara o Acumul. PLS
 * da etapa da vistoria (AF, não o adotado) com o proposto da mesma etapa
 * (Proposta!AI) com tolerância de ±10 p.p. Proposto 0/vazio ou etapa fora de 1..24 → "".
 */
export function situacaoPropostoPls(p: { etapa: number | null; acumuladoPls: number | null; proposto: number | null; prazoExtrapolado: boolean }): SituacaoPropostoPls {
  if (p.prazoExtrapolado) return "PRAZO EXTRAPOLADO";
  if (p.etapa === null || p.etapa < 1 || p.etapa > 24 || !p.proposto) return "";
  const pls = p.acumuladoPls ?? 0;
  if (pls < p.proposto - TOLERANCIA_PROPOSTO_PLS) return "ATRASADA";
  if (pls > p.proposto + TOLERANCIA_PROPOSTO_PLS) return "ADIANTADA";
  return "NORMAL";
}
