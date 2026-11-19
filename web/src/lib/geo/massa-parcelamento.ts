// Estudo de massa — motor de parcelamento urbano DETERMINÍSTICO (v2).
//
// Pipeline: polígono(s) da gleba (lng/lat; várias áreas contínuas e furos aceitos) → projeção
// local em metros → por área contínua: MALHA VIÁRIA traçada primeiro (grade, cul-de-sac, rua
// simples), mantida só se conexa e com acesso pela divisa → lotes com testada × profundidade
// informadas, RECORTADOS pela divisa quando a cruzam (aceitos com área e testada mínimas) →
// destinação de TODA a gleba (vendável / institucional / verde / não parcelável, com geometria
// própria) → quadro de áreas e VGV, somados entre as áreas.
//
// Mesma poligonal + mesmos parâmetros + mesma versão do algoritmo = mesmo resultado.
// Não há Math.random, semente variável nem dependência de relógio. A busca é uma
// varredura determinística de orientações e deslocamentos da malha; os parâmetros do
// usuário (testada, profundidade, largura da via, área mínima) NUNCA são alterados
// pelo motor — se a geometria não comportar o lote, o motivo é informado.
//
// Honestidade técnica: é um estudo de aproveitamento — não substitui projeto
// urbanístico aprovado nem levantamento técnico profissional.

import { difference, featureCollection, intersect, polygon as turfPolygon, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import {
  DESTINOS_PADRAO, RESTRICOES_VAZIAS, aproveitarRestricoes, calcularQuadroAreasMassa, totalRestricoes, type AproveitamentoDasRestricoes, type DestinoRestricao,
  type DestinosDasRestricoes, type QuadroAreasMassa, type RestricoesNaoParcelaveis,
} from "@/lib/incorporacao/massa-quadro-areas";
import {
  angulosDasArestas, areaPlanar, diferencaAngular, menorLarguraEnvelope, pontoDentro, prepararFrameAnel,
  retanguloDentro, rotacionar, round2, validarPoligonal,
  type FrameAnel, type ImplantacaoFrame, type LoteFrame, type Ret,
} from "./geometria-parcelamento";
import {
  areaPoli, avaliarMalhaRapida, bboxDe, destinarSobras, distanciaAoAnel, frenteMinimaPara, pecasCelula, poligonosDe, prepararGlebaFrame,
  processarMalha, type AlvosDestinacao, type BalaoMalha, type CelulaLote, type GlebaFrame, type LoteDestinado, type OpcoesMalha, type Poli,
  type ViaMalha,
} from "./malha-conectada";
import { buscarRuaSimples, gerarRuaSimplesFrame, implantacaoDoCandidatoRua, intervalosDaCorda, type CandidatoRua } from "./rua-simples";
import { buscarViaDivisa, divisasOpostas } from "./rua-divisa";
import { buscarPorLados, LADOS_GLEBA, type LadoGleba } from "./lados-gleba";
import { buscarViasPublicas } from "./vias-publicas";

export { areaPlanar, rotacionar } from "./geometria-parcelamento";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Rótulo fixo exibido na tela e em todas as saídas do estudo de massa. */
export const ROTULO_ESTUDO_PRELIMINAR = "Estudo preliminar — não substitui projeto urbanístico";

/** Versão do algoritmo — entra na assinatura: mudou o algoritmo, mudou a versão. */
export const VERSAO_ALGORITMO_MASSA = "3.0.0";

export type TipologiaMassa = "grid" | "cul_de_sac" | "rua_simples" | "vias_publicas";

export const TIPOLOGIAS_MASSA: { value: TipologiaMassa; label: string }[] = [
  { value: "grid", label: "Grade (grid)" },
  { value: "cul_de_sac", label: "Cul-de-sac (ruas sem saída com balão)" },
  { value: "rua_simples", label: "Rua simples (via única de mão dupla)" },
  { value: "vias_publicas", label: "Vias públicas (divisas já voltadas para vias — 100% de aproveitamento)" },
];

export type ModoSistemaViario = "automatico" | "manual";

export interface ParametrosMassa {
  larguraViaM: number;        // largura das vias (m) — usada exatamente
  testadaLoteM: number;       // frente do lote (m) — usada exatamente
  profundidadeLoteM: number;  // fundo do lote (m) — usado exatamente
  loteMinimoM2: number;       // área mínima legal do lote
  comprimentoMaxQuadraM: number; // comprimento máximo de quadra (m) (grade e cul-de-sac)
  percentInstitucional: number;  // 0..1 (sobre a área parcelável)
  percentAreaVerde: number;      // 0..1 (sobre a área parcelável)
  precoM2Lote: number;           // R$/m² para VGV
  /** Tipologia viária do cenário (padrão: grid). */
  tipologia?: TipologiaMassa;
  /** Como a área do sistema viário é definida (padrão: automático = área geométrica das vias desenhadas). */
  modoSistemaViario?: ModoSistemaViario;
  /** Área do sistema viário informada (m²) — só vale no modo manual. */
  areaSistemaViarioM2?: number;
  /** Rua Simples: "retangular" (padrão, testada × profundidade exatas) ou "divisa" (lote acompanha a divisa). */
  formatoLote?: "retangular" | "divisa";
  /** Rua Simples: traçado "reta" (padrão) ou "divisa" (via acompanha a divisa, com curvas; lotes acompanham a divisa). */
  tracadoVia?: "reta" | "divisa";
  /** Legado: restringe os cenários à divisa oposta ao primeiro cenário automático (substituído por `ladosVia`). */
  inverterLadoVia?: boolean;
  /** Rua pela divisa: lados onde a via deve ficar (rua de cima/esquerda/direita/baixo). Vazio = automático. */
  ladosVia?: LadoGleba[];
  /** Áreas não parceláveis informadas em m² (quando não vierem do KML/mapa). */
  appM2?: number;
  supressaoVegetalM2?: number;
  faixaTransmissaoM2?: number;
  faixaServidaoM2?: number;
  outrasNaoParcelaveisM2?: number;
  /**
   * Destino de cada área restrita nas doações obrigatórias (regra do dono, 16/11/2026): "verde" ou "institucional"
   * = a área conta para cumprir aquele mínimo, e o motor só tira da terra loteável o que faltar; "nenhum" = fica só
   * como não parcelável. Ausente = padrão de `DESTINOS_PADRAO` (APP, vegetação e faixas contam como área verde).
   */
  destinoApp?: DestinoRestricao;
  destinoSupressaoVegetal?: DestinoRestricao;
  destinoFaixaTransmissao?: DestinoRestricao;
  destinoFaixaServidao?: DestinoRestricao;
  destinoOutrasNaoParcelaveis?: DestinoRestricao;
}

export interface LoteGerado {
  /** Anel do lote em [lng, lat] (fechado). */
  anel: Position[];
  areaM2: number;
  tipo: "vendavel" | "area_publica" | "nao_parcelavel";
  /** Destinação da área pública (doação). */
  uso?: "institucional" | "verde";
  /** Identificação (só lotes vendáveis): quadra e nº do lote na quadra. */
  quadra?: string;
  numero?: string;
  /** Formato "acompanha a divisa" e lotes recortados/ampliados: testada real e profundidade média (área ÷ testada). */
  testadaM?: number;
  profundidadeMediaM?: number;
  /** Lote de borda: "recortado" pela divisa (área e testada mínimas) ou "ampliado" com a sobra vizinha. */
  ajuste?: "recortado" | "ampliado";
  /** Área pública / não parcelável: "sobra" (peça irregular/remanescente) ou "lote" (lote inteiro convertido). */
  origem?: "sobra" | "lote";
  /** Furos da peça (anéis internos), [lng, lat]. */
  furos?: Position[][];
  /** Peça de área restrita desenhada pelo contorno real (APP, faixa…): não é sobra do desenho. */
  restricao?: TipoRestricaoGeo;
}

// ─── Restrições com geometria (S-I) ─────────────────────────────────────────

/** Tipos de área restrita que podem vir com o contorno (mapa do Terreno, levantamento). */
export type TipoRestricaoGeo = "app" | "supressao_vegetal" | "faixa_transmissao" | "faixa_servidao" | "outras";

export const ROTULO_RESTRICAO_GEO: Record<TipoRestricaoGeo, string> = {
  app: "APP", supressao_vegetal: "Vegetação a preservar", faixa_transmissao: "Faixa de transmissão", faixa_servidao: "Faixa de servidão", outras: "Não parcelável",
};

/** Campo do quadro de áreas de cada tipo (ordem = prioridade quando dois contornos se sobrepõem). */
const CAMPO_RESTRICAO_GEO: [TipoRestricaoGeo, keyof RestricoesNaoParcelaveis][] = [
  ["app", "appM2"], ["supressao_vegetal", "supressaoVegetalM2"], ["faixa_transmissao", "faixaTransmissaoM2"],
  ["faixa_servidao", "faixaServidaoM2"], ["outras", "outrasNaoParcelaveisM2"],
];

/** Área restrita com o contorno real, em [lng, lat]: polígonos no formato MultiPolygon ([contorno, ...furos][]). */
export interface RestricaoGeometrica { tipo: TipoRestricaoGeo; poligonos: Position[][][] }

export type CriterioCenario = "maior_area_vendavel" | "melhor_eficiencia_viaria" | "alternativa_distinta";

export const ROTULO_CRITERIO: Record<CriterioCenario, string> = {
  maior_area_vendavel: "Maior área vendável válida",
  melhor_eficiencia_viaria: "Melhor eficiência do sistema viário",
  alternativa_distinta: "Alternativa de implantação distinta",
};

export interface SistemaViarioCenario {
  modo: ModoSistemaViario;
  larguraM: number;
  /** Área das vias DESENHADAS (união dos corredores + balões, recortada pela poligonal). */
  areaGeometricaM2: number;
  areaInformadaM2?: number;
  diferencaM2?: number;
}

export interface CenarioMassa {
  viaLadoOposto?: boolean;
  /** Lados escolhidos para a via (quando o usuário marcou rua de cima/esquerda/direita/baixo). */
  ladosVia?: LadoGleba[];
  id: string;
  anguloVia: number;
  testadaLoteM: number;
  profundidadeLoteM: number;
  larguraViaM: number;
  tipologia?: TipologiaMassa;
  lotes: LoteGerado[];
  /** Balões de retorno do cul-de-sac, [lng, lat]. */
  vias?: Position[][];
  /** Corredores viários desenhados (anéis em [lng, lat]) — uma única geometria para desenho, quadro e unidades. */
  ruas?: Position[][];
  kpis: {
    lotesVendaveis: number;
    lotesPublicos: number;
    areaVendavelM2: number;
    areaPublicaM2: number;
    aproveitamento: number; // areaVendavel / areaGleba
    vgv: number;
  };
  quadroAreas?: QuadroAreasMassa;
  /** Motivo quando o cenário é inviável (nenhum lote vendável). */
  inviabilidade?: string | null;
  /** Limitações conhecidas do desenho (ex.: balão que não coube na poligonal). */
  limitacoes?: string[];
  /** Critério pelo qual este cenário foi escolhido (motor v2). */
  criterio?: CriterioCenario;
  criterioRotulo?: string;
  sistemaViario?: SistemaViarioCenario;
  versaoAlgoritmo?: string;
  /** Fecho de áreas (motor 3): lotes + vias + públicas + não parceláveis contra a área da gleba. */
  fechoAreas?: FechoAreas;
  /** Pontos de acesso da malha na divisa e a via existente por onde se dá a ligação (R5). */
  acessos?: AcessoCenario[];
  /** Número de áreas contínuas compostas neste cenário (KML com áreas separadas). */
  areas?: number;
  /** S-I: marca das restrições com contorno com que o cenário foi gerado (`assinaturaRestricoes`); ausente = sem contorno. */
  contornoRestricoes?: string;
}

/** Restrições não parceláveis a partir dos parâmetros (ausentes = 0). */
export function restricoesDosParametros(p: ParametrosMassa): RestricoesNaoParcelaveis {
  return {
    appM2: p.appM2 ?? 0,
    supressaoVegetalM2: p.supressaoVegetalM2 ?? 0,
    faixaTransmissaoM2: p.faixaTransmissaoM2 ?? 0,
    faixaServidaoM2: p.faixaServidaoM2 ?? 0,
    outrasNaoParcelaveisM2: p.outrasNaoParcelaveisM2 ?? 0,
  };
}

/** Destino de cada restrição nas doações (ausente = padrão). */
export function destinosDosParametros(p: ParametrosMassa): DestinosDasRestricoes {
  return {
    appM2: p.destinoApp ?? DESTINOS_PADRAO.appM2,
    supressaoVegetalM2: p.destinoSupressaoVegetal ?? DESTINOS_PADRAO.supressaoVegetalM2,
    faixaTransmissaoM2: p.destinoFaixaTransmissao ?? DESTINOS_PADRAO.faixaTransmissaoM2,
    faixaServidaoM2: p.destinoFaixaServidao ?? DESTINOS_PADRAO.faixaServidaoM2,
    outrasNaoParcelaveisM2: p.destinoOutrasNaoParcelaveis ?? DESTINOS_PADRAO.outrasNaoParcelaveisM2,
  };
}

/** Aproveitamento das áreas restritas nas doações, para uma gleba (ou área contínua) de `areaM2`. */
export function aproveitamentoDosParametros(p: ParametrosMassa, areaM2: number): AproveitamentoDasRestricoes {
  return aproveitarRestricoes(restricoesDosParametros(p), destinosDosParametros(p), areaM2, p.percentAreaVerde, p.percentInstitucional);
}

// ─── Projeção local (equiretangular) ────────────────────────────────────────

const M_POR_GRAU_LAT = 110_540;

export function criarProjecao(centro: [number, number]) {
  const [lng0, lat0] = centro;
  const mPorGrauLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return {
    paraMetros(p: Position): [number, number] {
      return [(p[0] - lng0) * mPorGrauLng, (p[1] - lat0) * M_POR_GRAU_LAT];
    },
    paraGeo(p: Position): [number, number] {
      return [lng0 + p[0] / mPorGrauLng, lat0 + p[1] / M_POR_GRAU_LAT];
    },
  };
}

// ─── Validação de parâmetros ────────────────────────────────────────────────

/**
 * Valida os parâmetros do estudo de massa antes de rodar o motor.
 * Retorna uma mensagem amigável (pt-BR) descrevendo o primeiro problema
 * encontrado, ou `null` quando os parâmetros são válidos.
 *
 * `testadaLoteM`, `profundidadeLoteM` e `comprimentoMaxQuadraM` são passos de
 * incremento em laços — zero/negativo travaria o navegador, por isso são
 * validados aqui. Também valida a compatibilidade testada × profundidade × área
 * mínima (nada é "corrigido" em silêncio).
 */
export function validarParametrosMassa(p: ParametrosMassa): string | null {
  if (!Number.isFinite(p.larguraViaM) || p.larguraViaM < 0) {
    return "Largura da via deve ser um número maior ou igual a 0.";
  }
  if (!Number.isFinite(p.testadaLoteM) || p.testadaLoteM <= 0) {
    return "Testada do lote deve ser um número maior que 0.";
  }
  if (!Number.isFinite(p.profundidadeLoteM) || p.profundidadeLoteM <= 0) {
    return "Profundidade do lote deve ser um número maior que 0.";
  }
  if (!Number.isFinite(p.loteMinimoM2) || p.loteMinimoM2 < 0) {
    return "Lote mínimo não pode ser negativo.";
  }
  // vias públicas: não há quadra nem via interna a desenhar — comprimento da quadra e largura da via não se aplicam
  if (p.tipologia !== "vias_publicas" && (!Number.isFinite(p.comprimentoMaxQuadraM) || p.comprimentoMaxQuadraM <= 0)) {
    return "Comprimento máximo da quadra deve ser um número maior que 0.";
  }
  if (!Number.isFinite(p.percentInstitucional) || p.percentInstitucional < 0 || p.percentInstitucional >= 1) {
    return "% institucional deve ser um número entre 0 e 100%.";
  }
  if (!Number.isFinite(p.percentAreaVerde) || p.percentAreaVerde < 0 || p.percentAreaVerde >= 1) {
    return "% área verde deve ser um número entre 0 e 100%.";
  }
  if (p.percentInstitucional + p.percentAreaVerde >= 1) {
    return "A soma de % institucional e % área verde deve ser menor que 100%.";
  }
  if (!Number.isFinite(p.precoM2Lote) || p.precoM2Lote <= 0) {
    return "Preço do lote (R$/m²) deve ser um número maior que 0.";
  }
  if (p.tipologia !== undefined && !TIPOLOGIAS_MASSA.some((t) => t.value === p.tipologia)) {
    return "Tipologia do cenário inválida (use grid, cul-de-sac, rua simples ou vias públicas).";
  }
  const restricoes: [keyof ParametrosMassa, string][] = [
    ["appM2", "APP"], ["supressaoVegetalM2", "Supressão vegetal"], ["faixaTransmissaoM2", "Faixa de transmissão"],
    ["faixaServidaoM2", "Faixa de servidão"], ["outrasNaoParcelaveisM2", "Outras não parceláveis"],
  ];
  for (const [k, rotulo] of restricoes) {
    const v = p[k];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
      return `${rotulo} (m²) não pode ser negativa.`;
    }
  }
  const areaLote = p.testadaLoteM * p.profundidadeLoteM;
  if (p.inverterLadoVia !== undefined && typeof p.inverterLadoVia !== "boolean") {
    return "Seleção de lado da via inválida.";
  }
  if (p.ladosVia !== undefined && (!Array.isArray(p.ladosVia) || p.ladosVia.some((l) => !LADOS_GLEBA.includes(l)))) {
    return "Lado da via inválido (use rua de cima, da esquerda, da direita ou de baixo).";
  }
  if (p.tracadoVia !== undefined && p.tracadoVia !== "reta" && p.tracadoVia !== "divisa") {
    return "Traçado da via inválido (use reta ou acompanha a divisa).";
  }
  if (p.formatoLote !== undefined && p.formatoLote !== "retangular" && p.formatoLote !== "divisa") {
    return "Formato do lote inválido (use retangular ou acompanha a divisa).";
  }
  // Lote com fundo variável (área ≥ mínima garantida pelo motor) só existe na Rua Simples; nas demais
  // tipologias o lote é retangular e testada × profundidade precisa atingir a mínima, mesmo que o
  // formato "divisa" tenha ficado salvo de uma Rua Simples anterior.
  const fundoVariavel = p.tipologia === "rua_simples" && (p.formatoLote === "divisa" || p.tracadoVia === "divisa");
  if (!fundoVariavel && areaLote + 1e-9 < p.loteMinimoM2) {
    const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    return `Testada × profundidade (${f(p.testadaLoteM)} × ${f(p.profundidadeLoteM)} m = ${f(areaLote)} m²) é menor que a área mínima do lote (${f(p.loteMinimoM2)} m²). Ajuste as dimensões ou a área mínima — o motor não altera as dimensões informadas.`;
  }
  if (p.tipologia === "rua_simples" && !(p.larguraViaM > 0)) {
    return "Rua simples exige largura da via maior que 0.";
  }
  if (p.modoSistemaViario !== undefined && p.modoSistemaViario !== "automatico" && p.modoSistemaViario !== "manual") {
    return "Modo do sistema viário inválido (use automático ou manual).";
  }
  if (p.modoSistemaViario === "manual") {
    const v = p.areaSistemaViarioM2;
    if (typeof v !== "number" || !Number.isFinite(v)) return "Informe a área do sistema viário (m²) para o modo manual.";
    if (v < 0) return "Área do sistema viário não pode ser negativa.";
  }
  return null;
}

