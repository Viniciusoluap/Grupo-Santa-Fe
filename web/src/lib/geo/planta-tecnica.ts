// Motor UNIVERSAL de desenho técnico do parcelamento (correção 04).
//
// Função pura que transforma o cenário (a MESMA geometria validada usada pelo quadro
// de áreas, pelos cartões e pelas unidades) numa planta técnica preliminar em SVG:
// perímetro da gleba, vias com largura, quadras, todos os lotes numerados, áreas,
// testada × profundidade (conforme o zoom), áreas públicas/não parceláveis, legenda,
// escala gráfica e norte. Vale para Grade, Cul-de-sac e Rua Simples — muda o arranjo,
// não a representação.
//
// Coordenadas: lng/lat → metros pela MESMA projeção local do motor (criarProjecao),
// portanto proporções e medidas são as do cálculo. Não depende de imagem de satélite.

import type { Position } from "geojson";
import { criarProjecao, ROTULO_ESTUDO_PRELIMINAR, ROTULO_RESTRICAO_GEO, type CenarioMassa, type LoteGerado, type TipoRestricaoGeo } from "@/lib/geo/massa-parcelamento";
import { areaPlanar, pontoDentro } from "@/lib/geo/geometria-parcelamento";
import { formatarCodigoLote } from "@/lib/incorporacao/unidades";

export const CORES_PLANTA = {
  fundo: "#ffffff",
  gleba: "#111827",
  vendavel: "#fde68a",
  vendavelBorda: "#92400e",
  institucional: "#bfdbfe",
  verde: "#bbf7d0",
  /** APP e demais restrições desenhadas pelo contorno real (S-I): verde mais escuro, para não confundir com a doação. */
  app: "#86c99a",
  naoParcelavel: "#e5e7eb",
  via: "#d1d5db",
  viaBorda: "#6b7280",
  selecao: "#dc2626",
  quadra: "#1f2937",
  texto: "#111827",
} as const;

export interface LotePlanta {
  idx: number;
  anel: Position[]; // metros
  tipo: LoteGerado["tipo"];
  uso?: LoteGerado["uso"];
  quadra?: string;
  numero?: string;
  codigo: string | null;
  areaM2: number;
  testadaM: number;
  profundidadeM: number;
  centro: [number, number];
  /** Ângulo (graus) do lado da testada — para alinhar rótulos. */
  angulo: number;
  /** Peça irregular (lote recortado/ampliado na divisa, sobra destinada a área pública): sem "testada × profundidade" fixas. */
  irregular?: boolean;
  /** Furos (anéis internos) da peça, em metros. */
  furos?: Position[][];
  /** Área restrita desenhada pelo contorno real (APP, faixa…). */
  restricao?: TipoRestricaoGeo;
}

/** Destino da área restrita no quadro, para a legenda. */
function destinoDaPeca(l: { tipo: LoteGerado["tipo"]; uso?: LoteGerado["uso"] }): string {
  return l.tipo === "nao_parcelavel" ? "só não parcelável" : l.uso === "institucional" ? "conta como área institucional" : "conta como área verde";
}

export interface ModeloPlanta {
  gleba: Position[][];
  lotes: LotePlanta[];
  ruas: Position[][];
  baloes: Position[][];
  bbox: [number, number, number, number];
  quadras: { quadra: string; centro: [number, number]; bbox: [number, number, number, number] }[];
  larguraViaM: number;
  areaViariaM2: number;
  nLotesVendaveis: number;
  tipologia: string;
  /** Áreas restritas desenhadas pelo contorno real, somadas por tipo (legenda). */
  restricoes: { tipo: TipoRestricaoGeo; rotulo: string; areaM2: number; destino: string }[];
}

function centroide(anel: Position[]): [number, number] {
  const n = anel.length - 1;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += anel[i][0]; y += anel[i][1]; }
  return [x / n, y / n];
}

/** Centroide de ÁREA (melhor que a média dos vértices em peças irregulares); cai na média quando a área é nula. */
function centroideArea(anel: Position[]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const [x0, y0] = anel[i], [x1, y1] = anel[i + 1];
    const k = x0 * y1 - x1 * y0;
    a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
  }
  if (Math.abs(a) < 1e-9) return centroide(anel);
  return [cx / (3 * a), cy / (3 * a)];
}

function bboxDe(aneis: Position[][]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const anel of aneis) for (const [x, y] of anel) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
}

