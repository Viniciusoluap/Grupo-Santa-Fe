/**
 * Lote 02, correção 05 — Mapa Operacional: camadas (satélite Esri com ruas e
 * rótulos, ou mapa OSM), alfinetes por tipo/status e rótulo dos agrupamentos.
 * Regras puras (sem Leaflet) para teste. Gêmeo em
 * Prospecta/shared/mapa-alfinetes.ts (mesmo conteúdo).
 *
 * Provedores: Esri World Imagery + referências (World_Transportation e
 * World_Boundaries_and_Places), uso com atribuição obrigatória; OpenStreetMap
 * com atribuição (política de uso de tiles da OSMF). Nenhuma coordenada é
 * inventada: só entram pontos com latitude/longitude válidas do cadastro.
 */

export type CategoriaPonto = "disponivel" | "reservado" | "obra" | "outro";

export const CATEGORIAS_PONTO: Record<CategoriaPonto, { cor: string; rotulo: string }> = {
  disponivel: { cor: "#15803d", rotulo: "Imóvel disponível" },
  reservado: { cor: "#c2410c", rotulo: "Imóvel reservado" },
  obra: { cor: "#1d4ed8", rotulo: "Obra" },
  outro: { cor: "#4b5563", rotulo: "Outro imóvel" },
};

/** Obra pelo tipo do ponto; imóvel pela situação comercial. */
export function categoriaDoPonto(p: { kind: string; status?: string | null }): CategoriaPonto {
  if (p.kind === "obra") return "obra";
  if (p.status === "disponivel") return "disponivel";
  if (p.status === "reservado") return "reservado";
  return "outro";
}

/** Coordenada válida (número finito dentro dos limites); nunca completa nem estima. */
export function coordenadaValida(lat: unknown, lng: unknown): [number, number] | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === "" || lng === "") return null;
  const a = Number(lat);
  const o = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(o) || Math.abs(a) > 90 || Math.abs(o) > 180) return null;
  return [a, o];
}

export const TAMANHO_ALFINETE = { largura: 30, altura: 42 } as const;

/** Alfinete em SVG (gota com círculo interno). `rotulo` vira o título acessível. */
export function htmlAlfinete(categoria: CategoriaPonto): string {
  const { cor, rotulo } = CATEGORIAS_PONTO[categoria];
  const { largura, altura } = TAMANHO_ALFINETE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 30 42" role="img" aria-label="${rotulo}">`
    + `<title>${rotulo}</title>`
    + `<path d="M15 1C7.3 1 1 7.2 1 14.9c0 10.4 12.3 24.6 12.8 25.2a1.6 1.6 0 0 0 2.4 0C16.7 39.5 29 25.3 29 14.9 29 7.2 22.7 1 15 1z" fill="${cor}" stroke="#ffffff" stroke-width="2"/>`
    + `<circle cx="15" cy="15" r="5.5" fill="#ffffff"/>`
    + `</svg>`;
}

/** Texto e tamanho do agrupamento (cluster) conforme a quantidade de pontos. */
export function estiloAgrupamento(quantidade: number): { texto: string; tamanho: number } {
  const tamanho = quantidade < 10 ? 34 : quantidade < 100 ? 40 : 48;
  return { texto: quantidade > 999 ? "999+" : String(quantidade), tamanho };
}

export const CAMADAS_MAPA = {
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagens &copy; Esri &mdash; Fonte: Esri, Maxar, Earthstar Geographics e a comunidade de usuários GIS",
    maxNativeZoom: 19,
  },
  ruas: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    attribution: "Ruas &copy; Esri",
    maxNativeZoom: 19,
  },
  rotulos: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Rótulos &copy; Esri",
    maxNativeZoom: 19,
  },
  mapa: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  /** Zoom máximo do mapa (acima do nativo o tile é ampliado, sem tela cinza). */
  maxZoom: 20,
} as const;