/** Valida a área viária manual contra a gleba (precisa da área parcelável, que depende da poligonal). */
export function validarSistemaViarioManual(p: ParametrosMassa, areaParcelavelM2: number): string | null {
  if (p.modoSistemaViario !== "manual") return null;
  const v = p.areaSistemaViarioM2 ?? NaN;
  if (!Number.isFinite(v) || v < 0) return "Área do sistema viário inválida.";
  if (v > areaParcelavelM2 + 1e-6) {
    return `Área do sistema viário informada (${v.toLocaleString("pt-BR")} m²) é maior que a área disponível para parcelamento (${round2(areaParcelavelM2).toLocaleString("pt-BR")} m²).`;
  }
  return null;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

/** Raio do balão de retorno do cul-de-sac (diâmetro mínimo usual de 20 m). */
export function raioBalaoM(larguraViaM: number): number {
  return Math.max(10, larguraViaM);
}

/** PRNG determinístico (mulberry32) — mantido por compatibilidade; o motor v2 não o utiliza. */
export function criarRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dim { testada: number; profundidade: number; via: number }

// ─── Grade e cul-de-sac: malha traçada primeiro, de divisa a divisa (etapa F) ─

interface LayoutMalha {
  vias: ViaMalha[];
  baloes: BalaoMalha[];
  celulas: CelulaLote[];
  /** Ruas sem saída curtas demais para o balão de retorno. */
  semBalao: number;
  /** Cul-de-sac: há via coletora ligando as vias-tronco. */
  coletora: boolean;
}

/** Passo da malha (m) nos eixos X e Y — define o espaço de fases a explorar. */
function passosMalha(g: Dim, p: ParametrosMassa): { px: number; py: number } {
  const L = Math.max(1, Math.floor(p.comprimentoMaxQuadraM / g.testada + 1e-9)) * g.testada;
  return { px: p.tipologia === "cul_de_sac" ? 2 * L + g.via : L + g.via, py: 2 * g.profundidade + g.via };
}

/** Comprimento total do eixo y = c dentro da poligonal. */
function cordaTotal(anel: Position[], c: number): number {
  return intervalosDaCorda(anel, c).reduce((s, [a, b]) => s + (b - a), 0);
}

/**
 * Traça a malha no frame. GRADE: ruas horizontais contínuas (faixas de largura da via, de divisa a divisa) a cada
 * 2 × profundidade + via e ruas verticais a cada quadra (comprimento = múltiplo exato da testada, sem sobra de
 * ponta de quadra). CUL-DE-SAC: vias-tronco verticais de divisa a divisa, uma via coletora horizontal ligando os
 * troncos e, nas demais linhas, ruas sem saída que nascem do tronco e terminam em balão de retorno.
 * Os lotes são as células entre as vias; a frente de cada célula é a via da sua faixa.
 */
export function layoutMalha(fr: FrameAnel, g: Dim, p: ParametrosMassa, ox: number, oy: number, ruasExcluidas?: Set<string>): LayoutMalha {
  const [minX, minY, maxX, maxY] = fr.bbox;
  const t = g.testada, prof = g.profundidade, via = Math.max(0, g.via);
  const nQuadra = Math.max(1, Math.floor(p.comprimentoMaxQuadraM / t + 1e-9));
  const L = nQuadra * t;
  const cul = p.tipologia === "cul_de_sac";
  const { px: modX, py: pitch } = passosMalha(g, p);
  const vias: ViaMalha[] = [];
  const baloes: BalaoMalha[] = [];
  const celulas: CelulaLote[] = [];
  const ys: number[] = [];
  for (let y = minY + oy - pitch; y <= maxY + 1e-9; y += pitch) ys.push(y);
  const xs: number[] = [];
  for (let x = minX + ox - modX; x <= maxX + 1e-9; x += modX) xs.push(x);
  const fora = (r: Ret) => r[2] < minX || r[0] > maxX || r[3] < minY || r[1] > maxY;
  let semBalao = 0;
  let coletora = false;

  if (!cul) {
    // ruas horizontais (uma faixa contínua por linha) e verticais (uma por quadra e linha)
    const banda = new Map<number, number>();
    for (let k = 0; k <= ys.length; k++) {
      const y = minY + oy - pitch + k * pitch;
      const r: Ret = [minX - 1, y, maxX + 1, y + via];
      if (via <= 0 || fora(r) || ruasExcluidas?.has(`${k}`)) continue;
      banda.set(k, vias.push({ ret: r, chave: `${k}` }) - 1);
    }
    ys.forEach((y, k) => {
      xs.forEach((x, j) => {
        const v: Ret = [x, y + via, x + via, y + via + 2 * prof];
        if (via > 0 && !fora(v)) vias.push({ ret: v, chave: `v${k}:${j}` });
        for (const f of [0, 1] as const) {
          const yb = y + via + f * prof;
          if (yb > maxY || yb + prof < minY) continue;
          const b = banda.get(f === 0 ? k : k + 1);
          for (let i = 0; i < nQuadra; i++) {
            const xa = x + via + i * t;
            const ret: Ret = [xa, yb, xa + t, yb + prof];
            if (fora(ret)) continue;
            celulas.push({ ret, frente: f === 0 ? "S" : "N", viasFrente: b === undefined ? [] : [b], linha: k, faixa: f, segmento: j, ordem: xa });
          }
        }
      });
    });
    return { vias, baloes, celulas, semBalao, coletora };
  }

  // CUL-DE-SAC — módulo: [quadra esquerda L][tronco][quadra direita L]
  const troncos = xs.map((x) => x + L).filter((xt) => xt < maxX && xt + via > minX);
  let kc = -1;
  if (troncos.length >= 2 && via > 0) {
    let melhor = -1;
    ys.forEach((y, k) => {
      const corda = cordaTotal(fr.anel, y + via / 2);
      if (corda > melhor + 1e-9) { melhor = corda; kc = k; }
    });
    coletora = kc >= 0;
  }
  xs.forEach((x, m) => {
    const r: Ret = [x + L, minY - 1, x + L + via, maxY + 1];
    if (via > 0 && !fora(r)) vias.push({ ret: r, chave: `t${m}` });
  });
  const rBalao = raioBalaoM(via);
  // rua da linha k em cada trecho (índice da via), criada sob demanda
  const ruaDe = new Map<string, number | null>();
  let idxColetora = -1;
  const rua = (k: number, m: number, lado: 0 | 1): number | null => {
    const ch = `${k}:${2 * m + lado}`;
    if (ruaDe.has(ch)) return ruaDe.get(ch)!;
    let out: number | null = null;
    const y = minY + oy - pitch + k * pitch;
    if (via > 0 && y <= maxY && y + via >= minY && !ruasExcluidas?.has(ch)) {
      if (k === kc) {
        if (idxColetora < 0) idxColetora = vias.push({ ret: [minX - 1, y, maxX + 1, y + via], chave: `${k}` }) - 1;
        out = idxColetora;
      } else {
        const x = xs[m];
        // a rua sem saída para meia testada antes da ponta da quadra: as pontas de módulos vizinhos não se ligam
        const r: Ret = lado === 0 ? [x + t / 2, y, x + L, y + via] : [x + L + via, y, x + 2 * L + via - t / 2, y + via];
        if (!fora(r)) {
          out = vias.push({ ret: r, chave: ch }) - 1;
          if (L - t / 2 >= 2 * rBalao) {
            const cx = lado === 0 ? r[0] + rBalao : r[2] - rBalao;
            baloes.push({ cx, cy: y + via / 2, r: rBalao, via: out });
          } else semBalao++;
        }
      }
    }
    ruaDe.set(ch, out);
    return out;
  };
  ys.forEach((y, k) => {
    xs.forEach((x, m) => {
      for (const lado of [0, 1] as const) {
        const x0 = lado === 0 ? x : x + L + via;
        for (const f of [0, 1] as const) {
          const yb = y + via + f * prof;
          if (yb > maxY || yb + prof < minY) continue;
          const b = rua(f === 0 ? k : k + 1, m, lado);
          for (let i = 0; i < nQuadra; i++) {
            const xa = x0 + i * t;
            const ret: Ret = [xa, yb, xa + t, yb + prof];
            if (fora(ret)) continue;
            // numeração a partir do tronco (lado oposto ao balão)
            celulas.push({ ret, frente: f === 0 ? "S" : "N", viasFrente: b === null ? [] : [b], linha: k, faixa: f, segmento: 2 * m + lado, ordem: lado === 0 ? -xa : xa });
          }
        }
      }
    });
  });
  // garante as ruas das linhas extremas (mesmo sem célula), para o grafo
  return { vias, baloes, celulas, semBalao, coletora };
}

function limitacoesMalha(p: ParametrosMassa, lay: LayoutMalha, descartados: number): string[] {
  const out: string[] = [];
  if (p.tipologia === "cul_de_sac") {
    out.push(`Cul-de-sac simplificado: vias-tronco de divisa a divisa${lay.coletora ? " ligadas por uma via coletora" : ""}; cada rua sem saída nasce de um tronco e termina em balão de retorno (raio ${raioBalaoM(0).toLocaleString("pt-BR")} m ou a largura da via, o que for maior).`);
    if (lay.semBalao > 0) out.push(`Cul-de-sac: ${lay.semBalao} rua(s) sem saída curta(s) demais para o balão de retorno com estes parâmetros.`);
  } else {
    out.push("Grade: ruas contínuas de divisa a divisa, com lotes recortados na divisa; nenhum trecho de via fica sem ligação com a malha.");
  }
  if (descartados > 0) out.push(`${descartados} trecho(s) de via sem ligação com a malha principal ou sem lote servido foram descartados (a área deles recebeu outro destino).`);
  return out;
}

// ─── Geometria das vias (recorte + união) ───────────────────────────────────

type GeomArea = Polygon | MultiPolygon;

function areaGeomPlanar(g: GeomArea): number {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let a = 0;
  for (const rings of polys) {
    a += areaPlanar(rings[0]);
    for (let i = 1; i < rings.length; i++) a -= areaPlanar(rings[i]);
  }
  return a;
}

interface ViasCalc { aneis: Position[][]; polis: Poli[]; areaM2: number }

/** Recorta os corredores pela poligonal (com furos) e devolve os anéis desenháveis + a área da UNIÃO (sem dupla contagem). */
function viasDaImplantacao(gf: GlebaFrame, impl: ImplantacaoFrame): ViasCalc {
  const pecas: Feature<Polygon | MultiPolygon>[] = [];
  const polis: Poli[] = [];
  const add = (p: Poli) => { if (p[0].length < 4) return; polis.push(p); pecas.push(turfPolygon(p)); };
  for (const rect of impl.corredores) {
    if (rect[2] - rect[0] <= 0 || rect[3] - rect[1] <= 0) continue;
    for (const p of pecasCelula(gf, rect)) add(p);
  }
  for (const b of impl.baloes) add([b]);
  for (const p of impl.viasPoli ?? []) add(p);
  // traçado livre (via que acompanha a divisa): já recortado pela gleba externa; os furos são descontados
  for (const v of impl.viasLivres ?? []) {
    if (gf.furos.length === 0) { add([v]); continue; }
    const recorte = seguro(() => intersect(featureCollection([turfPolygon([v]), gf.turf])));
    if (recorte) for (const p of poligonosDe(recorte.geometry as Polygon | MultiPolygon)) add(p);
  }
  const aneis = polis.map((p) => p[0]);
  if (pecas.length === 0) return { aneis, polis, areaM2: 0 };
  let areaM2: number;
  try {
    const u = pecas.length === 1 ? pecas[0] : union(featureCollection(pecas));
    areaM2 = u ? areaGeomPlanar(u.geometry as GeomArea) : pecas.reduce((s, f) => s + areaGeomPlanar(f.geometry as GeomArea), 0);
  } catch {
    areaM2 = pecas.reduce((s, f) => s + areaGeomPlanar(f.geometry as GeomArea), 0);
  }
  return { aneis, polis, areaM2 };
}

function seguro<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }

/** Lotes de tipologias sem recorte próprio (via pela divisa, lados, vias públicas) não podem ficar sobre furos. */
function lotesForaDosFuros(gf: GlebaFrame, lotes: LoteFrame[], loteMinimoM2: number): LoteFrame[] {
  if (gf.furos.length === 0) return lotes;
  const out: LoteFrame[] = [];
  for (const l of lotes) {
    const bb = bboxDe([l.anel]);
    if (!gf.furosBbox.some((b) => !(b[2] < bb[0] || bb[2] < b[0] || b[3] < bb[1] || bb[3] < b[1]))) { out.push(l); continue; }
    const x = seguro(() => intersect(featureCollection([turfPolygon([l.anel]), gf.turf])));
    if (!x) continue;
    const polis = poligonosDe(x.geometry as Polygon | MultiPolygon);
    const maior = polis.reduce((m, p) => (areaPoli(p) > areaPoli(m) ? p : m), polis[0]);
    const area = maior ? areaPoli(maior) : 0;
    if (!maior || maior.length > 1 || area + 1e-9 < loteMinimoM2) continue;
    out.push({ ...l, anel: maior[0], area, profundidadeMedia: l.testada ? area / l.testada : l.profundidadeMedia });
  }
  return out;
}

// ─── Vias existentes do entorno (R5) ────────────────────────────────────────

/** Via pública mapeada no entorno (OSM), em [lng, lat]. */
export interface ViaEntorno { coords: Position[]; nome?: string | null }

interface ViaEntornoM { pts: Position[]; nome: string | null }

/** Distância máxima (m) entre o ponto de acesso na divisa e o eixo da via existente para considerar a ligação feita. */
export const DISTANCIA_MAX_ACESSO_M = 40;
/** Distância (m) da divisa até onde uma via mapeada é considerada "junto à divisa". */
const DISTANCIA_VIA_JUNTO_M = 60;

export const NOTA_ACESSO_SEM_VIA = "Acesso externo a confirmar em projeto: não há via pública mapeada junto à divisa.";

/** Tipos de via do OSM que NÃO servem de acesso de veículos a um loteamento. */
const TIPOS_SEM_ACESSO = new Set(["footway", "path", "steps", "cycleway", "bridleway", "corridor", "proposed", "construction", "elevator", "platform", "pedestrian", "raceway"]);

/** Converte a camada `osm` (vias normalizadas do Overpass) na entrada do motor, sem as vias de pedestre. */
export function viasEntornoDoOsm(vias: { geometry: { coordinates: Position[] }; properties?: { nome?: string | null; ref?: string | null; tipo?: string | null } | null }[]): ViaEntorno[] {
  return vias
    .filter((v) => Array.isArray(v?.geometry?.coordinates) && v.geometry.coordinates.length >= 2 && !TIPOS_SEM_ACESSO.has(String(v.properties?.tipo ?? "")))
    .map((v) => ({ coords: v.geometry.coordinates, nome: v.properties?.nome ?? v.properties?.ref ?? null }));
}

function distSegmento(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Distância (m) de um trecho de via à divisa: amostrado a cada 5 m ao longo do trecho (e pelos vértices da divisa). */
function distTrechoAnel(anelM: Position[], a: Position, b: Position): number {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(L / 5));
  let m = Infinity;
  for (let k = 0; k <= n; k++) {
    const p: Position = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
    if (pontoDentro(anelM, p[0], p[1])) return 0;
    m = Math.min(m, distanciaAoAnel(anelM, p));
  }
  for (const v of anelM) m = Math.min(m, distSegmento(v, a, b));
  return m;
}

function viasJuntoDaArea(vias: ViaEntornoM[], anelM: Position[]): ViaEntornoM[] {
  return vias.filter((v) => v.pts.some((p, i) => {
    const q = v.pts[i + 1];
    return q ? distTrechoAnel(anelM, p, q) <= DISTANCIA_VIA_JUNTO_M : distanciaAoAnel(anelM, p) <= DISTANCIA_VIA_JUNTO_M || pontoDentro(anelM, p[0], p[1]);
  }));
}

/** Orientações (0..180°) dos trechos das vias existentes junto à divisa, mais longos primeiro. */
function angulosDoEntorno(vias: ViaEntornoM[], anelM: Position[], max = 3): number[] {
  const itens: { ang: number; len: number }[] = [];
  for (const v of vias) {
    for (let i = 0; i < v.pts.length - 1; i++) {
      const a = v.pts[i], b = v.pts[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 5) continue;
      if (distTrechoAnel(anelM, a, b) > DISTANCIA_VIA_JUNTO_M) continue;
      let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      ang = Math.round((((ang % 180) + 180) % 180) * 2) / 2;
      itens.push({ ang, len });
    }
  }
  const soma = new Map<number, number>();
  for (const it of itens) soma.set(it.ang, (soma.get(it.ang) ?? 0) + it.len);
  const out: number[] = [];
  for (const [ang] of Array.from(soma.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    if (out.some((x) => diferencaAngular(x, ang) < 2)) continue;
    out.push(ang);
    if (out.length >= max) break;
  }
  return out;
}

interface AcessoProx { distancia: number; nome: string | null; ponto: Position }

function acessoMaisProximo(acessosM: Position[], vias: ViaEntornoM[]): AcessoProx | null {
  let melhor: AcessoProx | null = null;
  for (const a of acessosM) {
    for (const v of vias) {
      for (let i = 0; i < v.pts.length - 1; i++) {
        const d = distSegmento(a, v.pts[i], v.pts[i + 1]);
        if (!melhor || d < melhor.distancia - 1e-9) melhor = { distancia: d, nome: v.nome, ponto: a };
      }
    }
  }
  return melhor;
}

/** Acesso de um cenário (ponto na divisa) e, quando houver, a via existente por onde ele se dá. */
export interface AcessoCenario {
  /** Área contínua (1, 2, …) a que o acesso pertence. */
  area: number;
  /** Ponto do acesso na divisa, [lng, lat]. */
  ponto: Position;
  /** Ligação com via pública mapeada a até DISTANCIA_MAX_ACESSO_M do acesso. */
  viaExistente: boolean;
  /** Nome da via existente (OSM), quando houver. */
  nomeVia: string | null;
  /** Distância (m) do acesso ao eixo da via existente mais próxima (null = sem vias mapeadas). */
  distanciaM: number | null;
}

// ─── Avaliação completa de um candidato ─────────────────────────────────────

interface Ctx {
  anelGeo: Position[];
  anelM: Position[];
  furosM: Position[][];
  proj: ReturnType<typeof criarProjecao>;
  params: ParametrosMassa;
  g: Dim;
  areaGleba: number;
  naoParcelavel: number;
  areaParcelavel: number;
  restricoes: RestricoesNaoParcelaveis;
  tipologia: TipologiaMassa;
  manual: boolean;
  alvos: AlvosDestinacao;
  aproveitamento: AproveitamentoDasRestricoes;
  viasEntorno: ViaEntornoM[];
  oMalha: OpcoesMalha;
  /** Parte das restrições desenhadas pelo contorno, FORA desta área (S-I): a nota do aproveitamento sai no total. */
  externas: number;
}

interface Bruto {
  chave: string;
  angulo: number;
  fr: FrameAnel;
  gf: GlebaFrame;
  impl: ImplantacaoFrame;
  vias: ViasCalc;
  areaVendavel: number;
  nVendaveis: number;
  candidatos: number;
  divergenciaViaria: { informada: number; geometrica: number; maxPossivel?: number } | null;
  centroides: Set<string>;
  /** R1: malha conexa com acesso pela divisa (tipologias sem malha interna: true). */
  conexa: boolean;
  /** Estimativa da sobra que vira área verde ALÉM do mínimo (não é mérito: só desempata contra). */
  excessoVerde: number;
  acessosM: Position[];
  acesso: AcessoProx | null;
}

function chaveCentroide(cx: number, cy: number, q: number): string {
  return `${Math.round(cx / q)},${Math.round(cy / q)}`;
}

function tolerClViaria(informada: number, passoM2: number): number {
  return Math.max(0.05 * informada, passoM2, 1);
}

/** Acessos genéricos: pontos onde as vias desenhadas encostam na divisa externa (tipologias sem malha). */
function acessosDasVias(fr: FrameAnel, polis: Poli[]): Position[] {
  const out: Position[] = [];
  for (const p of polis) {
    const pts = p[0].filter((q) => distanciaAoAnel(fr.anel, q) < 1e-3);
    if (pts.length > 0) out.push([pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length]);
  }
  return out;
}

function avaliarImplantacao(ctx: Ctx, chave: string, gf: GlebaFrame, impl: ImplantacaoFrame, passoViarioM2: number, maxViaPossivelM2?: number): Bruto {
  const fr = gf.fr;
  const vias = viasDaImplantacao(gf, impl);
  const lotes = impl.lotes;
  const areaLotes = lotes.reduce((s, l) => s + l.area, 0);
  // estimativa para a seleção: as doações e restrições saem primeiro das sobras (R4); o que faltar sai dos lotes
  const sobraEst = Math.max(0, gf.area - vias.areaM2 - areaLotes);
  const deficit = Math.max(0, ctx.alvos.institucional + ctx.alvos.verde + ctx.alvos.naoParcelavel - sobraEst);
  const media = lotes.length > 0 ? areaLotes / lotes.length : 0;
  const areaVendavel = Math.max(0, areaLotes - deficit);
  const nVendaveis = Math.max(0, lotes.length - (media > 0 ? Math.ceil(deficit / media - 1e-9) : 0));
  let divergenciaViaria: Bruto["divergenciaViaria"] = null;
  if (ctx.manual) {
    const informada = ctx.params.areaSistemaViarioM2 ?? 0;
    if (Math.abs(vias.areaM2 - informada) > tolerClViaria(informada, passoViarioM2)) {
      divergenciaViaria = { informada, geometrica: vias.areaM2, maxPossivel: maxViaPossivelM2 };
    }
  }
  const q = Math.max(1, Math.min(ctx.g.testada, ctx.g.profundidade) / 2);
  const centroides = new Set<string>();
  for (const l of lotes) {
    const [mx, my] = rotacionar([(l.ret[0] + l.ret[2]) / 2, (l.ret[1] + l.ret[3]) / 2], fr.angulo);
    centroides.add(chaveCentroide(mx, my, q));
  }
  const acessosFrame = impl.acessos ?? (ctx.tipologia === "vias_publicas" ? [] : acessosDasVias(fr, vias.polis));
  const acessosM = acessosFrame.map((p) => rotacionar(p, fr.angulo) as Position);
  const acesso = ctx.viasEntorno.length > 0 ? acessoMaisProximo(acessosM, ctx.viasEntorno) : null;
  return {
    chave, angulo: fr.angulo, fr, gf, impl, vias, areaVendavel, nVendaveis, candidatos: impl.candidatos, divergenciaViaria, centroides,
    conexa: impl.conexa ?? true, excessoVerde: Math.max(0, sobraEst - (ctx.alvos.institucional + ctx.alvos.verde + ctx.alvos.naoParcelavel)), acessosM, acesso,
  };
}

function equivalentes(a: Bruto, b: Bruto): boolean {
  const dAng = diferencaAngular(a.angulo, b.angulo);
  const maxN = Math.max(a.nVendaveis, b.nVendaveis, 1);
  const maxV = Math.max(a.vias.areaM2, b.vias.areaM2, 1);
  if (dAng < 10 && Math.abs(a.nVendaveis - b.nVendaveis) <= Math.max(1, Math.floor(0.03 * maxN))
    && Math.abs(a.vias.areaM2 - b.vias.areaM2) / maxV <= 0.03) return true;
  let comum = 0;
  for (const k of Array.from(a.centroides)) if (b.centroides.has(k)) comum++;
  return comum / Math.max(a.centroides.size, b.centroides.size, 1) >= 0.9;
}

function compararPorVendavel(a: Bruto, b: Bruto): number {
  // só a área VENDÁVEL é mérito; área verde além do mínimo desempata contra (sobra sem frente não conta)
  return b.areaVendavel - a.areaVendavel || a.vias.areaM2 - b.vias.areaM2 || a.excessoVerde - b.excessoVerde || a.angulo - b.angulo || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0);
}

function eficienciaViaria(c: Bruto): number {
  return c.vias.areaM2 > 0 ? c.areaVendavel / c.vias.areaM2 : c.areaVendavel > 0 ? Infinity : 0;
}

// ─── Montagem do cenário de saída ───────────────────────────────────────────

/** Notas do aproveitamento das restrições nas doações; `verdeSoEmM2` = parte verde informada só em m² (sem contorno). */
function notasAproveitamento(ap: AproveitamentoDasRestricoes, verdeSoEmM2: number): string[] {
  if (!(ap.comoVerdeM2 + ap.comoInstitucionalM2 > 0.5)) return [];
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const partes = [
    ap.comoVerdeM2 > 0.5 ? `${f(ap.comoVerdeM2)} m² contam como área verde (mínimo exigido ${f(ap.exigidoVerdeM2)} m²${ap.verdeEmAreaLoteavelM2 > 0.5 ? `; faltaram ${f(ap.verdeEmAreaLoteavelM2)} m², tirados da área loteável` : "; nada foi tirado da área loteável"})` : "",
    ap.comoInstitucionalM2 > 0.5 ? `${f(ap.comoInstitucionalM2)} m² contam como área institucional (mínimo exigido ${f(ap.exigidoInstitucionalM2)} m²${ap.institucionalEmAreaLoteavelM2 > 0.5 ? `; faltaram ${f(ap.institucionalEmAreaLoteavelM2)} m², tirados da área loteável` : ""})` : "",
  ].filter(Boolean);
  const notas = [`Áreas que não podem virar lote (APP, vegetação, faixas) aproveitadas nas doações: ${partes.join("; ")}. Com isso, ${f(ap.economiaM2)} m² de área loteável deixaram de ser doados. O aproveitamento depende da legislação municipal: confirme com a prefeitura.`];
  if (verdeSoEmM2 > 0.5) notas.push("No desenho, a área verde inclui a APP e as faixas aproveitadas, que foram informadas só em m²: a posição exata delas vem do levantamento, não deste estudo.");
  return notas;
}

/** Fecho de áreas do cenário: soma de lotes + vias + áreas públicas + não parceláveis contra a área da gleba. */
export interface FechoAreas { areaGlebaM2: number; somaM2: number; diferencaM2: number }

