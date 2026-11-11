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
import { criarProjecao, ROTULO_ESTUDO_PRELIMINAR, type CenarioMassa, type LoteGerado } from "@/lib/geo/massa-parcelamento";
import { areaPlanar } from "@/lib/geo/geometria-parcelamento";
import { formatarCodigoLote } from "@/lib/incorporacao/unidades";

export const CORES_PLANTA = {
  fundo: "#ffffff",
  gleba: "#111827",
  vendavel: "#fde68a",
  vendavelBorda: "#92400e",
  institucional: "#bfdbfe",
  verde: "#bbf7d0",
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
}

function centroide(anel: Position[]): [number, number] {
  const n = anel.length - 1;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += anel[i][0]; y += anel[i][1]; }
  return [x / n, y / n];
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
    return {
      idx, anel, tipo: l.tipo, uso: l.uso, quadra: l.quadra, numero: l.numero,
      codigo: l.quadra && l.numero ? formatarCodigoLote(l.quadra, l.numero) : null,
      // lote que acompanha a divisa: anel irregular → usa testada real e profundidade média do motor
      areaM2: l.areaM2 || areaPlanar(anel), testadaM: l.testadaM ?? d0, profundidadeM: l.profundidadeMediaM ?? d1,
      centro: centroide(anel), angulo: ang,
    };
  });
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
    partes.push(`<polygon data-lote="${l.idx}" points="${pontos(l.anel, v)}" fill="${corLote(l)}" fill-opacity="${destaqueQuadra || l.idx === sel ? 1 : 0.92}" stroke="${borda}" stroke-width="${larg}" style="cursor:pointer"><title>${esc(rotuloLote(l))}</title></polygon>`);
  }
  partes.push(`</g>`);

  // perímetro da gleba (divisas)
  for (const anel of modelo.gleba) {
    partes.push(`<polygon data-camada="gleba" points="${pontos(anel, v)}" fill="none" stroke="${CORES_PLANTA.gleba}" stroke-width="2" stroke-dasharray="10 4 2 4"/>`);
  }

  // rótulos dos lotes conforme o zoom
  partes.push(`<g data-camada="rotulos" pointer-events="none" fill="${CORES_PLANTA.texto}" text-anchor="middle">`);
  for (const l of modelo.lotes) {
    const menorPx = Math.min(l.testadaM, l.profundidadeM) * v.escala;
    const maiorPx = Math.max(l.testadaM, l.profundidadeM) * v.escala;
    if (menorPx < 14) continue;
    const cx = v.tx + l.centro[0] * v.escala, cy = v.ty - l.centro[1] * v.escala;
    if (cx < -50 || cy < -50 || cx > W + 50 || cy > H + 50) continue;
    // rotaciona o texto ao longo do maior lado (legível em lotes estreitos e compridos)
    let rot = l.profundidadeM > l.testadaM ? -(l.angulo + 90) : -l.angulo;
    rot = ((rot % 180) + 180) % 180; if (rot > 90) rot -= 180;
    const linhas: string[] = [];
    const nome = l.tipo === "vendavel" ? (l.numero ? `L${l.numero.padStart(2, "0")}` : "") : l.tipo === "nao_parcelavel" ? "NP" : l.uso === "institucional" ? "INST" : "AV";
    if (nome) linhas.push(`<tspan x="0" dy="0" font-weight="700" font-size="11">${esc(nome)}</tspan>`);
    if (maiorPx >= 46 && menorPx >= 22) linhas.push(`<tspan x="0" dy="12" font-size="9.5">${esc(fmt(l.areaM2))} m²</tspan>`);
    if (maiorPx >= 90 && menorPx >= 34) linhas.push(`<tspan x="0" dy="11" font-size="9">${esc(`${fmt(l.testadaM)} × ${fmt(l.profundidadeM)} m`)}</tspan>`);
    partes.push(`<text transform="translate(${cx.toFixed(1)},${(cy - (linhas.length - 1) * 5).toFixed(1)}) rotate(${rot.toFixed(1)})">${linhas.join("")}</text>`);
  }
  // quadras
  for (const q of modelo.quadras) {
    const wpx = (q.bbox[2] - q.bbox[0]) * v.escala, hpx = (q.bbox[3] - q.bbox[1]) * v.escala;
    if (Math.max(wpx, hpx) < 40) continue;
    const cx = v.tx + q.centro[0] * v.escala, cy = v.ty - q.centro[1] * v.escala;
    const destaque = o.quadra === q.quadra;
    partes.push(`<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" font-size="${destaque ? 15 : 13}" font-weight="900" fill="${destaque ? CORES_PLANTA.selecao : CORES_PLANTA.quadra}" fill-opacity="0.55">Q${esc(q.quadra.padStart(2, "0"))}</text>`);
  }
  // largura das vias (ao longo do maior lado de cada corredor)
  for (const r of modelo.ruas) {
    let melhor = 0, ang = 0;
    for (let i = 0; i < r.length - 1; i++) {
      const d = Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]);
      if (d > melhor) { melhor = d; ang = (Math.atan2(r[i + 1][1] - r[i][1], r[i + 1][0] - r[i][0]) * 180) / Math.PI; }
    }
    if (melhor * v.escala < 140 || modelo.larguraViaM * v.escala < 9) continue;
    const c = centroide(r);
    const cx = v.tx + c[0] * v.escala, cy = v.ty - c[1] * v.escala;
    let rot = -ang; rot = ((rot % 180) + 180) % 180; if (rot > 90) rot -= 180;
    partes.push(`<text transform="translate(${cx.toFixed(1)},${(cy + 3).toFixed(1)}) rotate(${rot.toFixed(1)})" font-size="9" fill="#374151">Via ${esc(fmt(modelo.larguraViaM))} m</text>`);
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
      [CORES_PLANTA.via, `Sistema viário · ${fmt(modelo.areaViariaM2)} m² · via ${fmt(modelo.larguraViaM)} m`],
    ];
    const lw = 270, lh = 18 + itens.length * 15 + 16;
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
  if (l.tipo === "vendavel") return `${l.codigo ?? "Lote"} · ${fmt(l.areaM2)} m² · ${dims}`;
  if (l.tipo === "nao_parcelavel") return `Não parcelável (restrição) · ${fmt(l.areaM2)} m²`;
  return `${l.uso === "institucional" ? "Área institucional" : "Área verde"} · ${fmt(l.areaM2)} m² · ${dims}`;
}