/** Monta o modelo métrico da planta a partir da gleba e do cenário (lng/lat). */
export function montarModeloPlanta(glebaGeo: Position[], cenario: CenarioMassa, centro: [number, number], demaisContornos: Position[][] = []): ModeloPlanta {
  const proj = criarProjecao(centro);
  const m = (anel: Position[]) => anel.map((p) => proj.paraMetros(p));
  const gleba = [glebaGeo, ...demaisContornos].map(m);
  const lotes: LotePlanta[] = cenario.lotes.map((l, idx) => {
    const anel = m(l.anel);
    const d0 = Math.hypot(anel[1][0] - anel[0][0], anel[1][1] - anel[0][1]);
    const d1 = Math.hypot(anel[2][0] - anel[1][0], anel[2][1] - anel[1][1]);
    const ang = (Math.atan2(anel[1][1] - anel[0][1], anel[1][0] - anel[0][0]) * 180) / Math.PI;
    const irregular = !!l.ajuste || !!l.origem || (l.tipo !== "vendavel" && anel.length !== 5);
    return {
      idx, anel, tipo: l.tipo, uso: l.uso, quadra: l.quadra, numero: l.numero,
      codigo: l.quadra && l.numero ? formatarCodigoLote(l.quadra, l.numero) : null,
      // lote que acompanha a divisa: anel irregular → usa testada real e profundidade média do motor
      areaM2: l.areaM2 || areaPlanar(anel), testadaM: l.testadaM ?? d0, profundidadeM: l.profundidadeMediaM ?? d1,
      centro: centroideArea(anel), angulo: ang,
      ...(irregular ? { irregular: true } : {}),
      ...(l.furos && l.furos.length > 0 ? { furos: l.furos.map(m) } : {}),
      ...(l.restricao ? { restricao: l.restricao } : {}),
    };
  });
  const restricoes: ModeloPlanta["restricoes"] = [];
  for (const l of lotes) {
    if (!l.restricao) continue;
    const r = restricoes.find((x) => x.tipo === l.restricao);
    if (r) r.areaM2 += l.areaM2;
    else restricoes.push({ tipo: l.restricao, rotulo: ROTULO_RESTRICAO_GEO[l.restricao], areaM2: l.areaM2, destino: destinoDaPeca(l) });
  }
  const porQuadra = new Map<string, LotePlanta[]>();
  for (const l of lotes) if (l.quadra) porQuadra.set(l.quadra, [...(porQuadra.get(l.quadra) ?? []), l]);
  const quadras = Array.from(porQuadra.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]))
    .map(([quadra, ls]) => {
      const bb = bboxDe(ls.map((l) => l.anel));
      return { quadra, centro: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2] as [number, number], bbox: bb };
    });
  return {
    gleba, lotes, ruas: (cenario.ruas ?? []).map(m), baloes: (cenario.vias ?? []).map(m), bbox: bboxDe(gleba), quadras,
    larguraViaM: cenario.larguraViaM,
    areaViariaM2: cenario.sistemaViario?.areaGeometricaM2 ?? cenario.quadroAreas?.sistemaViarioM2 ?? 0,
    nLotesVendaveis: cenario.kpis.lotesVendaveis,
    tipologia: cenario.tipologia ?? "grid",
    restricoes,
  };
}

// ─── Vista (zoom/pan) ───────────────────────────────────────────────────────

export interface VistaPlanta {
  /** pixels por metro */
  escala: number;
  /** deslocamento em px do ponto (0,0) métrico */
  tx: number;
  ty: number;
  larguraPx: number;
  alturaPx: number;
}

/** Enquadra a gleba inteira com margem. */
export function vistaInicial(modelo: ModeloPlanta, larguraPx: number, alturaPx: number, margemPx = 36): VistaPlanta {
  const [x0, y0, x1, y1] = modelo.bbox;
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const escala = Math.max(1e-6, Math.min((larguraPx - 2 * margemPx) / w, (alturaPx - 2 * margemPx - 40) / h));
  const tx = larguraPx / 2 - ((x0 + x1) / 2) * escala;
  const ty = (alturaPx - 40) / 2 + ((y0 + y1) / 2) * escala; // y para cima no terreno, para baixo na tela
  return { escala, tx, ty, larguraPx, alturaPx };
}