function montarCenario(ctx: Ctx, idx: number, b: Bruto, criterio: CriterioCenario): CenarioMassa {
  const { proj, params } = ctx;
  const voltaGeo = (anel: Position[]) => anel.map((pt) => proj.paraGeo(rotacionar(pt, b.angulo)));
  const gf = b.gf;

  // destinação de TODA a gleba (R3/R4): lotes recortados/ampliados, sobras para doações e restrições
  const lotesBase = lotesForaDosFuros(gf, b.impl.lotes, params.loteMinimoM2);
  const dest = destinarSobras({
    gf, vias: b.vias.polis, ...(b.impl.viasCobertura ? { coberturaVias: b.impl.viasCobertura } : {}), lotes: lotesBase, alvos: ctx.alvos,
    areaNominalLote: ctx.g.testada * ctx.g.profundidade, loteMinimoM2: params.loteMinimoM2, frenteMinimaM: ctx.oMalha.frenteMinimaM, larguraViaM: ctx.g.via, profundidadeNominalM: ctx.g.profundidade, incorporarNaVia: !ctx.manual,
  });

  // Numeração: quadra = (linha, trecho); lotes vendáveis numerados por faixa e posição ao longo da via.
  const vendaveisFrame = dest.lotes.map((l, i) => ({ l, i }));
  const chaves = Array.from(new Set(vendaveisFrame.map((c) => `${c.l.linha}:${c.l.segmento}`)))
    .sort((x, y) => { const [la, sa] = x.split(":").map(Number); const [lb, sb] = y.split(":").map(Number); return la - lb || sa - sb; });
  const numeracao = new Map<LoteFrame, { quadra: string; numero: string }>();
  const ordenados: LoteDestinado[] = [];
  chaves.forEach((chave, qi) => {
    const daQuadra = vendaveisFrame.filter((c) => `${c.l.linha}:${c.l.segmento}` === chave)
      .sort((x, y) => x.l.faixa - y.l.faixa || x.l.ordem - y.l.ordem || x.i - y.i);
    daQuadra.forEach((c, li) => { numeracao.set(c.l, { quadra: String(qi + 1), numero: String(li + 1) }); ordenados.push(c.l); });
  });

  const lotes: LoteGerado[] = [
    ...ordenados.map((l): LoteGerado => ({
      anel: voltaGeo(l.anel),
      areaM2: round2(l.area),
      tipo: "vendavel",
      ...(numeracao.get(l) ?? {}),
      ...(l.testada !== undefined ? { testadaM: round2(l.testada), profundidadeMediaM: round2(l.profundidadeMedia ?? 0) } : {}),
      ...(l.ampliado ? { ajuste: "ampliado" as const } : l.recortado ? { ajuste: "recortado" as const } : {}),
    })),
    ...dest.pecas.map((p): LoteGerado => ({
      anel: voltaGeo(p.anel),
      ...(p.furos && p.furos.length > 0 ? { furos: p.furos.map(voltaGeo) } : {}),
      areaM2: round2(p.area),
      tipo: p.tipo,
      ...(p.uso ? { uso: p.uso } : {}),
      origem: p.origem,
    })),
  ];

  const vendaveis = lotes.filter((l) => l.tipo === "vendavel");
  const publicos = lotes.filter((l) => l.tipo === "area_publica");
  const areaVendavelM2 = round2(vendaveis.reduce((s, l) => s + l.areaM2, 0));
  const areaInstitucionalM2 = round2(publicos.filter((l) => l.uso === "institucional").reduce((s, l) => s + l.areaM2, 0));
  const areaVerdeM2 = round2(publicos.filter((l) => l.uso !== "institucional").reduce((s, l) => s + l.areaM2, 0));
  // vias desenhadas + migalhas entre a ponta da rua e a divisa incorporadas ao leito da via (destinação)
  const areaViariaGeo = round2(b.vias.areaM2 + dest.viasExtras.reduce((s, v) => s + areaPoli(v), 0));
  const informada = ctx.manual ? params.areaSistemaViarioM2 : undefined;
  const quadroAreas = calcularQuadroAreasMassa({
    areaBrutaM2: ctx.areaGleba + ctx.externas,
    restricoes: ctx.restricoes,
    aproveitamento: ctx.aproveitamento,
    areaVendavelM2,
    nLotesVendaveis: vendaveis.length,
    areaInstitucionalM2,
    areaVerdeM2,
    precoM2Lote: params.precoM2Lote,
    sistemaViarioM2: areaViariaGeo,
    modoSistemaViario: ctx.manual ? "manual" : "automatico",
    ...(informada !== undefined ? { sistemaViarioInformadoM2: informada } : {}),
  });
  const somaM2 = lotes.reduce((s, l) => s + l.areaM2, 0) + areaViariaGeo;
  // honestidade: sobra sem frente para via destinada a área verde ALÉM do mínimo exigido (ex.: fundos da Rua Simples)
  const notas = [...b.impl.limitacoes, ...dest.avisos];
  // com restrição desenhada pelo contorno, a nota do aproveitamento sai uma vez, no total da gleba (finalizarCenario)
  if (!(ctx.externas > 0)) notas.push(...notasAproveitamento(ctx.aproveitamento, ctx.aproveitamento.comoVerdeM2));
  const excessoVerde = areaVerdeM2 - ctx.alvos.verde;
  if (excessoVerde > 0.1 * ctx.areaGleba) {
    const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    const pct = ((100 * excessoVerde) / ctx.areaGleba).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    notas.push(`${f(excessoVerde)} m² (${pct}% da gleba) ficaram como área verde por falta de frente para a via desenhada, além do mínimo exigido (${f(ctx.alvos.verde)} m²). Essa área não é aproveitamento: ${ctx.tipologia === "grid" || ctx.tipologia === "cul_de_sac"
      ? (ctx.viasEntorno.length > 0
        ? "o terreno é estreito ou recortado para uma malha interna — se as divisas já dão para ruas existentes, use a tipologia Vias públicas, que abre os lotes direto para essas ruas."
        : "o terreno é estreito ou recortado para uma malha interna — experimente lote menor, via mais estreita ou, se as divisas já dão para ruas existentes, a tipologia Vias públicas.")
      : "para loteá-la, prefira Grade ou Cul-de-sac."}`);
  }

  return {
    id: `cenario-${idx + 1}`,
    anguloVia: Math.round(b.angulo * 10) / 10,
    // Parâmetros EFETIVOS = exatamente os informados (o motor não os altera).
    testadaLoteM: ctx.g.testada,
    profundidadeLoteM: ctx.g.profundidade,
    larguraViaM: ctx.g.via,
    tipologia: ctx.tipologia,
    lotes,
    vias: b.impl.baloes.map(voltaGeo),
    ruas: [...b.vias.aneis.filter((a) => !b.impl.baloes.includes(a)), ...dest.viasExtras.map((v) => v[0])].map(voltaGeo),
    kpis: {
      lotesVendaveis: vendaveis.length,
      lotesPublicos: publicos.length,
      areaVendavelM2,
      areaPublicaM2: round2(areaInstitucionalM2 + areaVerdeM2),
      aproveitamento: ctx.areaGleba > 0 ? areaVendavelM2 / ctx.areaGleba : 0,
      vgv: Math.round(areaVendavelM2 * params.precoM2Lote),
    },
    quadroAreas,
    inviabilidade: motivoInviabilidade(vendaveis.length, b.candidatos, quadroAreas, ctx.g, params),
    limitacoes: notas,
    criterio,
    criterioRotulo: ROTULO_CRITERIO[criterio],
    sistemaViario: {
      modo: ctx.manual ? "manual" : "automatico",
      larguraM: ctx.g.via,
      areaGeometricaM2: areaViariaGeo,
      ...(informada !== undefined ? { areaInformadaM2: informada, diferencaM2: round2(areaViariaGeo - informada) } : {}),
    },
    fechoAreas: { areaGlebaM2: round2(ctx.areaGleba), somaM2: round2(somaM2), diferencaM2: round2(ctx.areaGleba - somaM2) },
    versaoAlgoritmo: VERSAO_ALGORITMO_MASSA,
  };
}

/** Motivo de inviabilidade de um cenário (null quando há lote vendável). */
export function motivoInviabilidade(
  lotesVendaveis: number,
  candidatos: number,
  quadro: Pick<QuadroAreasMassa, "areaParcelavelM2">,
  g: { testada: number; profundidade: number; via: number },
  p: Pick<ParametrosMassa, "loteMinimoM2">
): string | null {
  if (lotesVendaveis > 0) return null;
  if (quadro.areaParcelavelM2 <= 0) return "Inviável: as áreas não parceláveis ocupam toda a gleba — não há área parcelável.";
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (candidatos === 0) {
    return `Inviável: nenhum lote de ${f(g.testada)} × ${f(g.profundidade)} m (mínimo ${f(p.loteMinimoM2)} m²) coube na poligonal com vias de ${f(g.via)} m. Reduza testada, profundidade, lote mínimo ou largura da via.`;
  }
  return "Inviável: todos os lotes gerados foram consumidos pelas doações (institucional e área verde) e pelas áreas não parceláveis.";
}

// ─── Diagnóstico verificável de inviabilidade ───────────────────────────────

/** Causas verificáveis (com números) de a poligonal não comportar o parcelamento solicitado. */
export function diagnosticarInviabilidade(anelM: Position[], params: ParametrosMassa, areaParcelavelM2: number): string[] {
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const causas: string[] = [];
  const t = params.testadaLoteM, p = params.profundidadeLoteM, w = params.larguraViaM;
  const tip = params.tipologia ?? "grid";
  const area = areaPlanar(anelM);
  if (areaParcelavelM2 <= 0) {
    causas.push("Restrição ambiental/legal: as áreas não parceláveis informadas ocupam toda a gleba.");
    return causas;
  }
  if (area < t * p) {
    causas.push(`Área insuficiente: a gleba tem ${f(area)} m² e um lote de ${f(t)} × ${f(p)} m exige ${f(t * p)} m².`);
  }
  const env = menorLarguraEnvelope(anelM);
  const maiorLado = Math.max(t, p), menorLado = Math.min(t, p);
  if (env.larguraM < menorLado) {
    causas.push(`Largura insuficiente: a menor dimensão da gleba (envelope girado a ${f(env.anguloGraus)}°) é ${f(env.larguraM)} m, menor que o menor lado do lote (${f(menorLado)} m).`);
  } else if (env.larguraM < maiorLado && env.comprimentoM < maiorLado) {
    causas.push(`Geometria: nenhuma dimensão da gleba (${f(env.larguraM)} × ${f(env.comprimentoM)} m) comporta o maior lado do lote (${f(maiorLado)} m).`);
  }
  // lote isolado cabe em alguma orientação?
  const celula = Math.max(t, p) * 2;
  let cabeIsolado = false;
  const angs = new Set<number>(angulosDasArestas(anelM, 20));
  for (let a = 0; a < 180; a += 5) angs.add(a);
  outer: for (const ang of Array.from(angs).sort((x, y) => x - y)) {
    const fr = prepararFrameAnel(anelM, ang, celula);
    const passo = Math.max(1, Math.min(t, p) / 2);
    for (let y = fr.bbox[1]; y + p <= fr.bbox[3] + 1e-9; y += passo) {
      for (let x = fr.bbox[0]; x + t <= fr.bbox[2] + 1e-9; x += passo) {
        if (retanguloDentro(fr.ind, [x, y, x + t, y + p])) { cabeIsolado = true; break outer; }
      }
    }
  }
  if (!cabeIsolado) {
    causas.push(`Profundidade/testada: nenhum retângulo de ${f(t)} × ${f(p)} m cabe inteiro na poligonal em nenhuma das orientações testadas (varredura a cada 5° e pelas arestas), mesmo sem vias.`);
  } else {
    causas.push(`O lote de ${f(t)} × ${f(p)} m cabe isoladamente, mas não com a via de ${f(w)} m: ${tip === "rua_simples" ? "a via (corredor reto) com lotes de um ou dos dois lados" : "a malha (via + quadra de 2 × profundidade)"} não encontrou posição que comporte nenhum lote completo.`);
    if (tip === "rua_simples") causas.push("Acesso/geometria: a via precisa começar no limite da gleba e correr dentro dela por ao menos uma testada com o corredor inteiro dentro da poligonal.");
    else causas.push(`Via inviável: a faixa mínima "via + 2 lotes" exige ${f(w + 2 * p)} m de largura livre; a menor dimensão da gleba é ${f(env.larguraM)} m.`);
  }
  if (params.modoSistemaViario === "manual") {
    causas.push(`Área viária manual (${f(params.areaSistemaViarioM2 ?? 0)} m²) pode ser incompatível com a geometria — teste o modo automático para comparar.`);
  }
  return causas;
}

// ─── Assinatura das entradas (cache / auditoria) ────────────────────────────

function fnv1a(texto: string, semente: number): string {
  let h = semente >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Texto canônico das restrições com contorno (entra nas assinaturas); vazio sem restrição. */
function textoRestricoes(restricoes: RestricaoGeometrica[] | null | undefined): string {
  const anel = (a: Position[]) => (Array.isArray(a) ? a : []).map((p) => `${Number(p?.[0]).toFixed(9)},${Number(p?.[1]).toFixed(9)}`).join(";");
  return (restricoes ?? []).filter((r) => r && Array.isArray(r.poligonos))
    .map((r) => `${r.tipo}:${r.poligonos.map((poli) => (Array.isArray(poli) ? poli : []).map(anel).join("/")).join("|")}`).join("~");
}

/**
 * Marca das restrições com contorno usadas num estudo (S-I): fica em cada cenário gerado (`contornoRestricoes`) para a
 * tela saber se os cenários na tela foram gerados com o contorno guardado hoje. Vazia sem restrição.
 */
export function assinaturaRestricoes(restricoes: RestricaoGeometrica[] | null | undefined): string {
  const t = textoRestricoes(restricoes);
  return t ? `${fnv1a(t, 2166136261)}${fnv1a(t, 0x9e3779b1)}` : "";
}

/** Gleba de entrada: um anel (área única) ou várias áreas contínuas, cada uma [contorno, ...furos] (MultiPolygon). */
export type EntradaGleba = Position[] | Position[][][];

function ehAnelUnico(e: EntradaGleba): e is Position[] {
  return Array.isArray(e) && e.length > 0 && Array.isArray(e[0]) && typeof (e[0] as unknown[])[0] === "number";
}

/** Normaliza a entrada em áreas contínuas: [[contorno, ...furos], ...]. */
export function areasDaEntrada(e: EntradaGleba): Position[][][] {
  if (!Array.isArray(e) || e.length === 0) return [];
  return ehAnelUnico(e) ? [[e]] : (e as Position[][][]).filter((p) => Array.isArray(p) && p.length > 0);
}

/**
 * Assinatura estável de poligonal(is) + parâmetros + vias do entorno + versão do algoritmo. Igual ⇒ resultado igual.
 * As vias do entorno entram porque mudam a escolha do acesso (R5); o contorno das áreas restritas, porque muda o desenho.
 */
export function assinaturaEntradas(entrada: EntradaGleba, params: ParametrosMassa, viasEntorno?: ViaEntorno[] | null, restricoes?: RestricaoGeometrica[] | null): string {
  const anel = (a: Position[]) => a.map((p) => `${p[0].toFixed(9)},${p[1].toFixed(9)}`).join(";");
  const coords = ehAnelUnico(entrada) ? anel(entrada) : areasDaEntrada(entrada).map((poli) => poli.map(anel).join("/")).join("|");
  const chaves = Object.keys(params).sort() as (keyof ParametrosMassa)[];
  const ps = chaves.filter((k) => params[k] !== undefined).map((k) => `${k}=${String(params[k])}`).join("|");
  const vias = (viasEntorno ?? []).map((v) => `${v.nome ?? ""}:${v.coords.map((p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`).join(";")}`).join("~");
  const restr = textoRestricoes(restricoes);
  const base = `${VERSAO_ALGORITMO_MASSA}#${ps}#${coords}${vias ? `#vias:${vias}` : ""}${restr ? `#restricoes:${restr}` : ""}`;
  return `${fnv1a(base, 2166136261)}${fnv1a(base, 0x9e3779b1)}`;
}

// ─── Recorte das restrições com contorno (S-I) ──────────────────────────────

/** Área contínua a lotear: contorno + furos, [lng, lat], e a área líquida (m²). */
interface AreaEfetiva { anel: Position[]; furos: Position[][]; areaM2: number }

interface PecaRestricao { tipo: TipoRestricaoGeo; campo: keyof RestricoesNaoParcelaveis; anel: Position[]; furos: Position[][]; areaM2: number }