/** Zoom mantendo fixo o ponto de tela (px, py). */
export function zoomEm(v: VistaPlanta, fator: number, px: number, py: number, min = 1e-4, max = 400): VistaPlanta {
  const escala = Math.min(max, Math.max(min, v.escala * fator));
  const f = escala / v.escala;
  return { ...v, escala, tx: px - (px - v.tx) * f, ty: py - (py - v.ty) * f };
}

export function telaParaMetros(v: VistaPlanta, px: number, py: number): [number, number] {
  return [(px - v.tx) / v.escala, (v.ty - py) / v.escala];
}

// ─── Renderização ───────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function pontos(anel: Position[], v: VistaPlanta): string {
  let s = "";
  for (let i = 0; i < anel.length - 1; i++) {
    s += `${(v.tx + anel[i][0] * v.escala).toFixed(2)},${(v.ty - anel[i][1] * v.escala).toFixed(2)} `;
  }
  return s.trim();
}

function corLote(l: LotePlanta): string {
  if (l.tipo === "vendavel") return CORES_PLANTA.vendavel;
  if (l.restricao) return CORES_PLANTA.app;
  if (l.tipo === "nao_parcelavel") return CORES_PLANTA.naoParcelavel;
  return l.uso === "institucional" ? CORES_PLANTA.institucional : CORES_PLANTA.verde;
}

/** Comprimento "redondo" (1, 2, 5 × 10ⁿ m) para a escala gráfica ocupar ~alvoPx. */
export function comprimentoEscalaGrafica(escala: number, alvoPx = 120): number {
  const bruto = alvoPx / escala;
  const p = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const k of [5, 2, 1]) if (k * p <= bruto) return k * p;
  return p;
}

// ─── Rótulos sem sobreposição (R7) ──────────────────────────────────────────

/** Caixa de rótulo na tela: centro, meia-largura, meia-altura e ângulo (rad). */
export interface CaixaRotulo { cx: number; cy: number; hw: number; hh: number; ang: number }

/** Caixa serializada no SVG (data-caixa) — permite conferir a ausência de sobreposição fora do navegador. */
const caixaAttr = (c: CaixaRotulo) => [c.cx, c.cy, c.hw, c.hh, c.ang].map((n) => n.toFixed(3)).join(",");

/** Duas caixas giradas se sobrepõem? (teorema do eixo separador) */
export function colidem(a: CaixaRotulo, b: CaixaRotulo): boolean {
  if (Math.hypot(a.cx - b.cx, a.cy - b.cy) > Math.hypot(a.hw, a.hh) + Math.hypot(b.hw, b.hh)) return false;
  for (const t of [a.ang, a.ang + Math.PI / 2, b.ang, b.ang + Math.PI / 2]) {
    const ux = Math.cos(t), uy = Math.sin(t);
    const faixa = (c: CaixaRotulo) => {
      const centro = c.cx * ux + c.cy * uy;
      const r = Math.abs(c.hw * Math.cos(c.ang - t)) + Math.abs(c.hh * Math.sin(c.ang - t));
      return [centro - r, centro + r];
    };
    const [a0, a1] = faixa(a), [b0, b1] = faixa(b);
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}

/** Eixo do lado maior (tela): ângulo legível (−90°..90°), comprimento e largura da peça medidos nesse eixo. */
function eixoMaior(pts: [number, number][]): { ang: number; compr: number; larg: number } {
  let melhor = -1, ang = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (d > melhor) { melhor = d; ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); }
  }
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang <= -Math.PI / 2) ang += Math.PI;
  const ux = Math.cos(ang), uy = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of pts) {
    const u = x * ux + y * uy, w = -x * uy + y * ux;
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (w < v0) v0 = w; if (w > v1) v1 = w;
  }
  return { ang, compr: u1 - u0, larg: v1 - v0 };
}

/**
 * Escolhe o maior conjunto de linhas e a maior fonte (11 → 6,5 px) que cabem na peça e não colidem com
 * rótulos já desenhados; devolve o <text> ou null (rótulo omitido).
 */
/** Os quatro cantos da caixa ficam dentro da peça? (o rótulo de um lote nunca invade o vizinho) */
function caixaDentro(c: CaixaRotulo, poligono: [number, number][]): boolean {
  const ux = Math.cos(c.ang), uy = Math.sin(c.ang);
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = c.cx + a * c.hw * ux - b * c.hh * uy, y = c.cy + a * c.hw * uy + b * c.hh * ux;
    if (!pontoDentro(poligono, x, y)) return false;
  }
  return true;
}