interface RecorteRestricoes {
  /** Partes da gleba fora das restrições, que recebem lotes e vias. */
  areas: AreaEfetiva[];
  /** Partes fora das restrições menores que o lote mínimo (ou de traçado inválido): ficam como área verde. */
  retalhos: AreaEfetiva[];
  /** Restrições recortadas pela gleba, sem sobreposição entre elas (vale a ordem de CAMPO_RESTRICAO_GEO). */
  pecas: PecaRestricao[];
  /** m² de cada restrição com contorno, medido no contorno recortado (substitui o m² dos parâmetros). */
  m2PorCampo: Partial<RestricoesNaoParcelaveis>;
  /** Tipos cujo contorno é vazio, inválido ou não cai na gleba: continuam com o m² informado. */
  foraDoTerreno: TipoRestricaoGeo[];
}

/**
 * Tira da gleba as restrições com contorno: devolve as partes loteáveis (cada uma vira uma área contínua do motor,
 * como num KML com várias áreas), as peças das restrições na posição real e o m² de cada uma. Tudo no plano local
 * (mesma projeção do motor); null quando o recorte falha (o motor volta a usar só o m²).
 */
function recortarRestricoes(
  areas: Position[][][], furosValidos: Position[][][], restricoes: RestricaoGeometrica[], proj: ReturnType<typeof criarProjecao>, loteMinimoM2: number,
): RecorteRestricoes | null {
  const emMetros = (anel: Position[]): Position[] | null => {
    if (!Array.isArray(anel) || anel.length < 3) return null;
    const m = anel.map((p) => (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? (proj.paraMetros(p) as Position) : null));
    if (m.some((p) => !p)) return null;
    const a = m as Position[];
    if (a[0][0] !== a[a.length - 1][0] || a[0][1] !== a[a.length - 1][1]) a.push(a[0]);
    else a[a.length - 1] = a[0];
    return a.length >= 4 ? a : null;
  };
  const emGeo = (anel: Position[]): Position[] => { const g = anel.map((p) => proj.paraGeo(p) as Position); g[g.length - 1] = g[0]; return g; };
  try {
    const glebas = areas.map((poli, i) => turfPolygon([emMetros(poli[0])!, ...furosValidos[i].map((f) => emMetros(f)!)]));
    const pecas: PecaRestricao[] = [];
    const m2PorCampo: Partial<RestricoesNaoParcelaveis> = {};
    const foraDoTerreno: TipoRestricaoGeo[] = [];
    let ocupado: Feature<Polygon | MultiPolygon> | null = null;
    for (const [tipo, campo] of CAMPO_RESTRICAO_GEO) {
      const lista = restricoes.filter((r) => r?.tipo === tipo && Array.isArray(r.poligonos));
      if (lista.length === 0) continue;
      const polis: Feature<Polygon>[] = [];
      for (const r of lista) {
        for (const poli of r.poligonos) {
          if (!Array.isArray(poli) || poli.length === 0) continue;
          const externo = emMetros(poli[0]);
          if (!externo || areaPlanar(externo) <= 0) continue;
          const furos = poli.slice(1).map(emMetros).filter((f): f is Position[] => !!f && areaPlanar(f) > 0);
          polis.push(turfPolygon([externo, ...furos]));
        }
      }
      const u = polis.length === 0 ? null : (polis.length === 1 ? polis[0] : union(featureCollection(polis))) as Feature<Polygon | MultiPolygon> | null;
      // contorno vazio, inválido ou fora da gleba: não zera a restrição em silêncio — vale o m² informado (com aviso)
      const dentro = u ? glebas.map((gl) => intersect(featureCollection([gl, u])) as Feature<Polygon | MultiPolygon> | null) : [];
      if (!u || dentro.reduce((t, x) => t + (x ? poligonosDe(x.geometry).reduce((q, p) => q + areaPoli(p), 0) : 0), 0) < 0.5) {
        foraDoTerreno.push(tipo);
        continue;
      }
      m2PorCampo[campo] = 0;
      dentro.forEach((x0) => {
        let x = x0;
        if (x && ocupado) x = difference(featureCollection([x, ocupado])) as Feature<Polygon | MultiPolygon> | null;
        if (!x) return;
        for (const p of poligonosDe(x.geometry)) {
          const a = areaPoli(p);
          if (a <= 1e-6) continue;
          pecas.push({ tipo, campo, anel: emGeo(p[0]), furos: p.slice(1).map(emGeo), areaM2: a });
          m2PorCampo[campo] = (m2PorCampo[campo] ?? 0) + a;
        }
      });
      ocupado = ocupado ? (union(featureCollection([ocupado, u])) as Feature<Polygon | MultiPolygon> | null) ?? ocupado : u;
    }
    const livres: AreaEfetiva[] = [], retalhos: AreaEfetiva[] = [];
    glebas.forEach((gl) => {
      const resto = ocupado ? (difference(featureCollection([gl, ocupado])) as Feature<Polygon | MultiPolygon> | null) : gl;
      if (!resto) return;
      // maiores primeiro (ordem determinística: a mesma entrada dá a mesma numeração das áreas)
      const partes = poligonosDe(resto.geometry).map((p) => ({ p, a: areaPoli(p) })).filter((x) => x.a > 1e-6).sort((x, y) => y.a - x.a);
      for (const { p, a } of partes) {
        const ef: AreaEfetiva = { anel: emGeo(p[0]), furos: p.slice(1).map(emGeo), areaM2: a };
        if (a + 1e-9 < Math.max(loteMinimoM2, 1) || validarPoligonal(ef.anel)) retalhos.push(ef); else livres.push(ef);
      }
    });
    return { areas: livres, retalhos, pecas, m2PorCampo, foraDoTerreno };
  } catch {
    return null;
  }
}

/**
 * m² de cada restrição com contorno DENTRO da gleba, medido como o motor mede (mesma projeção e recorte) — para a
 * tela mostrar o mesmo número que o quadro de áreas. 0 = o contorno não cai na gleba (o motor usa o m² informado).
 */
export function medirRestricoesNaGleba(entrada: EntradaGleba, centro: [number, number], restricoes: RestricaoGeometrica[]): Partial<Record<TipoRestricaoGeo, number>> {
  const out: Partial<Record<TipoRestricaoGeo, number>> = {};
  for (const r of restricoes) if (r) out[r.tipo] = 0;
  const areas = areasDaEntrada(entrada).filter((poli) => !validarPoligonal(poli[0]));
  if (areas.length === 0 || restricoes.length === 0) return out;
  const furos = areas.map((poli) => poli.slice(1).filter((f) => !validarPoligonal(f)));
  const rec = recortarRestricoes(areas, furos, restricoes, criarProjecao(centro), 0);
  if (!rec) return out;
  for (const [tipo, campo] of CAMPO_RESTRICAO_GEO) if (rec.m2PorCampo[campo] !== undefined) out[tipo] = round2(rec.m2PorCampo[campo]!);
  return out;
}

/** Situação da APP do estudo na aba Estudo de Massa (S-I) — decide o aviso da tela. */
export type EstadoContornoApp =
  | "contorno"               // contorno guardado, cai no terreno, cenários na tela gerados com ele
  | "cenarios_sem_contorno"  // há contorno, mas os cenários na tela foram gerados sem ele (ou com outro): gerar de novo
  | "fora_do_terreno"        // contorno guardado não cai neste terreno: o motor usa o m² informado
  | "sem_contorno"           // há APP em m² mas nenhum contorno guardado: abrir o mapa do Terreno
  | null;                    // sem APP

export function estadoDoContornoApp(e: {
  restricoes: RestricaoGeometrica[] | null; appAreaM2: number | null | undefined; appNaGlebaM2: number | null | undefined; cenarios: Pick<CenarioMassa, "contornoRestricoes">[];
}): EstadoContornoApp {
  if (!e.restricoes || e.restricoes.length === 0) return (e.appAreaM2 ?? 0) > 0 ? "sem_contorno" : null;
  if (!((e.appNaGlebaM2 ?? 0) > 0)) return "fora_do_terreno";
  const marca = assinaturaRestricoes(e.restricoes);
  return e.cenarios.every((c) => c.contornoRestricoes === marca) ? "contorno" : "cenarios_sem_contorno";
}

// ─── Orquestrador ───────────────────────────────────────────────────────────

export interface OpcoesGeracao {
  /** Quantidade máxima de cenários (padrão 3). */
  nCenarios?: number;
  /** Legados do algoritmo genético — IGNORADOS (o motor v2 é determinístico). */
  populacao?: number;
  geracoes?: number;
  seed?: number;
  /** Progresso real (0..1) e etapa corrente — usado pelo indicador de processamento. */
  onProgress?: (fracao: number, etapa: string) => void;
  /** Vias públicas existentes no entorno (OSM), [lng, lat] — opcionais (R5). */
  viasEntorno?: ViaEntorno[] | null;
  /**
   * Áreas restritas com o contorno real (S-I). Cada uma sai da área loteável pelo contorno (nenhum lote nem via
   * dentro dela) e entra no desenho na posição real, com o destino escolhido; o m² dela vem do contorno recortado
   * pela gleba, no lugar do valor em m² dos parâmetros.
   */
  restricoes?: RestricaoGeometrica[] | null;
}

export interface EstudoMassaGerado {
  versaoAlgoritmo: string;
  assinatura: string;
  cenarios: CenarioMassa[];
  /** Preenchido quando nenhum cenário válido existe: motivo + causas verificáveis. */
  inviabilidade: { motivo: string; causas: string[] } | null;
  avisos: string[];
  candidatosAvaliados: number;
  tipologia: TipologiaMassa;
  /** Número de áreas contínuas da gleba (KML com áreas separadas). */
  areas?: number;
}

function vazio(tipologia: TipologiaMassa, assinatura: string, motivo: string, causas: string[] = []): EstudoMassaGerado {
  return { versaoAlgoritmo: VERSAO_ALGORITMO_MASSA, assinatura, cenarios: [], inviabilidade: { motivo, causas }, avisos: [], candidatosAvaliados: 0, tipologia };
}

interface ResultadoArea {
  cenarios: (CenarioMassa & { acessosArea?: { ponto: Position; acesso: AcessoProx | null; naApp?: boolean }[] })[];
  inviabilidade: { motivo: string; causas: string[] } | null;
  avisos: string[];
  candidatosAvaliados: number;
  /** Tem dados de vias junto à divisa desta área. */
  temViasJunto: boolean;
  /**
   * S-I: situação da área frente às restrições desenhadas — "ilha" (cercada por elas, sem divisa real), "alem" (as vias
   * mapeadas junto à gleba ficam do outro lado da restrição) ou ausente.
   */
  isolamento?: "ilha" | "alem";
}

interface EntradaArea {
  anelGeo: Position[];
  furosGeo: Position[][];
  centro: [number, number];
  /** Parâmetros desta área (restrições em m² e área viária manual já repartidas pela área). */
  params: ParametrosMassa;
  tipologia: TipologiaMassa;
  nCen: number;
  progresso: (f: number, etapa: string) => void;
  viasEntornoM: ViaEntornoM[];
  /** S-I: anéis da divisa REAL da gleba (metros): o que não está nela é borda de área restrita, não divisa. */
  divisaReal?: Position[][];
  /** S-I: a gleba inteira tem vias mapeadas junto à divisa. */
  glebaTemViasJunto?: boolean;
  /**
   * S-I: parte (m²) das restrições desenhadas pelo contorno que cabe a esta área, mas fica FORA dela (já recortada).
   * Entra na conta das doações (o mínimo é sobre a área parcelável da gleba) e não é tirada de novo da área.
   */
  externas?: RestricoesNaoParcelaveis;
}

/** Quanto das restrições externas vai para cada destino (verde / institucional / só não parcelável). */
function externasPorDestino(ext: RestricoesNaoParcelaveis, destinos: DestinosDasRestricoes): { verde: number; institucional: number; nenhum: number } {
  const out = { verde: 0, institucional: 0, nenhum: 0 };
  for (const [, k] of CAMPO_RESTRICAO_GEO) {
    const v = Math.max(0, ext[k] || 0);
    if (destinos[k] === "verde") out.verde += v; else if (destinos[k] === "institucional") out.institucional += v; else out.nenhum += v;
  }
  return out;
}

/** Motor de UMA área contínua (com furos): devolve até nCen cenários distintos e válidos, ou o motivo. */
function estudoDaArea(e: EntradaArea): ResultadoArea {
  const { params, tipologia, nCen, progresso } = e;
  const falha = (motivo: string, causas: string[] = [], avaliados = 0): ResultadoArea => ({ cenarios: [], inviabilidade: { motivo, causas }, avisos: [], candidatosAvaliados: avaliados, temViasJunto: false });

  progresso(0.02, "Projetando a poligonal");
  const proj = criarProjecao(e.centro);
  const anelM = e.anelGeo.map((p) => proj.paraMetros(p));
  anelM[anelM.length - 1] = anelM[0];
  const furosM = e.furosGeo.map((f) => { const m = f.map((p) => proj.paraMetros(p)); m[m.length - 1] = m[0]; return m; });
  const areaGleba = areaPlanar(anelM) - furosM.reduce((s, f) => s + areaPlanar(f), 0);
  const restricoes = restricoesDosParametros(params);
  const externas = e.externas ? totalRestricoes(e.externas) : 0;
  const naoParcelavel = Math.min(Math.max(0, totalRestricoes(restricoes) - externas), areaGleba);
  const areaParcelavel = Math.max(0, areaGleba - naoParcelavel);
  // com restrição desenhada fora da área, a conta das doações vale para a área + a parte dela que ficou de fora
  const aproveitamento = aproveitamentoDosParametros(params, areaGleba + externas);
  const fora = e.externas ? externasPorDestino(e.externas, destinosDosParametros(params)) : { verde: 0, institucional: 0, nenhum: 0 };
  const manual = params.modoSistemaViario === "manual";

  const g: Dim = { testada: params.testadaLoteM, profundidade: params.profundidadeLoteM, via: params.larguraViaM };
  const viasJunto = viasJuntoDaArea(e.viasEntornoM, anelM);
  const oMalha: OpcoesMalha = { loteMinimoM2: params.loteMinimoM2, frenteMinimaM: frenteMinimaPara(g.testada), larguraViaM: g.via };
  const ctx: Ctx = {
    anelGeo: e.anelGeo, anelM, furosM, proj, params: { ...params, tipologia }, g, areaGleba, naoParcelavel, areaParcelavel, restricoes, tipologia, manual,
    // As restrições aproveitadas entram no alvo da área verde/institucional (e são desenhadas como tal); só as
    // sem aproveitamento ficam como "não parcelável". Da terra loteável sai apenas o complemento de cada mínimo.
    // A restrição desenhada pelo contorno já está no desenho (fora desta área): sai do alvo, não da terra loteável.
    alvos: e.externas
      ? {
        institucional: Math.max(0, aproveitamento.alvoInstitucionalM2 - fora.institucional), verde: Math.max(0, aproveitamento.alvoVerdeM2 - fora.verde),
        naoParcelavel: Math.min(Math.max(0, aproveitamento.semAproveitamentoM2 - fora.nenhum), areaGleba),
      }
      : { institucional: aproveitamento.alvoInstitucionalM2, verde: aproveitamento.alvoVerdeM2, naoParcelavel: Math.min(aproveitamento.semAproveitamentoM2, areaGleba) },
    aproveitamento,
    viasEntorno: viasJunto, oMalha, externas,
  };

  if (areaParcelavel <= 0) {
    return falha("Inviável: as áreas não parceláveis ocupam toda a gleba — não há área parcelável.", diagnosticarInviabilidade(anelM, ctx.params, areaParcelavel));
  }

  const angulosVias = angulosDoEntorno(viasJunto, anelM);
  const gfDe = (fr: FrameAnel) => prepararGlebaFrame(fr, furosM);
  const brutos: Bruto[] = [];
  let avaliados = 0;
  const avisos: string[] = [];
  // ordem canônica dos lados (a assinatura e os cartões não dependem da ordem dos cliques)
  const ladosVia = tipologia === "rua_simples" && params.tracadoVia === "divisa" && (params.ladosVia?.length ?? 0) > 0
    ? LADOS_GLEBA.filter((l) => params.ladosVia!.includes(l)) : null;
  const inverterVia = !ladosVia && tipologia === "rua_simples" && params.tracadoVia === "divisa" && params.inverterLadoVia === true;
  const arestasPorImplantacao = new Map<string, number[]>();
  const limiteCandidatosVia = 12;

  if (tipologia === "vias_publicas") {
    progresso(0.1, "Desmembrando os lotes com frente para as vias públicas");
    const impls = buscarViasPublicas(anelM, { testada: g.testada, profundidade: g.profundidade, loteMinimoM2: params.loteMinimoM2 }, 4,
      (f) => progresso(0.1 + 0.8 * f, "Desmembrando os lotes com frente para as vias públicas"));
    avaliados = impls.length;
    const gf0 = gfDe(prepararFrameAnel(anelM, 0, Math.max(g.testada, g.profundidade) * 2));
    impls.forEach((impl) => brutos.push(avaliarImplantacao(ctx, impl.chave, gf0, impl, 1)));
    if (impls.length === 0) {
      return falha("Nenhum lote viável com frente para as vias públicas existentes.",
        ["Confira a testada, a profundidade e a área mínima do lote frente ao tamanho das divisas da gleba."]);
    }
  } else if (ladosVia) {
    progresso(0.1, "Traçando a via nos lados escolhidos");
    const impls = buscarPorLados(anelM, ladosVia, { testada: g.testada, profundidade: g.profundidade, via: g.via, loteMinimoM2: params.loteMinimoM2 }, 6,
      (f) => progresso(0.1 + 0.5 * f, "Implantando os lotes com frente exata e fundo variável"));
    avaliados = impls.length;
    const gf0 = gfDe(prepararFrameAnel(anelM, 0, Math.max(g.testada, g.profundidade, g.via) * 2));
    impls.forEach((impl, i) => {
      brutos.push(avaliarImplantacao(ctx, impl.chave, gf0, impl, Math.max(g.via * g.testada, 1)));
      progresso(0.6 + 0.3 * ((i + 1) / impls.length), "Avaliando implantações candidatas");
    });
    if (impls.length === 0) {
      return falha("Nenhum lote viável com a via somente nos lados escolhidos.",
        ["Confira a largura da via, a testada e a área mínima, ou marque outro lado para a rua."]);
    }
  } else if (tipologia === "rua_simples" && params.tracadoVia === "divisa") {
    progresso(0.1, "Traçando a via pela divisa");
    const lim = manual ? (params.areaSistemaViarioM2 ?? 0) / Math.max(g.via, 1e-9) : undefined;
    const impls = buscarViaDivisa(anelM, { testada: g.testada, profundidade: g.profundidade, via: g.via, loteMinimoM2: params.loteMinimoM2, limiteComprimentoM: lim }, inverterVia ? Infinity : limiteCandidatosVia,
      (f) => progresso(0.1 + 0.5 * f, "Traçando a via pela divisa e implantando os lotes"));
    avaliados = impls.length;
    const gf0 = gfDe(prepararFrameAnel(anelM, 0, Math.max(g.testada, g.profundidade, g.via) * 2));
    impls.forEach((impl, i) => {
      arestasPorImplantacao.set(impl.chave, impl.arestasDivisa);
      brutos.push(avaliarImplantacao(ctx, impl.chave, gf0, impl, Math.max(g.via * g.testada, 1)));
      progresso(0.6 + 0.3 * ((i + 1) / impls.length), "Avaliando implantações candidatas");
    });
  } else if (tipologia === "rua_simples") {
    const passoPeca = g.via * g.testada;
    const limitePecas = manual ? Math.max(1, Math.round((params.areaSistemaViarioM2 ?? 0) / Math.max(passoPeca, 1e-9))) : undefined;
    const formatoRua = params.formatoLote === "divisa" ? { formato: "divisa" as const, loteMinimoM2: params.loteMinimoM2 } : { loteMinimoM2: params.loteMinimoM2 };
    const base = { ...formatoRua, furosM, angulosExtras: [...angulosVias, ...angulosVias.map((a) => Math.round(((a + 90) % 180) * 1000) / 1000)] };
    const opcoesRua = manual ? { limitePecas, aparar: false, ...base } : base;
    progresso(0.1, "Varrendo orientações e posições da via");
    const cands: CandidatoRua[] = buscarRuaSimples(anelM, g, opcoesRua, 24);
    avaliados = cands.length;
    progresso(0.6, "Avaliando implantações candidatas");
    cands.forEach((cand, i) => {
      const { fr, impl } = implantacaoDoCandidatoRua(anelM, cand, g, opcoesRua);
      const gf = gfDe(fr);
      let implFinal: ImplantacaoFrame = impl;
      if (impl.celulas && impl.viaRet) {
        // formato retangular: recorte exato pela divisa e testada medida sobre a via (malha conectada)
        const r = processarMalha(gf, [{ ret: impl.viaRet }], [], impl.celulas, oMalha);
        implFinal = {
          ...impl, lotes: r.lotes, corredores: [], viasPoli: r.vias, viasCobertura: r.coberturaVias, conexa: r.conexa, acessos: r.acessos, candidatos: r.candidatos,
          trechosDescartados: r.trechosDescartados,
        };
      }
      const maxVia = impl.pecasPossiveis * passoPeca;
      brutos.push(avaliarImplantacao(ctx, `${cand.angulo}|${cand.c}|${cand.fase}|${cand.ancora}|${cand.intervalo[0].toFixed(3)}`, gf, implFinal, passoPeca / 2, maxVia));
      progresso(0.6 + 0.3 * ((i + 1) / cands.length), "Avaliando implantações candidatas");
    });
  } else {
    // AJUSTE DA MALHA (modo manual da área viária): além do comprimento máximo informado, testa
    // quadras mais curtas (mais ruas transversais → mais via) e, se ainda sobrar via, suprime ruas
    // horizontais de menor aproveitamento (menos via). Nunca passa do comprimento máximo informado.
    const nMax = Math.max(1, Math.floor(params.comprimentoMaxQuadraM / g.testada + 1e-9));
    const variantesN = manual
      ? Array.from(new Set([nMax, Math.round(nMax * 0.75), Math.round(nMax / 2), Math.round(nMax / 3), Math.round(nMax / 4), 2]))
        .filter((n) => n >= 1 && n <= nMax).sort((a, b) => b - a)
      : [nMax];
    const alvo = params.areaSistemaViarioM2 ?? 0;
    const tolV = tolerClViaria(alvo, Math.max(g.via * g.testada, 1));
    variantesN.forEach((nLotesQuadra, vi) => {
      const compVar = nLotesQuadra === nMax ? params.comprimentoMaxQuadraM : nLotesQuadra * g.testada + 1e-6;
      const pz: ParametrosMassa = { ...ctx.params, comprimentoMaxQuadraM: compVar };
      const base = vi / variantesN.length, faixaP = 1 / variantesN.length;
      const prog = (f: number, etapa: string) => progresso(base + faixaP * f * 0.9, etapa);
      const celula = Math.max(g.testada, g.profundidade, g.via, compVar / 4) * 2;
      const frames = new Map<number, GlebaFrame>();
      const frameDe = (ang: number) => { let f = frames.get(ang); if (!f) { f = gfDe(prepararFrameAnel(anelM, ang, celula)); frames.set(ang, f); } return f; };
      const { px, py } = passosMalha(g, pz);
      interface Av { ang: number; ox: number; oy: number; n: number; area: number }
      const avs: Av[] = [];
      const vistos = new Set<string>();
      const avaliar = (ang: number, ox: number, oy: number) => {
        const chave = `${ang}|${ox.toFixed(4)}|${oy.toFixed(4)}`;
        if (vistos.has(chave)) return;
        vistos.add(chave);
        const gf = frameDe(ang);
        const lay = layoutMalha(gf.fr, g, pz, ox, oy);
        const r = avaliarMalhaRapida(gf, lay.vias, lay.celulas, oMalha);
        avaliados++;
        if (r.n > 0) avs.push({ ang, ox, oy, n: r.n, area: r.area });
      };
      const set = new Set<number>([...angulosDasArestas(anelM, 8), ...angulosVias]);
      for (let a = 0; a < 180; a += 10) set.add(a);
      const grossos = Array.from(set).sort((a, b) => a - b);
      grossos.forEach((a, i) => { avaliar(a, 0, 0); prog(0.08 + 0.2 * ((i + 1) / grossos.length), "Varredura de orientações da malha"); });
      const ordenar = (a: Av, b: Av) => b.area - a.area || b.n - a.n || a.ang - b.ang || a.ox - b.ox || a.oy - b.oy;
      const melhores: number[] = [];
      for (const a of [...avs].sort(ordenar)) { if (!melhores.includes(a.ang)) melhores.push(a.ang); if (melhores.length >= (manual ? 3 : 6)) break; }
      // R5: as orientações alinhadas às vias existentes são sempre refinadas
      for (const a of angulosVias) if (!melhores.includes(a) && avs.some((x) => x.ang === a)) melhores.push(a);
      const fases = [0, 1 / 3, 2 / 3];
      melhores.forEach((baseAng, bi) => {
        const desvios = angulosVias.includes(baseAng) ? [0] : [-5, -2.5, -1, 0, 1, 2.5, 5];
        for (const da of desvios) {
          const ang = Math.round((((baseAng + da) % 180) + 180) % 180 * 1000) / 1000;
          for (const fx of fases) for (const fy of fases) avaliar(ang, fx * px, fy * py);
        }
        prog(0.28 + 0.3 * ((bi + 1) / melhores.length), "Refinando posição da malha");
      });
      // no máximo 2 variações por orientação, 24 candidatos (8 por variante no ajuste) para avaliação completa
      const porAngulo = new Map<number, number>();
      const finalistas: Av[] = [];
      for (const a of [...avs].sort(ordenar)) {
        const n = porAngulo.get(a.ang) ?? 0;
        if (n >= 2) continue;
        porAngulo.set(a.ang, n + 1);
        finalistas.push(a);
        if (finalistas.length >= (manual ? 8 : 24)) break;
      }
      for (const ang of angulosVias) {
        if (finalistas.some((f) => f.ang === ang)) continue;
        const m = [...avs].filter((x) => x.ang === ang).sort(ordenar)[0];
        if (m) finalistas.push(m);
      }
      const completa = (gf: GlebaFrame, a: Av, excluidas?: Set<string>): ImplantacaoFrame => {
        const lay = layoutMalha(gf.fr, g, pz, a.ox, a.oy, excluidas);
        const r = processarMalha(gf, lay.vias, lay.baloes, lay.celulas, oMalha);
        return {
          lotes: r.lotes, corredores: [], baloes: r.baloes, viasPoli: r.vias, viasCobertura: r.coberturaVias, candidatos: r.candidatos,
          limitacoes: limitacoesMalha(pz, lay, r.trechosDescartados), conexa: r.conexa, acessos: r.acessos, trechosDescartados: r.trechosDescartados,
        };
      };
      finalistas.forEach((a, i) => {
        const gf = frameDe(a.ang);
        const chaveBase = `${a.ang}|${a.ox.toFixed(4)}|${a.oy.toFixed(4)}|q${nLotesQuadra}`;
        let impl = completa(gf, a);
        let bruto = avaliarImplantacao(ctx, chaveBase, gf, impl, Math.max(g.via * g.testada, 1));
        const ajustes: string[] = [];
        if (compVar !== params.comprimentoMaxQuadraM) ajustes.push(`quadras de até ${(nLotesQuadra * g.testada).toLocaleString("pt-BR")} m (máximo informado: ${params.comprimentoMaxQuadraM.toLocaleString("pt-BR")} m)`);
        if (manual && bruto.vias.areaM2 > alvo + tolV) {
          // suprime ruas horizontais de menor aproveitamento até a via desenhada caber no valor informado
          const excluidas = new Set<string>();
          const lay0 = layoutMalha(gf.fr, g, pz, a.ox, a.oy);
          const ruasH = lay0.vias.filter((v) => v.chave && !v.chave.startsWith("v") && !v.chave.startsWith("t")).map((v) => v.chave!);
          for (let iter = 0; iter < 60 && bruto.vias.areaM2 > alvo + tolV && bruto.nVendaveis > 0; iter++) {
            const cont = new Map<string, number>(ruasH.filter((k) => !excluidas.has(k)).map((k) => [k, 0]));
            const layAtual = layoutMalha(gf.fr, g, pz, a.ox, a.oy, excluidas);
            for (const l of impl.lotes) {
              const cel = layAtual.celulas.find((c) => c.ret[0] === l.ret[0] && c.ret[1] === l.ret[1]);
              const v = cel?.viasFrente[0];
              const k = v !== undefined ? layAtual.vias[v]?.chave : undefined;
              if (k && cont.has(k)) cont.set(k, (cont.get(k) ?? 0) + 1);
            }
            const pior = Array.from(cont.entries()).sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : 1))[0];
            if (!pior) break;
            excluidas.add(pior[0]);
            const implNovo = completa(gf, a, excluidas);
            const brutoNovo = avaliarImplantacao(ctx, `${chaveBase}|x${excluidas.size}`, gf, implNovo, Math.max(g.via * g.testada, 1));
            // nunca aceita um passo que elimine todos os lotes ou desconecte a malha: o valor informado fica como divergência técnica
            if (brutoNovo.nVendaveis === 0 || !brutoNovo.conexa) { excluidas.delete(pior[0]); break; }
            impl = implNovo;
            bruto = brutoNovo;
          }
          if (excluidas.size > 0) ajustes.push(`${excluidas.size} rua(s) suprimida(s) para a via desenhada se aproximar da área informada`);
        }
        if (ajustes.length > 0) bruto.impl = { ...bruto.impl, limitacoes: [`Malha ajustada automaticamente: ${ajustes.join("; ")}.`, ...bruto.impl.limitacoes] };
        brutos.push(bruto);
        prog(0.6 + 0.4 * ((i + 1) / finalistas.length), "Desenhando vias e balões");
      });
    });
  }

  progresso(0.92, "Selecionando cenários");
  const comLotes = brutos.filter((b) => b.nVendaveis > 0);
  // R1: cenário sem malha conexa com acesso pela divisa nunca é exibido
  let validos = comLotes.filter((b) => !b.divergenciaViaria && b.conexa);
  if (inverterVia) {
    const automatico = brutos.slice(0, limiteCandidatosVia)
      .filter((b) => b.nVendaveis > 0 && !b.divergenciaViaria).sort(compararPorVendavel)[0];
    if (automatico) {
      const referencia = arestasPorImplantacao.get(automatico.chave)!;
      validos = validos.filter((b) => divisasOpostas(anelM, referencia, arestasPorImplantacao.get(b.chave)!));
    }
    if (!automatico || validos.length === 0) {
      return falha("Nenhum cenário válido com a via na divisa oposta para esses parâmetros.",
        ["Confira a largura da via, a testada, a área mínima dos lotes e, no modo manual, a área viária informada."], avaliados);
    }
  }
  // R5: havendo vias mapeadas junto à divisa, ficam os cenários cujo acesso encosta numa delas
  if (viasJunto.length > 0) {
    const ligados = validos.filter((b) => b.acesso && b.acesso.distancia <= DISTANCIA_MAX_ACESSO_M);
    if (ligados.length > 0) validos = ligados;
  }
  // cul-de-sac: havendo implantação com rua sem saída terminando em balão, as que só têm ruas abertas na divisa ficam de fora
  if (tipologia === "cul_de_sac") {
    const comBalao = validos.filter((b) => b.impl.baloes.length > 0);
    if (comBalao.length > 0) validos = comBalao;
  }
  if (validos.length === 0) {
    const sorted = [...comLotes].sort(compararPorVendavel);
    if (manual && sorted.length > 0 && sorted.some((b) => b.divergenciaViaria)) {
      const informada = params.areaSistemaViarioM2 ?? 0;
      const geos = sorted.map((b) => b.vias.areaM2);
      const minG = Math.min(...geos), maxG = Math.max(...geos);
      const maxPossivel = Math.max(...sorted.map((b) => b.divergenciaViaria?.maxPossivel ?? 0));
      const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      return falha(
        `Divergência técnica: a área viária informada (${f(informada)} m²) é incompatível com a geometria desenhada — as implantações viáveis têm entre ${f(minG)} e ${f(maxG)} m² de via com largura de ${f(g.via)} m.`,
        [
          tipologia === "rua_simples" && maxPossivel > 0 && informada > maxPossivel
            ? `A poligonal comporta no máximo ${f(maxPossivel)} m² de via (largura ${f(g.via)} m) neste traçado; a área informada exige mais.`
            : `Tolerância aceita: ±${f(tolerClViaria(informada, Math.max(g.via * g.testada, 1)))} m². Ajuste a área viária informada, a largura da via ou use o modo automático.`,
          "Nenhuma implantação fictícia foi produzida para ajustar o valor.",
        ], avaliados);
    }
    const causas = diagnosticarInviabilidade(anelM, ctx.params, areaParcelavel);
    if (comLotes.length > 0 && comLotes.every((b) => !b.conexa)) {
      return falha("Inviável: nenhuma implantação formou malha viária conectada com acesso pela divisa.", causas, avaliados);
    }
    const motivo = comLotes.length === 0
      ? motivoInviabilidade(0, 0, { areaParcelavelM2: areaParcelavel }, g, params)!
      : "Inviável: todos os lotes gerados foram consumidos pelas doações (institucional e área verde) e pelas áreas não parceláveis.";
    return falha(motivo, causas, avaliados);
  }

  // Seleção por critérios transparentes (ver ROTULO_CRITERIO).
  const escolhidos: { b: Bruto; criterio: CriterioCenario }[] = [];
  const porVendavel = [...validos].sort(compararPorVendavel);
  const melhor = porVendavel[0];
  escolhidos.push({ b: melhor, criterio: "maior_area_vendavel" });
  const distintoDosEscolhidos = (b: Bruto) => escolhidos.every((x) => !equivalentes(x.b, b));
  if (nCen >= 2) {
    // Eficiência viária: vendável por m² de via — entre alternativas que preservam ao menos 75% da melhor área vendável.
    const efic = porVendavel
      .filter((b) => b !== melhor && b.areaVendavel >= 0.75 * melhor.areaVendavel && distintoDosEscolhidos(b))
      .sort((a, b) => eficienciaViaria(b) - eficienciaViaria(a) || compararPorVendavel(a, b));
    if (efic[0]) escolhidos.push({ b: efic[0], criterio: "melhor_eficiencia_viaria" });
  }
  if (nCen >= 3) {
    const alt = porVendavel.find((b) => !escolhidos.some((x) => x.b === b) && distintoDosEscolhidos(b));
    if (alt) escolhidos.push({ b: alt, criterio: "alternativa_distinta" });
  }
  if (nCen >= 2 && escolhidos.length === 1) {
    // sem alternativa de eficiência: tenta a distinta como 2º cenário
    const alt = porVendavel.find((b) => b !== melhor && distintoDosEscolhidos(b));
    if (alt) escolhidos.push({ b: alt, criterio: "alternativa_distinta" });
  }

  const cenarios = escolhidos.map((x, i) => ({
    ...montarCenario(ctx, i, x.b, x.criterio),
    ...(inverterVia ? { viaLadoOposto: true } : {}),
    ...(ladosVia ? { ladosVia } : {}),
    acessosArea: tipologia === "vias_publicas" ? [] : x.b.acessosM.map((pt) => ({
      ponto: pt, acesso: viasJunto.length > 0 ? acessoMaisProximo([pt], viasJunto) : null,
      // S-I: acesso na borda da área restrita (não na divisa real) não é acesso
      ...(e.divisaReal ? { naApp: Math.min(...e.divisaReal.map((a) => distanciaAoAnel(a, pt))) > 1 } : {}),
    })),
  }));
  // o cenário pode perder vendáveis na destinação (estimativa da seleção): nunca exibe cenário sem lote vendável
  const comVendavel = cenarios.filter((c) => c.kpis.lotesVendaveis > 0);
  if (comVendavel.length === 0) {
    return falha("Inviável: todos os lotes gerados foram consumidos pelas doações (institucional e área verde) e pelas áreas não parceláveis.",
      diagnosticarInviabilidade(anelM, ctx.params, areaParcelavel), avaliados);
  }
  if (comVendavel.length < 3) avisos.push(`Foram encontradas ${comVendavel.length} alternativa(s) geometricamente válida(s) e distinta(s) — nenhum cartão foi preenchido artificialmente.`);
  // S-I: parte cercada pela restrição (nenhum vértice na divisa real) ou com as vias mapeadas só do outro lado dela
  let isolamento: ResultadoArea["isolamento"];
  if (e.divisaReal) {
    const naDivisa = anelM.some((p) => Math.min(...e.divisaReal!.map((a) => distanciaAoAnel(a, p))) <= 0.5);
    if (!naDivisa) isolamento = "ilha";
    else if (e.glebaTemViasJunto && viasJunto.length === 0) isolamento = "alem";
  }
  return { cenarios: comVendavel, inviabilidade: null, avisos, candidatosAvaliados: avaliados, temViasJunto: viasJunto.length > 0, ...(isolamento ? { isolamento } : {}) };
}