function encaixarRotulo(linhas: string[], cx: number, cy: number, eixo: { ang: number; compr: number; larg: number }, ocupados: CaixaRotulo[], poligono?: [number, number][], idx?: number): string | null {
  for (let n = linhas.length; n >= 1; n--) {
    for (const fs of [11, 10, 9, 8, 7, 6.5]) {
      const fsSec = Math.max(6, fs * 0.86);
      const largura = Math.max(linhas[0].length * fs * 0.64, ...linhas.slice(1, n).map((t) => t.length * fsSec * 0.56));
      const altura = fs * 1.15 + (n - 1) * fsSec * 1.15;
      if (largura > eixo.compr * 0.92 || altura > eixo.larg * 0.88) continue;
      const caixa: CaixaRotulo = { cx, cy, hw: largura / 2 + 1, hh: altura / 2 + 1, ang: eixo.ang };
      if (poligono && !caixaDentro(caixa, poligono)) continue;
      if (ocupados.some((c) => colidem(c, caixa))) continue;
      ocupados.push(caixa);
      const graus = (eixo.ang * 180) / Math.PI;
      let y = -altura / 2 + fs * 0.92;
      const tsp = [`<tspan x="0" y="${y.toFixed(1)}" font-weight="700" font-size="${fs}">${esc(linhas[0])}</tspan>`];
      for (let k = 1; k < n; k++) { y += fsSec * 1.15; tsp.push(`<tspan x="0" y="${y.toFixed(1)}" font-size="${fsSec.toFixed(1)}">${esc(linhas[k])}</tspan>`); }
      return `<text data-rotulo="lote"${idx !== undefined ? ` data-idx="${idx}"` : ""} data-caixa="${caixaAttr(caixa)}" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${graus.toFixed(1)})">${tsp.join("")}</text>`;
    }
  }
  return null;
}

export interface OpcoesRender {
  selecionado?: number | null;
  /** Quadra destacada (normalmente a do lote selecionado). */
  quadra?: string | null;
  titulo?: string;
  legenda?: boolean;
}