/** Nota honesta do acesso de uma área (R5). */
function notaAcesso(r: ResultadoArea["cenarios"][number], temVias: boolean, prefixo: string, isolamento?: ResultadoArea["isolamento"]): { nota: string; acessos: Omit<AcessoCenario, "area" | "ponto">[] } {
  // S-I: ponto na borda da área restrita não é acesso pela divisa
  const lista = (r.acessosArea ?? []).filter((a) => !a.naApp);
  if (isolamento === "ilha") {
    return { nota: `${prefixo}Esta parte fica cercada pela área restrita (APP): chegar a ela exige atravessar a APP com uma via, o que depende de licença ambiental — acesso a confirmar em projeto.`, acessos: [] };
  }
  if (isolamento === "alem" && !lista.some((a) => a.acesso && a.acesso.distancia <= DISTANCIA_MAX_ACESSO_M)) {
    return { nota: `${prefixo}As vias mapeadas junto à gleba ficam do outro lado da área restrita (APP): o acesso por elas exige atravessar a APP, o que depende de licença ambiental. ${NOTA_ACESSO_SEM_VIA}`, acessos: [] };
  }
  if ((r.acessosArea ?? []).length > 0 && lista.length === 0) {
    return { nota: `${prefixo}As ruas desta parte só encostam na borda da área restrita (APP), não na divisa: a ligação com o exterior exige atravessar a APP, o que depende de licença ambiental — acesso a confirmar em projeto.`, acessos: [] };
  }
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const ligados = lista.filter((a) => a.acesso && a.acesso.distancia <= DISTANCIA_MAX_ACESSO_M).sort((a, b) => a.acesso!.distancia - b.acesso!.distancia);
  if (ligados.length > 0) {
    const nomes = Array.from(new Set(ligados.map((a) => a.acesso!.nome).filter((n): n is string => !!n)));
    const via = nomes.length > 0 ? nomes.map((n) => `"${n}"`).join(", ") : "via pública mapeada sem nome no OpenStreetMap";
    return { nota: `${prefixo}Acesso da malha pela via existente ${via} (${ligados.length} ponto(s) de acesso na divisa a até ${f(DISTANCIA_MAX_ACESSO_M)} m do eixo da via).`, acessos: [] };
  }
  if (temVias) {
    const perto = lista.filter((a) => a.acesso).sort((a, b) => a.acesso!.distancia - b.acesso!.distancia)[0];
    const extra = perto?.acesso ? ` A via mapeada mais próxima${perto.acesso.nome ? ` ("${perto.acesso.nome}")` : ""} fica a ${f(perto.acesso.distancia)} m do acesso.` : "";
    return { nota: `${prefixo}${NOTA_ACESSO_SEM_VIA}${extra}`, acessos: [] };
  }
  return { nota: `${prefixo}${NOTA_ACESSO_SEM_VIA}`, acessos: [] };
}

/**
 * Motor completo: devolve até 3 cenários DISTINTOS e geometricamente válidos
 * (nunca preenche cartões com resultados inventados) ou o motivo verificável de
 * não haver nenhum. Aceita UMA área (anel) ou VÁRIAS áreas contínuas (MultiPolygon, com furos):
 * cada área é estudada separadamente e o resultado é composto num único cenário por cartão.
 */
export function gerarEstudoMassa(
  entrada: EntradaGleba,
  centro: [number, number],
  params: ParametrosMassa,
  opts: OpcoesGeracao = {}
): EstudoMassaGerado {
  const tipologia: TipologiaMassa = params.tipologia ?? "grid";
  const assinatura = assinaturaEntradas(entrada, params, opts.viasEntorno, opts.restricoes);
  const progresso = (f: number, etapa: string) => opts.onProgress?.(f, etapa);
  const nCen = Math.max(1, Math.min(3, opts.nCenarios ?? 3));

  const erroParams = validarParametrosMassa({ ...params, tipologia });
  if (erroParams) return vazio(tipologia, assinatura, erroParams);
  const areas = areasDaEntrada(entrada);
  if (areas.length === 0) return vazio(tipologia, assinatura, validarPoligonal(null)!);
  const multi = areas.length > 1;
  const avisos: string[] = [];
  for (let i = 0; i < areas.length; i++) {
    const erro = validarPoligonal(areas[i][0]);
    if (erro) return vazio(tipologia, assinatura, multi ? `Área ${i + 1}: ${erro}` : erro);
  }
  const proj = criarProjecao(centro);
  const furosValidos = areas.map((poli, i) => poli.slice(1).filter((f, j) => {
    const erro = validarPoligonal(f);
    if (erro) avisos.push(`${multi ? `Área ${i + 1}: ` : ""}furo ${j + 1} ignorado (${erro})`);
    return !erro;
  }));
  const areaDe = (i: number) => {
    const m = (a: Position[]) => areaPlanar(a.map((p) => proj.paraMetros(p)));
    return Math.max(0, m(areas[i][0]) - furosValidos[i].reduce((s, f) => s + m(f), 0));
  };
  const areasM2 = areas.map((_, i) => areaDe(i));
  const areaTotal = areasM2.reduce((s, a) => s + a, 0);

  // S-I: restrições com o contorno real saem da área loteável pelo contorno; o m² delas vem do contorno recortado
  const restricoesGeo = (opts.restricoes ?? []).filter((r) => r && Array.isArray(r.poligonos));
  const recorte = restricoesGeo.length > 0 ? recortarRestricoes(areas, furosValidos, restricoesGeo, proj, params.loteMinimoM2) : null;
  if (restricoesGeo.length > 0 && !recorte) {
    avisos.push("Não foi possível recortar o contorno das áreas restritas pela gleba: o estudo usou só a área em m² informada (posição a confirmar).");
  }
  const geo = recorte && recorte.pecas.length > 0 ? recorte : null;
  // contorno guardado que não cai neste terreno (KML trocado, contorno vazio ou inválido): vale o m² informado, com aviso
  const avisosContorno: string[] = [];
  for (const tipo of recorte?.foraDoTerreno ?? []) {
    const campo = CAMPO_RESTRICAO_GEO.find((x) => x[0] === tipo)![1];
    const informado = params[campo] ?? 0;
    const rot = ROTULO_RESTRICAO_GEO[tipo];
    avisosContorno.push(`O contorno da ${rot} guardado no estudo não cai neste terreno (ou é inválido): ${informado > 0
      ? `o estudo usou a ${rot} informada em m² (${informado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²), sem a posição real`
      : "nenhuma área foi reservada para ela"}. Abra o mapa da aba Terreno para o sistema guardar o contorno de novo.`);
  }
  avisos.push(...avisosContorno);
  const marca = restricoesGeo.length > 0 ? assinaturaRestricoes(restricoesGeo) : "";
  const marcar = (c: CenarioMassa): CenarioMassa => (marca
    ? { ...c, contornoRestricoes: marca, limitacoes: [...(c.limitacoes ?? []), ...avisosContorno.filter((a) => !(c.limitacoes ?? []).includes(a))] }
    : c);
  const paramsConta: ParametrosMassa = recorte ? { ...params, ...recorte.m2PorCampo } : params;

  const restricoesTot = restricoesDosParametros(paramsConta);
  const naoParcelavelTot = Math.min(totalRestricoes(restricoesTot), areaTotal);
  const areaParcelavelTot = Math.max(0, areaTotal - naoParcelavelTot);
  const erroViario = validarSistemaViarioManual(paramsConta, areaParcelavelTot);
  if (erroViario) return vazio(tipologia, assinatura, erroViario);
  if (areaParcelavelTot <= 0) {
    const anelM = areas[0][0].map((p) => proj.paraMetros(p));
    return vazio(tipologia, assinatura, "Inviável: as áreas não parceláveis ocupam toda a gleba — não há área parcelável.", diagnosticarInviabilidade(anelM, { ...paramsConta, tipologia }, 0));
  }
  const viasEntornoM: ViaEntornoM[] = (opts.viasEntorno ?? [])
    .filter((v) => Array.isArray(v?.coords) && v.coords.length >= 2)
    .map((v) => ({ pts: v.coords.map((p) => proj.paraMetros(p) as Position), nome: v.nome ?? null }));

  // áreas contínuas que recebem lotes: as do KML ou, com restrição desenhada, as partes da gleba fora dela
  const efetivas: AreaEfetiva[] = geo ? geo.areas : areas.map((poli, i) => ({ anel: poli[0], furos: furosValidos[i], areaM2: areasM2[i] }));
  if (efetivas.length === 0) {
    return vazio(tipologia, assinatura, "Inviável: fora das áreas restritas desenhadas só sobram retalhos menores que o lote mínimo.");
  }
  const multiEf = efetivas.length > 1;
  const somaEf = efetivas.reduce((s, a) => s + a.areaM2, 0);
  const fracao = (i: number) => (somaEf > 0 ? efetivas[i].areaM2 / somaEf : 0);

  // cada área recebe a sua parte das restrições informadas em m² (e da área viária manual), na proporção da área
  const escala = (i: number): ParametrosMassa => {
    if (!multiEf && !geo) return { ...paramsConta, tipologia };
    const k = fracao(i);
    const m = (v: number | undefined) => (v === undefined ? undefined : v * k);
    return {
      ...paramsConta, tipologia, appM2: m(paramsConta.appM2), supressaoVegetalM2: m(paramsConta.supressaoVegetalM2), faixaTransmissaoM2: m(paramsConta.faixaTransmissaoM2),
      faixaServidaoM2: m(paramsConta.faixaServidaoM2), outrasNaoParcelaveisM2: m(paramsConta.outrasNaoParcelaveisM2), areaSistemaViarioM2: m(paramsConta.areaSistemaViarioM2),
    };
  };
  // parte das restrições desenhadas que cabe a cada área (já está fora dela, no desenho)
  const externasDe = (i: number): RestricoesNaoParcelaveis | undefined => {
    if (!geo) return undefined;
    const k = fracao(i);
    const r = { ...RESTRICOES_VAZIAS };
    for (const [, campo] of CAMPO_RESTRICAO_GEO) r[campo] = (geo.m2PorCampo[campo] ?? 0) * k;
    return r;
  };
  // S-I: divisa real da gleba (o que não está nela é borda de área restrita) e se há vias mapeadas junto dela
  const divisaReal = geo ? areas.flatMap((poli, i) => [poli[0], ...furosValidos[i]].map((a) => { const m = a.map((q) => proj.paraMetros(q) as Position); m[m.length - 1] = m[0]; return m; })) : null;
  const glebaTemViasJunto = !!divisaReal && areas.some((poli) => viasJuntoDaArea(viasEntornoM, poli[0].map((q) => proj.paraMetros(q) as Position)).length > 0);
  let acumulado = 0;
  const resultados: ResultadoArea[] = efetivas.map((ef, i) => {
    const peso = somaEf > 0 ? ef.areaM2 / somaEf : 1 / efetivas.length;
    const ini = acumulado;
    acumulado += peso;
    const externas = externasDe(i);
    return estudoDaArea({
      anelGeo: ef.anel, furosGeo: ef.furos, centro, params: escala(i), tipologia, nCen, viasEntornoM, ...(externas ? { externas } : {}),
      ...(divisaReal ? { divisaReal, glebaTemViasJunto } : {}),
      progresso: (f, etapa) => progresso(Math.min(0.99, ini + peso * f), multiEf ? `Área ${i + 1} de ${efetivas.length}: ${etapa}` : etapa),
    });
  });
  const candidatosAvaliados = resultados.reduce((s, r) => s + r.candidatosAvaliados, 0);
  const extra = geo ? extraDasRestricoes(geo, paramsConta, params, areaTotal, areas.length) : undefined;
  const contornos = efetivas.map((e) => e.anel);
  const areasEf = efetivas.map((e) => e.areaM2);

  if (!multiEf) {
    const r = resultados[0];
    if (r.cenarios.length === 0) return { ...vazio(tipologia, assinatura, r.inviabilidade!.motivo, r.inviabilidade!.causas), candidatosAvaliados, avisos };
    const cenarios = r.cenarios.map((c) => marcar(finalizarCenario([c], [r], areasEf, paramsConta, contornos, proj, c.id, extra)));
    progresso(1, "Concluído");
    return { versaoAlgoritmo: VERSAO_ALGORITMO_MASSA, assinatura, cenarios, inviabilidade: null, avisos: [...avisos, ...r.avisos], candidatosAvaliados, tipologia, areas: 1 };
  }

  // VÁRIAS ÁREAS: compõe o cartão j com o cenário j de cada área (ou o melhor que ela tiver)
  const comCenario = resultados.map((r, i) => ({ r, i })).filter((x) => x.r.cenarios.length > 0);
  if (comCenario.length === 0) {
    const r = resultados[0];
    return {
      ...vazio(tipologia, assinatura, `Nenhuma das ${efetivas.length} áreas comporta lote com esses parâmetros. Área 1: ${r.inviabilidade?.motivo ?? "sem cenário"}`,
        resultados.flatMap((x, i) => (x.inviabilidade?.causas ?? []).map((c) => `Área ${i + 1}: ${c}`))),
      candidatosAvaliados, avisos,
    };
  }
  resultados.forEach((r, i) => {
    if (r.cenarios.length === 0) {
      avisos.push(`Área ${i + 1} (${areasEf[i].toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²) não comporta lote com estes parâmetros — destinada inteira a área verde. ${r.inviabilidade?.motivo ?? ""}`.trim());
    }
  });
  const nComp = Math.max(...comCenario.map((x) => x.r.cenarios.length));
  const cenarios: CenarioMassa[] = [];
  for (let j = 0; j < nComp; j++) {
    const partes = resultados.map((r) => (r.cenarios.length > 0 ? r.cenarios[Math.min(j, r.cenarios.length - 1)] : null));
    cenarios.push(marcar(finalizarCenario(partes, resultados, areasEf, paramsConta, contornos, proj, `cenario-${j + 1}`, extra && { ...extra, furos: efetivas.map((e) => e.furos) })));
  }
  for (const r of resultados) for (const a of r.avisos) if (!avisos.includes(a)) avisos.push(a);
  progresso(1, "Concluído");
  return { versaoAlgoritmo: VERSAO_ALGORITMO_MASSA, assinatura, cenarios, inviabilidade: null, avisos, candidatosAvaliados, tipologia, areas: efetivas.length };
}

/** Peças e notas das restrições desenhadas pelo contorno, para a composição do cenário (S-I). */
interface ExtraRestricoes {
  /** Peças das restrições na posição real + retalhos fora delas pequenos demais para lote. */
  pecas: LoteGerado[];
  /** Área bruta da gleba inteira (as peças incluídas). */
  areaBrutaM2: number;
  notas: string[];
  /** Furos de cada área contínua (para a área que não comporta lote virar área verde sem cobrir o que há no furo). */
  furos?: Position[][][];
}

function extraDasRestricoes(geo: RecorteRestricoes, paramsConta: ParametrosMassa, params: ParametrosMassa, areaBrutaM2: number, nAreasKml: number): ExtraRestricoes {
  const destinos = destinosDosParametros(params);
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const pecas: LoteGerado[] = geo.pecas.map((p): LoteGerado => {
    const d = destinos[p.campo];
    return {
      anel: p.anel, ...(p.furos.length > 0 ? { furos: p.furos } : {}), areaM2: round2(p.areaM2),
      tipo: d === "nenhum" ? "nao_parcelavel" : "area_publica", ...(d === "nenhum" ? {} : { uso: d }), restricao: p.tipo,
    };
  });
  for (const r of geo.retalhos) {
    pecas.push({ anel: r.anel, ...(r.furos.length > 0 ? { furos: r.furos } : {}), areaM2: round2(r.areaM2), tipo: "area_publica", uso: "verde", origem: "sobra" });
  }
  const notas: string[] = [];
  const rotuloDestino = { verde: "conta como área verde", institucional: "conta como área institucional", nenhum: "fica só como não parcelável (não conta nas doações)" } as const;
  for (const [tipo, campo] of CAMPO_RESTRICAO_GEO) {
    const m2 = geo.m2PorCampo[campo];
    if (m2 === undefined) continue;
    const informado = params[campo];
    const troca = typeof informado === "number" && Math.abs(informado - m2) > Math.max(1, 0.005 * m2) ? ` (o valor em m² dos parâmetros, ${f(informado)} m², foi substituído pelo do contorno)` : "";
    notas.push(m2 > 0.5
      ? `${ROTULO_RESTRICAO_GEO[tipo]} desenhada pelo contorno real (mapa do Terreno): ${f(m2)} m² dentro da gleba, fora da área loteável — nenhum lote nem via dentro dela; ${rotuloDestino[destinos[campo]]}${troca}.`
      : `${ROTULO_RESTRICAO_GEO[tipo]}: o contorno informado não cai dentro da gleba${troca}.`);
  }
  if (geo.areas.length > nAreasKml) {
    notas.push(`As áreas restritas dividem a gleba em ${geo.areas.length} partes loteáveis: cada parte foi loteada como uma área contínua (Área 1 a ${geo.areas.length} nas notas), com a própria malha ligada à divisa.`);
  }
  const retalhosM2 = geo.retalhos.reduce((s, r) => s + r.areaM2, 0);
  if (retalhosM2 >= 1) notas.push(`${geo.retalhos.length} retalho(s) entre as áreas restritas e a divisa (${f(retalhosM2)} m²), pequenos demais para lote ou de traçado irregular, ficaram como área verde.`);
  const ap = aproveitarRestricoes(restricoesDosParametros(paramsConta), destinos, areaBrutaM2, params.percentAreaVerde, params.percentInstitucional);
  // a parte verde só em m² é a das restrições SEM contorno que contam como verde
  let verdeSoEmM2 = 0;
  for (const [, campo] of CAMPO_RESTRICAO_GEO) if (geo.m2PorCampo[campo] === undefined && destinos[campo] === "verde") verdeSoEmM2 += Math.max(0, paramsConta[campo] ?? 0);
  notas.push(...notasAproveitamento(ap, verdeSoEmM2));
  return { pecas, areaBrutaM2, notas };
}

/**
 * Compõe o cenário final a partir do cenário de cada área (null = área sem lote, vira área verde):
 * quadras numeradas em sequência entre as áreas, KPIs e quadro de áreas somados, acessos e notas por área.
 */
function finalizarCenario(
  partes: (ResultadoArea["cenarios"][number] | null)[], resultados: ResultadoArea[], areasM2: number[], params: ParametrosMassa,
  contornos: Position[][], proj: ReturnType<typeof criarProjecao>, id: string, extra?: ExtraRestricoes,
): CenarioMassa {
  const multi = partes.length > 1;
  const lotes: LoteGerado[] = [];
  const vias: Position[][] = [];
  const ruas: Position[][] = [];
  const limitacoes: string[] = [];
  const acessos: AcessoCenario[] = [];
  let quadraBase = 0;
  let viario = 0, fechoSoma = 0;
  let principal: CenarioMassa | null = null;
  let maiorArea = -1;
  partes.forEach((c, i) => {
    const prefixo = multi ? `Área ${i + 1}: ` : "";
    if (!c) {
      const furos = extra?.furos?.[i] ?? [];
      lotes.push({ anel: contornos[i], ...(furos.length > 0 ? { furos } : {}), areaM2: round2(areasM2[i]), tipo: "area_publica", uso: "verde", origem: "sobra" });
      fechoSoma += round2(areasM2[i]);
      return;
    }
    if (areasM2[i] > maiorArea) { maiorArea = areasM2[i]; principal = c; }
    const quadras = new Set<string>();
    for (const l of c.lotes) {
      if (l.quadra) quadras.add(l.quadra);
      lotes.push(l.quadra ? { ...l, quadra: String(Number(l.quadra) + quadraBase) } : l);
    }
    quadraBase += quadras.size;
    vias.push(...(c.vias ?? []));
    ruas.push(...(c.ruas ?? []));
    viario += c.sistemaViario?.areaGeometricaM2 ?? 0;
    fechoSoma += c.fechoAreas?.somaM2 ?? 0;
    for (const l of c.limitacoes ?? []) { const t = `${prefixo}${l}`; if (!limitacoes.includes(t)) limitacoes.push(t); }
    if (c.tipologia !== "vias_publicas") limitacoes.push(notaAcesso(c, resultados[i].temViasJunto, prefixo, resultados[i].isolamento).nota);
    for (const a of c.acessosArea ?? []) {
      const lig = !!a.acesso && a.acesso.distancia <= DISTANCIA_MAX_ACESSO_M;
      if (a.naApp) continue;
      acessos.push({
        area: i + 1, ponto: proj.paraGeo(a.ponto), viaExistente: lig, nomeVia: lig ? a.acesso!.nome : null,
        distanciaM: a.acesso ? round2(a.acesso.distancia) : null,
      });
    }
  });
  const p = principal as CenarioMassa | null;
  if (!p) throw new Error("composição sem cenário");
  // S-I: peças das restrições desenhadas pelo contorno, na posição real
  if (extra) {
    for (const l of extra.pecas) { lotes.push(l); fechoSoma += l.areaM2; }
    for (const n of extra.notas) if (!limitacoes.includes(n)) limitacoes.push(n);
  }
  const vendaveis = lotes.filter((l) => l.tipo === "vendavel");
  const publicos = lotes.filter((l) => l.tipo === "area_publica");
  const areaTotal = extra ? extra.areaBrutaM2 : areasM2.reduce((s, a) => s + a, 0);
  const areaVendavelM2 = round2(vendaveis.reduce((s, l) => s + l.areaM2, 0));
  const areaInstitucionalM2 = round2(publicos.filter((l) => l.uso === "institucional").reduce((s, l) => s + l.areaM2, 0));
  const areaVerdeM2 = round2(publicos.filter((l) => l.uso !== "institucional").reduce((s, l) => s + l.areaM2, 0));
  const manual = params.modoSistemaViario === "manual";
  const informada = manual ? params.areaSistemaViarioM2 : undefined;
  const quadroAreas = multi || extra ? calcularQuadroAreasMassa({
    areaBrutaM2: areaTotal, restricoes: restricoesDosParametros(params), aproveitamento: aproveitamentoDosParametros(params, areaTotal), areaVendavelM2, nLotesVendaveis: vendaveis.length,
    areaInstitucionalM2, areaVerdeM2, precoM2Lote: params.precoM2Lote, sistemaViarioM2: round2(viario),
    modoSistemaViario: manual ? "manual" : "automatico", ...(informada !== undefined ? { sistemaViarioInformadoM2: informada } : {}),
  }) : p.quadroAreas;
  const { acessosArea: _descartar, ...base } = p as CenarioMassa & { acessosArea?: unknown };
  void _descartar;
  return {
    ...base,
    id,
    lotes,
    vias,
    ruas,
    kpis: {
      lotesVendaveis: vendaveis.length,
      lotesPublicos: publicos.length,
      areaVendavelM2,
      areaPublicaM2: round2(areaInstitucionalM2 + areaVerdeM2),
      aproveitamento: areaTotal > 0 ? areaVendavelM2 / areaTotal : 0,
      vgv: Math.round(areaVendavelM2 * params.precoM2Lote),
    },
    quadroAreas,
    inviabilidade: vendaveis.length > 0 ? null : p.inviabilidade,
    limitacoes,
    sistemaViario: {
      modo: manual ? "manual" : "automatico",
      larguraM: params.larguraViaM,
      areaGeometricaM2: round2(viario),
      ...(informada !== undefined ? { areaInformadaM2: informada, diferencaM2: round2(viario - informada) } : {}),
    },
    fechoAreas: { areaGlebaM2: round2(areaTotal), somaM2: round2(fechoSoma), diferencaM2: round2(areaTotal - fechoSoma) },
    acessos,
    ...(multi ? { areas: partes.length } : {}),
  };
}

/**
 * Compatibilidade: devolve os cenários válidos do `gerarEstudoMassa`. Quando não há
 * nenhum, devolve UM cenário vazio carregando o motivo em `inviabilidade` (sem lotes) —
 * a interface nova usa `gerarEstudoMassa` e mostra o motivo, sem cartões.
 */
export function gerarCenariosMassa(
  entrada: EntradaGleba,
  centro: [number, number],
  params: ParametrosMassa,
  opts: OpcoesGeracao = {}
): CenarioMassa[] {
  const r = gerarEstudoMassa(entrada, centro, params, opts);
  if (r.cenarios.length > 0) return r.cenarios;
  const proj = criarProjecao(centro);
  const areaGleba = (() => {
    try { return areasDaEntrada(entrada).reduce((s, poli) => s + areaPlanar(poli[0].map((p) => proj.paraMetros(p))), 0); } catch { return 0; }
  })();
  const quadro = calcularQuadroAreasMassa({
    areaBrutaM2: areaGleba, restricoes: restricoesDosParametros(params), areaVendavelM2: 0, nLotesVendaveis: 0,
    areaInstitucionalM2: 0, areaVerdeM2: 0, precoM2Lote: params.precoM2Lote,
  });
  return [{
    id: "cenario-1", anguloVia: 0, testadaLoteM: params.testadaLoteM, profundidadeLoteM: params.profundidadeLoteM,
    larguraViaM: params.larguraViaM, tipologia: params.tipologia ?? "grid", lotes: [], vias: [], ruas: [],
    kpis: { lotesVendaveis: 0, lotesPublicos: 0, areaVendavelM2: 0, areaPublicaM2: 0, aproveitamento: 0, vgv: 0 },
    quadroAreas: quadro, inviabilidade: r.inviabilidade?.motivo ?? "Inviável: nenhum lote coube na poligonal.",
    limitacoes: r.inviabilidade?.causas ?? [], versaoAlgoritmo: VERSAO_ALGORITMO_MASSA,
  }];
}

// reexporta utilitários usados por testes/UI
export { gerarRuaSimplesFrame };