/** Gera o SVG completo da planta para a vista informada. */
export function renderizarPlantaSvg(modelo: ModeloPlanta, v: VistaPlanta, o: OpcoesRender = {}): string {
  const W = v.larguraPx, H = v.alturaPx;
  const partes: string[] = [];
  partes.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif" data-planta="tecnica">`);
  partes.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${CORES_PLANTA.fundo}"/>`);

  // vias (corredores + balões)
  partes.push(`<g data-camada="vias">`);
  for (const r of [...modelo.ruas, ...modelo.baloes]) {
    partes.push(`<polygon points="${pontos(r, v)}" fill="${CORES_PLANTA.via}" stroke="${CORES_PLANTA.via}" stroke-width="0.6"/>`);
  }
  partes.push(`</g>`);

  // lotes
  const sel = o.selecionado ?? null;
  partes.push(`<g data-camada="lotes">`);
  for (const l of modelo.lotes) {
    const destaqueQuadra = o.quadra && l.quadra === o.quadra;
    const borda = l.idx === sel ? CORES_PLANTA.selecao : l.tipo === "vendavel" ? CORES_PLANTA.vendavelBorda : CORES_PLANTA.viaBorda;
    const larg = l.idx === sel ? 2.2 : destaqueQuadra ? 1.4 : 0.7;
    const estilo = `fill="${corLote(l)}" fill-opacity="${destaqueQuadra || l.idx === sel ? 1 : 0.92}" stroke="${borda}" stroke-width="${larg}" style="cursor:pointer"`;
    if (l.furos && l.furos.length > 0) {
      const d = [l.anel, ...l.furos].map((a) => `M${pontos(a, v).replace(/ /g, " L")} Z`).join(" ");
      partes.push(`<path data-lote="${l.idx}" d="${d}" fill-rule="evenodd" ${estilo}><title>${esc(rotuloLote(l))}</title></path>`);
    } else {
      partes.push(`<polygon data-lote="${l.idx}" points="${pontos(l.anel, v)}" ${estilo}><title>${esc(rotuloLote(l))}</title></polygon>`);
    }
  }
  partes.push(`</g>`);

  // perímetro da gleba (divisas)
  for (const anel of modelo.gleba) {
    partes.push(`<polygon data-camada="gleba" points="${pontos(anel, v)}" fill="none" stroke="${CORES_PLANTA.gleba}" stroke-width="2" stroke-dasharray="10 4 2 4"/>`);
  }

  // rótulos (R7): lote antes de quadra e de via; nenhum rótulo é desenhado por cima de outro. A fonte diminui e
  // o texto gira ao longo do lado maior até caber no lote; se não couber, o rótulo é omitido (fica na dica).
  partes.push(`<g data-camada="rotulos" pointer-events="none" fill="${CORES_PLANTA.texto}" text-anchor="middle">`);
  const ocupados: CaixaRotulo[] = [];
  const naTela = (p: Position): [number, number] => [v.tx + p[0] * v.escala, v.ty - p[1] * v.escala];
  const ordemLotes = [...modelo.lotes].sort((a, b) => (a.tipo === "vendavel" ? 0 : 1) - (b.tipo === "vendavel" ? 0 : 1) || b.areaM2 - a.areaM2 || a.idx - b.idx);
  for (const l of ordemLotes) {
    const [cx, cy] = naTela(l.centro);
    if (cx < -50 || cy < -50 || cx > W + 50 || cy > H + 50) continue;
    const tela = l.anel.map(naTela);
    const eixo = eixoMaior(tela);
    if (eixo.compr < 10 || eixo.larg < 7) continue;
    const nome = l.tipo === "vendavel" ? (l.numero ? `L${l.numero.padStart(2, "0")}` : "") : l.restricao ? ROTULO_RESTRICAO_GEO[l.restricao] : l.tipo === "nao_parcelavel" ? "NP" : l.uso === "institucional" ? "INST" : "AV";
    if (!nome) continue;
    const linhas = [nome, `${fmt(l.areaM2)} m²`];
    if (l.tipo === "vendavel") linhas.push(`${fmt(l.testadaM)} × ${fmt(l.profundidadeM)} m${l.irregular ? " (méd.)" : ""}`);
    const posto = encaixarRotulo(linhas, cx, cy, eixo, ocupados, tela, l.idx);
    if (posto) partes.push(posto);
  }
  // quadras: "Qxx" só onde não cobre número de lote (tenta o centro e pontos ao longo do eixo maior da quadra)
  for (const q of modelo.quadras) {
    const wpx = (q.bbox[2] - q.bbox[0]) * v.escala, hpx = (q.bbox[3] - q.bbox[1]) * v.escala;
    if (Math.max(wpx, hpx) < 40) continue;
    const destaque = o.quadra === q.quadra;
    const fs = destaque ? 15 : 13;
    const texto = `Q${q.quadra.padStart(2, "0")}`;
    const [cx0, cy0] = naTela(q.centro);
    const horizontal = wpx >= hpx;
    const desloc = [0, 0.18, -0.18, 0.36, -0.36, 0.45, -0.45];
    for (const f of desloc) {
      const cx = cx0 + (horizontal ? f * wpx : 0), cy = cy0 + (horizontal ? 0 : f * hpx);
      const caixa: CaixaRotulo = { cx, cy, hw: (texto.length * fs * 0.66) / 2 + 2, hh: fs * 0.6 + 1, ang: 0 };
      if (ocupados.some((c) => colidem(c, caixa))) continue;
      ocupados.push(caixa);
      partes.push(`<text data-rotulo="quadra" data-caixa="${caixaAttr(caixa)}" x="${cx.toFixed(1)}" y="${(cy + fs * 0.35).toFixed(1)}" font-size="${fs}" font-weight="900" fill="${destaque ? CORES_PLANTA.selecao : CORES_PLANTA.quadra}" fill-opacity="0.55">${esc(texto)}</text>`);
      break;
    }
  }
  // largura das vias (ao longo do maior lado de cada corredor), só onde não cobre outro rótulo
  for (const r of modelo.ruas) {
    const eixo = eixoMaior(r.map(naTela));
    if (eixo.compr < 140 || modelo.larguraViaM * v.escala < 9) continue;
    const [cx, cy] = naTela(centroideArea(r));
    const texto = `Via ${fmt(modelo.larguraViaM)} m`;
    const caixa: CaixaRotulo = { cx, cy, hw: (texto.length * 9 * 0.56) / 2 + 2, hh: 6, ang: eixo.ang };
    if (ocupados.some((c) => colidem(c, caixa))) continue;
    ocupados.push(caixa);
    partes.push(`<text data-rotulo="via" data-caixa="${caixaAttr(caixa)}" transform="translate(${cx.toFixed(1)},${(cy + 3).toFixed(1)}) rotate(${((eixo.ang * 180) / Math.PI).toFixed(1)})" font-size="9" fill="#374151">${esc(texto)}</text>`);
  }
  partes.push(`</g>`);

  // norte
  partes.push(`<g data-camada="norte" transform="translate(${W - 28},34)"><path d="M0,-18 L7,6 L0,1 L-7,6 Z" fill="#111827"/><text x="0" y="20" font-size="11" font-weight="700" text-anchor="middle">N</text></g>`);

  // escala gráfica
  const L = comprimentoEscalaGrafica(v.escala);
  const Lpx = L * v.escala;
  const ex = 16, ey = H - 22;
  partes.push(`<g data-camada="escala" font-size="10" fill="#111827">`);
  partes.push(`<rect x="${ex}" y="${ey}" width="${(Lpx / 2).toFixed(1)}" height="6" fill="#111827"/><rect x="${(ex + Lpx / 2).toFixed(1)}" y="${ey}" width="${(Lpx / 2).toFixed(1)}" height="6" fill="#fff" stroke="#111827" stroke-width="1"/>`);
  partes.push(`<text x="${ex}" y="${ey - 4}">0</text><text x="${(ex + Lpx).toFixed(1)}" y="${ey - 4}" text-anchor="middle">${esc(L.toLocaleString("pt-BR"))} m</text>`);
  partes.push(`<text x="${ex}" y="${ey + 17}" font-size="9" fill="#4b5563">Escala gráfica · 1 px ≈ ${esc(fmt(1 / v.escala, 2))} m</text>`);
  partes.push(`</g>`);

  if (o.legenda !== false) {
    const itens: [string, string][] = [
      [CORES_PLANTA.vendavel, `Lotes vendáveis (${modelo.nLotesVendaveis})`],
      [CORES_PLANTA.institucional, "Área institucional"],
      [CORES_PLANTA.verde, "Área verde"],
      [CORES_PLANTA.naoParcelavel, "Não parcelável"],
      ...(modelo.restricoes ?? []).map((r): [string, string] => [CORES_PLANTA.app, `${r.rotulo} (contorno real) · ${fmt(r.areaM2)} m² · ${r.destino}`]),
      [CORES_PLANTA.via, `Sistema viário · ${fmt(modelo.areaViariaM2)} m² · via ${fmt(modelo.larguraViaM)} m`],
    ];
    const lw = (modelo.restricoes ?? []).length > 0 ? 340 : 270, lh = 18 + itens.length * 15 + 16;
    const lx = W - lw - 10, ly = H - lh - 10;
    partes.push(`<g data-camada="legenda" font-size="10" fill="#111827"><rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="#ffffff" fill-opacity="0.94" stroke="#9ca3af"/>`);
    partes.push(`<text x="${lx + 8}" y="${ly + 13}" font-weight="700">Legenda${o.titulo ? ` · ${esc(o.titulo)}` : ""}</text>`);
    itens.forEach(([cor, txt], i) => {
      const y = ly + 20 + i * 15;
      partes.push(`<rect x="${lx + 8}" y="${y}" width="12" height="10" fill="${cor}" stroke="#6b7280" stroke-width="0.6"/><text x="${lx + 26}" y="${y + 9}">${esc(txt)}</text>`);
    });
    partes.push(`<text x="${lx + 8}" y="${ly + lh - 6}" font-size="8.5" fill="#92400e">${esc(ROTULO_ESTUDO_PRELIMINAR)}</text></g>`);
  }
  partes.push(`</svg>`);
  return partes.join("");
}

export function rotuloLote(l: LotePlanta): string {
  const dims = `${fmt(l.testadaM)} × ${fmt(l.profundidadeM)} m`;
  if (l.tipo === "vendavel") return `${l.codigo ?? "Lote"} · ${fmt(l.areaM2)} m² · ${l.irregular ? `testada ${fmt(l.testadaM)} m, profundidade média ${fmt(l.profundidadeM)} m (lote de borda)` : dims}`;
  if (l.restricao) return `${ROTULO_RESTRICAO_GEO[l.restricao]} (contorno real) · ${fmt(l.areaM2)} m² · ${destinoDaPeca(l)}`;
  if (l.tipo === "nao_parcelavel") return `Não parcelável (restrição) · ${fmt(l.areaM2)} m²`;
  return `${l.uso === "institucional" ? "Área institucional" : "Área verde"} · ${fmt(l.areaM2)} m²${l.irregular ? "" : ` · ${dims}`}`;
}
