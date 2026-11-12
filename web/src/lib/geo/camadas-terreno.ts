// Camadas ambientais e de restrição do mapa do terreno (Incorporação) — núcleo
// PURO, idêntico no Prospecta (shared/geo/camadas-terreno.ts) e no Grupo Santa Fé
// (web/src/lib/geo/camadas-terreno.ts). Pedido do dono de 11/11: o mapa tem que
// buscar APP, supressão vegetal, faixa de servidão, UCs, geologia e furos como o
// concorrente (Lotelytics). Aqui ficam: as fontes oficiais (URLs e campos), a
// normalização das respostas (ArcGIS REST/GeoJSON e Overpass) e os cálculos
// (APP pelo Código Florestal, % de vegetação nativa, área em faixa de servidão,
// distância das UCs, leitura da geologia e dos poços). A busca em rede fica no
// servidor (camadas-terreno-busca) e o desenho no componente do mapa.
// Investigação e fontes: docs/handoffs/mapa/INVESTIGACAO-MOTOR.md.
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, LineString, MultiPolygon, Point, Polygon, Position } from "geojson";
import {
  area as turfArea, bbox as turfBbox, bboxClip, booleanIntersects, booleanPointInPolygon, buffer as turfBuffer,
  centroid as turfCentroid, difference, distance as turfDistance, featureCollection, flatten, intersect,
  length as turfLength, lineString, point, pointToLineDistance, polygon as turfPolygon, polygonToLine, union,
} from "@turf/turf";

export type Bbox = [number, number, number, number]; // [oeste, sul, leste, norte]
export type Contorno = Feature<Polygon | MultiPolygon>;
export type Poligonal = Feature<Polygon | MultiPolygon>;

export type IdCamada = "hidrografia" | "osm" | "vegetacao" | "ucs" | "transmissao" | "rodovias" | "geologia" | "furos" | "car" | "mananciais" | "ferrovias" | "dutos";
export const IDS_CAMADAS: readonly IdCamada[] = ["hidrografia", "osm", "vegetacao", "ucs", "transmissao", "rodovias", "geologia", "furos", "car", "mananciais", "ferrovias", "dutos"];

/** Estado de cada camada na legenda: carregada, sem ocorrência ou indisponível (com a fonte). */
export type EstadoCamada<T> = {
  estado: "ok" | "vazio" | "indisponivel";
  /** Fonte que respondeu (ou as tentadas, quando indisponível). */
  fonte: string;
  consultadoEm: string;
  erro?: string;
  dados?: T;
};

// ─── Tipos dos dados normalizados ───────────────────────────────────────────

export type PropsRio = { nome: string | null; origem: "ANA" | "DNIT" | "OSM"; ordem: number | null; larguraM: number | null; tipo: string | null };
export type PropsAgua = { nome: string | null; origem: "ANA" | "OSM"; /** largura média estimada (2·área/perímetro) ANTES do recorte */ larguraM: number | null };
export type PropsNascente = { origem: "ANA" | "OSM" };
export type DadosHidro = { rios: Feature<LineString, PropsRio>[]; aguas: Feature<Polygon, PropsAgua>[]; nascentes: Feature<Point, PropsNascente>[] };
export type PropsVia = { nome: string | null; ref: string | null; tipo: string };
export type PropsLinha = { nome: string | null; tensaoKv: number | null; origem: "EPE" | "IBAMA" | "OSM" };
export type DadosOsm = DadosHidro & { vias: Feature<LineString, PropsVia>[]; linhas: Feature<LineString, PropsLinha>[] };
export type PropsCelula = { classe: number; nome: string; nativa: boolean; florestal: boolean };
export type DadosVegetacao = { celulas: Feature<Polygon, PropsCelula>[]; ladoM: number; colecao: string };
export type UnidadeConservacao = { nome: string; categoria: string | null; esfera: string | null; grupo: string | null; distanciaM: number; sobrepoe: boolean };
export type DadosUcs = { ucs: UnidadeConservacao[]; raioM: number; geometrias: Feature<Polygon | MultiPolygon, { nome: string }>[] };
export type DadosTransmissao = { linhas: Feature<LineString, PropsLinha>[] };
export type PropsRodovia = { nome: string; jurisdicao: string | null; situacao: string | null };
export type DadosRodovias = { rodovias: Feature<LineString, PropsRodovia>[] };
export type UnidadeGeologica = {
  sigla: string; nome: string; litotipo: string | null; dominio: string | null; relevo: string | null;
  declividade: string | null; coerencia: string | null; mapa: string | null;
};
export type AvaliacaoGeologia = { risco: "baixo" | "medio" | "alto"; rotulo: string; motivo: string };
export type DadosGeologia = { unidades: UnidadeGeologica[]; avaliacao: AvaliacaoGeologia };
export type Poco = { nome: string | null; natureza: string | null; profundidadeM: number | null; nivelEstaticoM: number | null; aquifero: string | null; distanciaM: number; coordenadas: [number, number] };
export type DadosFuros = { pocos: Poco[]; raioM: number };

/** Imóvel do CAR (SICAR, base pública) que sobrepõe o terreno. */
export type ImovelCar = { codigo: string; status: string | null; tipo: string | null; municipio: string | null; areaHa: number | null; areaSobrepostaM2: number; percentualDoTerreno: number };
export type DadosCar = { imoveis: ImovelCar[]; geometrias: Feature<Polygon | MultiPolygon, { codigo: string }>[]; percentualCoberto: number };
/** Captação de abastecimento público (ANA, Atlas Águas) perto do terreno. */
export type Captacao = { nome: string | null; manancial: string | null; tipo: "superficial" | "subterranea"; sistema: string | null; municipio: string | null; situacao: string | null; distanciaM: number; coordenadas: [number, number] };
export type MassaAbastecimento = { nome: string | null; sistemas: string | null; distanciaM: number };
export type DadosMananciais = { captacoes: Captacao[]; massas: MassaAbastecimento[]; geometrias: Feature<Polygon | MultiPolygon, { nome: string | null }>[]; raioM: number };
export type PropsFerrovia = { nome: string | null; concessionaria: string | null; bitola: string | null; origem: "DNIT" | "IBAMA" | "OSM" };
export type DadosFerrovias = { ferrovias: Feature<LineString, PropsFerrovia>[] };
export type PropsDuto = { nome: string | null; tipo: "gasoduto de transporte" | "gasoduto de distribuição" | "duto de escoamento" | "duto"; operador: string | null; origem: "EPE" | "IBAMA" | "OSM" };
export type DadosDutos = { dutos: Feature<LineString, PropsDuto>[] };

export type DadosCamadas = {
  hidrografia: DadosHidro; osm: DadosOsm; vegetacao: DadosVegetacao; ucs: DadosUcs;
  transmissao: DadosTransmissao; rodovias: DadosRodovias; geologia: DadosGeologia; furos: DadosFuros;
  car: DadosCar; mananciais: DadosMananciais; ferrovias: DadosFerrovias; dutos: DadosDutos;
};
export type RespostaCamadasTerreno = { camadas: { [K in IdCamada]?: EstadoCamada<DadosCamadas[K]> }; geradoEm: string };

// ─── Fontes oficiais (testadas em 11/11/2026 com Imperatriz/MA) ─────────────

const SNIRH = "https://www.snirh.gov.br/arcgis/rest/services";
const PAMGIA = "https://pamgia.ibama.gov.br/server/rest/services";
const SGB = "https://geoportal.sgb.gov.br/server/rest/services";
const EPE = "https://gisepeprd2.epe.gov.br/arcgis/rest/services";

export const FONTES = {
  bhoTrechos: { nome: "ANA/SNIRH — BHO 2017 1:5.000 (trechos de drenagem)", url: `${SNIRH}/SPR/BHO2017_5K_TRECHODRENAGEM/MapServer/0`, campos: "NORIOCOMP,NUSTRAHLER,DEDOMINIAL" },
  dnitRios: { nome: "DNIT via IBAMA (Pamgia) — rios", url: `${PAMGIA}/01_Publicacoes_Bases/hid_trecho_drenagem_l/MapServer/5`, campos: "nome,larguramed" },
  massaDagua: { nome: "ANA/SNIRH — massas d'água", url: `${SNIRH}/SPR/Massa_dagua/MapServer/0`, campos: "nmoriginal,detipomass" },
  massaDaguaEspelho: { nome: "ANA via IBAMA (Pamgia) — massas d'água", url: `${PAMGIA}/BasesSincronizadas/lim_bho_massa_dagua_ana_p/MapServer/0`, campos: "nmoriginal,detipomass" },
  ucs: { nome: "CNUC/MMA via IBAMA (Pamgia)", url: `${PAMGIA}/BasesSincronizadas/lim_unidades_conserva%C3%A7%C3%A3o_mma_a/MapServer/0`, campos: "nome_uc,categoria,esfera,grupo" },
  ucsEspelho: { nome: "CNUC via IBAMA (SIGAGEO)", urls: [21, 20, 22].map(n => `${PAMGIA}/SIGAGEO/bases/MapServer/${n}`), campos: "nome_uc,categoria,esfera,grupo" },
  ltEpe: { nome: "EPE — Webmap, linhas de transmissão em operação", url: `${EPE}/SMA/ENG_Webmap_EPE_Sistema_Eletrico_Existente/MapServer/9`, campos: "Nome,Tensao" },
  ltIbama: { nome: "IBAMA (SIGA Geo) — linhas de transmissão licenciadas", url: `${PAMGIA}/21_SIGA_Geo/linha_transmissao/MapServer/0`, campos: "nomeempreendimento" },
  rodoviasDnit: { nome: "DNIT/SNV via IBAMA (Pamgia) — rodovias federais", url: `${PAMGIA}/BasesSincronizadas/line_rodovias_federais_dnit_l/MapServer/0`, campos: "vl_br,sg_uf,ds_jurisdi,ds_legenda" },
  geologia: { nome: "SGB/CPRM — Geodiversidade dos estados", url: `${SGB}/gestaoterritorial/geodiversidade_estados/MapServer` },
  siagas: { nome: "SGB/CPRM — SIAGAS (poços)", url: `${SGB}/hidrologia/SIAGAS_MODDAD/MapServer/0`, campos: "str_nome_ponto,str_natureza_ponto,num_profundidade,ne,str_aquifero" },
  mapbiomas: { nome: "MapBiomas Coleção 2023 via EPE", url: `${EPE}/MapBiomas_2023/MapServer` },
  car: { nome: "CAR/SICAR (base pública) via IBAMA (Pamgia)", url: `${PAMGIA}/CAR_NACIONAL/Cadastro_Ambiental_Rural__%C3%81rea_Im%C3%B3vel_/MapServer` },
  captacoes: { nome: "ANA — Atlas Águas (captações de abastecimento)", urls: [1, 0].map(n => `${SNIRH}/AtlasAguas2020/captacoes/MapServer/${n}`), campos: "nm_captaca,nm_fantasi,tp_captaca,sistema,nm_municip,status_man" },
  massasAbastecimento: { nome: "ANA — Atlas Águas (massas d'água de abastecimento)", url: `${SNIRH}/Atlas2020/Massa_dagua_abastecimento/MapServer/0`, campos: "nome_massa,nome_siste" },
  ferroviasDnit: { nome: "DNIT via IBAMA (Pamgia) — ferrovias federais", url: `${PAMGIA}/BasesSincronizadas/line_ferrovias_federais_dnit_l/MapServer/0`, campos: "linha,concessionaria,bitola" },
  ferroviasIbama: { nome: "IBAMA (SIGA Geo) — ferrovias licenciadas", url: `${PAMGIA}/21_SIGA_Geo/ferrovia/MapServer/0`, campos: "nomeempreendimento" },
  dutosEpe: { nome: "EPE — Webmap, infraestrutura de gás natural", camadas: [
    { url: `${EPE}/SMA/Webmap_EPE_Infraestrutura_de_Gas_Natural/MapServer/5`, campos: "Nome_Dut_1,Categoria,Transporta", tipo: "gasoduto de transporte" },
    { url: `${EPE}/SMA/Webmap_EPE_Infraestrutura_de_Gas_Natural/MapServer/6`, campos: "Distrib", tipo: "gasoduto de distribuição" },
    { url: `${EPE}/SMA/Webmap_EPE_Infraestrutura_de_Gas_Natural/MapServer/7`, campos: "DUTO_ID,Categoria,FLUIDO", tipo: "duto de escoamento" },
  ] },
  dutosIbama: { nome: "IBAMA (SIGA Geo) — dutos licenciados", url: `${PAMGIA}/21_SIGA_Geo/duto/MapServer/0`, campos: "nomeempreendimento,tipologia" },
  overpass: { nome: "OpenStreetMap (Overpass)", urls: ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"] },
} as const;

/** Folga de busca em volta do terreno por camada (m). APP de 500 m exige rios a até 500 m. */
export const FOLGA_M = { hidrografia: 600, osm: 600, transmissao: 250, rodovias: 250, ucs: 3000, furos: 5000, mananciais: 5000, ferrovias: 250, dutos: 250 } as const;

// ─── Geometria utilitária ───────────────────────────────────────────────────

export function bboxComFolga(contorno: Feature, metros: number): Bbox {
  const [w, s, e, n] = turfBbox(contorno) as Bbox;
  const latMedia = (s + n) / 2;
  const dLat = metros / 110_540;
  const dLng = metros / (111_320 * Math.cos((latMedia * Math.PI) / 180));
  return [w - dLng, s - dLat, e + dLng, n + dLat].map(v => Number(v.toFixed(6))) as Bbox;
}

/** Chave de cache estável do terreno (bbox arredondado + nº de vértices). */
export function chaveDoTerreno(contorno: Contorno): string {
  const b = (turfBbox(contorno) as number[]).map(v => v.toFixed(5)).join(",");
  const vertices = contorno.geometry.type === "Polygon"
    ? contorno.geometry.coordinates.flat().length
    : contorno.geometry.coordinates.flat(2).length;
  return `${b}#${vertices}`;
}

/** URL de `query` do ArcGIS REST por envelope (bbox), devolvendo GeoJSON em WGS84. */
export function urlConsultaArcgis(base: string, b: Bbox, campos: string, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams({
    geometry: b.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: campos, returnGeometry: "true", outSR: "4326", geometryPrecision: "6", f: "geojson",
  });
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return `${base}/query?${p.toString()}`;
}

/** Converte o contorno em anéis Esri JSON (para `identify` por polígono). */
export function aneisEsri(contorno: Contorno): string {
  const rings = contorno.geometry.type === "Polygon" ? contorno.geometry.coordinates : contorno.geometry.coordinates.flat();
  return JSON.stringify({ rings, spatialReference: { wkid: 4326 } });
}

export function urlIdentifyGeologia(contorno: Contorno): { url: string; corpo: string } {
  const b = bboxComFolga(contorno, 200);
  const p = new URLSearchParams({
    geometry: aneisEsri(contorno), geometryType: "esriGeometryPolygon", sr: "4326", layers: "all", tolerance: "0",
    mapExtent: b.join(","), imageDisplay: "400,400,96", returnGeometry: "false", f: "json",
  });
  return { url: `${FONTES.geologia.url}/identify`, corpo: p.toString() };
}

/** `identify` do CAR com o polígono do terreno: uma requisição cobre as 27 camadas (uma por UF). */
export function urlIdentifyCar(contorno: Contorno): { url: string; corpo: string } {
  const b = bboxComFolga(contorno, 200);
  const p = new URLSearchParams({
    geometry: aneisEsri(contorno), geometryType: "esriGeometryPolygon", sr: "4326", layers: "all", tolerance: "0",
    mapExtent: b.join(","), imageDisplay: "400,400,96", returnGeometry: "true", geometryPrecision: "6", f: "json",
  });
  return { url: `${FONTES.car.url}/identify`, corpo: p.toString() };
}

export function urlIdentifyMapbiomas(pontos: Position[], contorno: Contorno): { url: string; corpo: string } {
  const b = bboxComFolga(contorno, 200);
  const p = new URLSearchParams({
    geometry: JSON.stringify({ points: pontos.map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]), spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryMultipoint", sr: "4326", layers: "all", tolerance: "0",
    mapExtent: b.join(","), imageDisplay: "400,400,96", returnGeometry: "true", f: "json",
  });
  return { url: `${FONTES.mapbiomas.url}/identify`, corpo: p.toString() };
}

export function consultaOverpass(b: Bbox): string {
  const [w, s, e, n] = b;
  const c = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:20];(` +
    `way["waterway"]${c};way["natural"="water"]${c};way["waterway"="riverbank"]${c};relation["natural"="water"]${c};` +
    `node["natural"="spring"]${c};` +
    `way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"]${c};` +
    `way["power"~"line|minor_line"]${c};` +
    `);out geom;`;
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Aceita só FeatureCollection válida (o ArcGIS devolve `{error}` com HTTP 200). */
export function exigirFeatureCollection(json: unknown): FeatureCollection {
  if (!ehObjeto(json)) throw new Error("Resposta vazia.");
  if (ehObjeto(json.error)) throw new Error(String(json.error.message ?? "Erro do serviço."));
  if (json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("Resposta fora do formato GeoJSON.");
  return json as unknown as FeatureCollection;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() && v.trim() !== "Null" ? v.trim() : null);
const numero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

function linhasDe(geom: Geometry | null): Position[][] {
  if (!geom) return [];
  if (geom.type === "LineString") return [geom.coordinates];
  if (geom.type === "MultiLineString") return geom.coordinates;
  return [];
}
function poligonosDe(geom: Geometry | null): Position[][][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
}

/** Recorta linhas ao bbox (descarta o que ficou fora). */
export function recortarLinhas<P extends GeoJsonProperties>(feats: Feature<LineString, P>[], b: Bbox): Feature<LineString, P>[] {
  const out: Feature<LineString, P>[] = [];
  for (const f of feats) {
    const r = bboxClip(f, b);
    for (const coords of linhasDe(r.geometry)) if (coords.length >= 2) out.push(lineString(coords, f.properties) as Feature<LineString, P>);
  }
  return out;
}

/** Recorta polígonos ao bbox (o rio Tocantins inteiro vira só o trecho perto do terreno). */
export function recortarPoligonos<P extends GeoJsonProperties>(feats: Feature<Polygon, P>[], b: Bbox): Feature<Polygon, P>[] {
  const out: Feature<Polygon, P>[] = [];
  for (const f of feats) {
    try {
      const r = bboxClip(f, b);
      for (const aneis of poligonosDe(r.geometry)) {
        const validos = aneis.filter(a => a.length >= 4);
        if (validos.length && turfArea(turfPolygon(validos)) > 1) out.push(turfPolygon(validos, f.properties) as Feature<Polygon, P>);
      }
    } catch { /* anel degenerado */ }
  }
  return out;
}

// ─── Normalização: hidrografia (ANA / DNIT / OSM) ───────────────────────────

export function normalizarTrechosBho(fc: FeatureCollection): Feature<LineString, PropsRio>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const props: PropsRio = { nome: texto(p.NORIOCOMP), origem: "ANA", ordem: numero(p.NUSTRAHLER), larguraM: null, tipo: null };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsRio>);
  });
}

export function normalizarRiosDnit(fc: FeatureCollection): Feature<LineString, PropsRio>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const largura = numero(p.larguramed);
    const props: PropsRio = { nome: texto(p.nome), origem: "DNIT", ordem: null, larguraM: largura && largura > 0 ? largura : null, tipo: null };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsRio>);
  });
}

export function normalizarMassasDagua(fc: FeatureCollection, origem: "ANA" | "OSM" = "ANA"): Feature<Polygon, PropsAgua>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const nome = texto(p.nmoriginal) ?? texto(p.nmriocomp);
    return poligonosDe(f.geometry).filter(a => a[0]?.length >= 4)
      .map(a => turfPolygon(a, { nome, origem, larguraM: null }) as Feature<Polygon, PropsAgua>)
      .map(pol => ({ ...pol, properties: { ...pol.properties, larguraM: larguraMediaAgua(pol) } }));
  });
}

/** Largura média de uma lâmina d'água alongada ≈ 2 × área / perímetro (m). */
export function larguraMediaAgua(agua: Feature<Polygon>): number | null {
  try {
    const perimetroM = turfLength(polygonToLine(agua) as Feature, { units: "kilometers" }) * 1000;
    return perimetroM > 0 ? Math.round((2 * turfArea(agua)) / perimetroM) : null;
  } catch { return null; }
}

const mesmo = (a: Position, b: Position) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;

/**
 * Nascentes da BHO: a BHO é orientada no sentido do escoamento, então o 1º vértice
 * de um trecho de ordem 1 (Strahler) que não encosta em nenhum outro trecho é a
 * cabeceira. Só vale dentro do bbox (pontas recortadas não são nascentes).
 */
export function derivarNascentesBho(rios: Feature<LineString, PropsRio>[], b: Bbox): Feature<Point, PropsNascente>[] {
  const pontas = rios.flatMap(r => {
    const c = r.geometry.coordinates;
    return [c[0], c[c.length - 1]];
  });
  const dentro = ([x, y]: Position) => x > b[0] && x < b[2] && y > b[1] && y < b[3];
  const out: Feature<Point, PropsNascente>[] = [];
  for (const r of rios) {
    if (r.properties.ordem !== 1) continue;
    const inicio = r.geometry.coordinates[0];
    const encostos = pontas.filter(p => mesmo(p, inicio)).length; // ele mesmo conta 1
    if (encostos === 1 && dentro(inicio) && !out.some(n => mesmo(n.geometry.coordinates, inicio))) {
      out.push(point(inicio, { origem: "ANA" }) as Feature<Point, PropsNascente>);
    }
  }
  return out;
}

export interface ElementoOverpass {
  type: "node" | "way" | "relation";
  tags?: Record<string, string>;
  lat?: number; lon?: number;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
}

/** Costura trechos de way (relações multipolígono do OSM) em anéis fechados. */
export function montarAneis(trechos: Position[][]): Position[][] {
  const pendentes = trechos.filter(t => t.length > 1).map(t => [...t]);
  const aneis: Position[][] = [];
  while (pendentes.length > 0) {
    const anel = pendentes.shift()!;
    let fechado = mesmo(anel[0], anel[anel.length - 1]);
    let progrediu = true;
    while (!fechado && progrediu) {
      progrediu = false;
      const fim = anel[anel.length - 1];
      for (let i = 0; i < pendentes.length; i++) {
        const w = pendentes[i];
        if (mesmo(w[0], fim)) anel.push(...w.slice(1));
        else if (mesmo(w[w.length - 1], fim)) anel.push(...[...w].reverse().slice(1));
        else continue;
        pendentes.splice(i, 1);
        progrediu = true;
        break;
      }
      fechado = mesmo(anel[0], anel[anel.length - 1]);
    }
    if (fechado && anel.length >= 4) aneis.push(anel);
  }
  return aneis;
}

/** "13800" (V) → 13,8 kV; "138 kV" → 138; "230000;69000" → maior tensão. */
export function tensaoOsmKv(tag: string | undefined): number | null {
  if (!tag) return null;
  const valores = tag.split(/[;,]/).map(s => {
    const n = Number(s.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return /kv/i.test(s) ? n : n >= 1000 ? n / 1000 : n;
  }).filter((n): n is number => n != null);
  return valores.length ? Math.max(...valores) : null;
}

export function normalizarOverpass(json: unknown): DadosOsm {
  if (!ehObjeto(json) || !Array.isArray(json.elements)) throw new Error("Resposta do Overpass fora do formato.");
  const dados: DadosOsm = { rios: [], aguas: [], nascentes: [], vias: [], linhas: [] };
  for (const el of json.elements as ElementoOverpass[]) {
    const tags = el.tags ?? {};
    if (el.type === "node" && tags.natural === "spring" && el.lat != null && el.lon != null) {
      dados.nascentes.push(point([el.lon, el.lat], { origem: "OSM" }) as Feature<Point, PropsNascente>);
      continue;
    }
    if (el.type === "relation" && tags.natural === "water" && el.members) {
      const trechos = el.members
        .filter(m => m.type === "way" && (m.role === "outer" || !m.role) && m.geometry && m.geometry.length > 1)
        .map(m => m.geometry!.map(g => [g.lon, g.lat] as Position));
      for (const anel of montarAneis(trechos)) {
        const pol = turfPolygon([anel], { nome: tags.name ?? null, origem: "OSM", larguraM: null }) as Feature<Polygon, PropsAgua>;
        pol.properties.larguraM = larguraMediaAgua(pol);
        dados.aguas.push(pol);
      }
      continue;
    }
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const coords = el.geometry.map(g => [g.lon, g.lat] as Position);
    if (tags.natural === "water" || tags.waterway === "riverbank") {
      if (!mesmo(coords[0], coords[coords.length - 1])) coords.push(coords[0]);
      if (coords.length >= 4) {
        const pol = turfPolygon([coords], { nome: tags.name ?? null, origem: "OSM", larguraM: null }) as Feature<Polygon, PropsAgua>;
        pol.properties.larguraM = larguraMediaAgua(pol);
        dados.aguas.push(pol);
      }
    } else if (tags.waterway) {
      const largura = tags.width ? numero(tags.width) : null;
      dados.rios.push(lineString(coords, { nome: tags.name ?? null, origem: "OSM", ordem: null, larguraM: largura, tipo: tags.waterway }) as Feature<LineString, PropsRio>);
    } else if (tags.highway) {
      dados.vias.push(lineString(coords, { nome: tags.name ?? null, ref: tags.ref ?? null, tipo: tags.highway }) as Feature<LineString, PropsVia>);
    } else if (tags.power) {
      dados.linhas.push(lineString(coords, { nome: tags.name ?? null, tensaoKv: tensaoOsmKv(tags.voltage), origem: "OSM" }) as Feature<LineString, PropsLinha>);
    }
  }
  return dados;
}

// ─── Normalização: UCs, linhas, rodovias, geologia, poços, vegetação ────────

/** Distância (m) do terreno até a UC: 0 se sobrepõe; senão o menor afastamento entre bordas. */
export function distanciaAteUc(contorno: Contorno, uc: Poligonal): number {
  if (booleanIntersects(contorno, uc)) return 0;
  const bordasUc = flatten(polygonToLine(uc) as Feature).features as Feature<LineString>[];
  const bordasTerreno = flatten(polygonToLine(contorno) as Feature).features as Feature<LineString>[];
  let menor = Infinity;
  for (const linha of bordasUc) for (const v of contorno.geometry.type === "Polygon" ? contorno.geometry.coordinates[0] : contorno.geometry.coordinates.flatMap(p => p[0])) {
    menor = Math.min(menor, pointToLineDistance(point(v), linha, { units: "meters" }));
  }
  // vértices da UC contra as bordas do terreno (UC pequena perto de um lado longo)
  for (const linha of bordasTerreno) for (const anel of poligonosDe(uc.geometry)) for (const v of anel[0]) {
    menor = Math.min(menor, pointToLineDistance(point(v), linha, { units: "meters" }));
  }
  return Math.round(menor);
}

export function normalizarUcs(fc: FeatureCollection, contorno: Contorno, raioM: number = FOLGA_M.ucs): DadosUcs {
  const porNome = new Map<string, UnidadeConservacao>();
  const geometrias: DadosUcs["geometrias"] = [];
  const area = bboxComFolga(contorno, raioM + 500);
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const nome = texto(p.nome_uc) ?? "Unidade de conservação";
    const polis = poligonosDe(f.geometry);
    if (!polis.length) continue;
    const uc = (polis.length === 1 ? turfPolygon(polis[0]) : { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polis } }) as Poligonal;
    const recorte = bboxClip(uc, area) as Poligonal;
    if (!poligonosDe(recorte.geometry).some(a => a[0]?.length >= 4)) continue;
    const d = distanciaAteUc(contorno, recorte);
    if (d > raioM) continue;
    const atual = porNome.get(nome);
    if (!atual || d < atual.distanciaM) {
      porNome.set(nome, { nome, categoria: texto(p.categoria), esfera: texto(p.esfera), grupo: texto(p.grupo), distanciaM: d, sobrepoe: d === 0 });
    }
    geometrias.push({ ...recorte, properties: { nome } });
  }
  return { ucs: Array.from(porNome.values()).sort((a, b) => a.distanciaM - b.distanciaM), raioM, geometrias };
}

export function normalizarLinhasEpe(fc: FeatureCollection): Feature<LineString, PropsLinha>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const props: PropsLinha = { nome: texto(p.Nome), tensaoKv: numero(p.Tensao), origem: "EPE" };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsLinha>);
  });
}

export function normalizarLinhasIbama(fc: FeatureCollection): Feature<LineString, PropsLinha>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const nome = texto(p.nomeempreendimento);
    const kv = nome ? numero(nome.match(/(\d{2,3})\s*kV/i)?.[1]) : null;
    const props: PropsLinha = { nome, tensaoKv: kv, origem: "IBAMA" };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsLinha>);
  });
}

export function normalizarRodoviasDnit(fc: FeatureCollection): Feature<LineString, PropsRodovia>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const br = texto(p.vl_br);
    const props: PropsRodovia = { nome: br ? `BR-${br}` : "Rodovia federal", jurisdicao: texto(p.ds_jurisdi), situacao: texto(p.ds_legenda) };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsRodovia>);
  });
}

/**
 * Leitura simples da geologia para terraplenagem e fundações (mesma ideia do
 * "Geologia (CPRM) favorável" do concorrente): rocha dura/pouco alterada →
 * risco de rocha rasa; planície de inundação/solo mole → atenção; demais → favorável.
 */
export function avaliarGeologia(unidades: UnidadeGeologica[]): AvaliacaoGeologia {
  const tudo = (u: UnidadeGeologica) => `${u.coerencia ?? ""} ${u.dominio ?? ""} ${u.litotipo ?? ""}`.toLowerCase();
  const rocha = unidades.find(u => /muito duras|\bduras\b/.test((u.coerencia ?? "").toLowerCase()) && !/brandas/.test((u.coerencia ?? "").toLowerCase()));
  if (rocha) return { risco: "alto", rotulo: "rocha: alto", motivo: `${rocha.nome}: rochas ${rocha.coerencia?.toLowerCase()} — possível rocha rasa; prever sondagem antes da terraplenagem.` };
  const media = unidades.find(u => /m[eé]dias/.test((u.coerencia ?? "").toLowerCase()) || /cristalin|granit|gnaiss|quartzit|basalt/.test(tudo(u)));
  if (media) return { risco: "medio", rotulo: "rocha: atenção", motivo: `${media.nome}: rochas de resistência média — confirmar a profundidade da rocha nas sondagens.` };
  const varzea = unidades.find(u => /inunda|v[aá]rzea|aluvion/.test(`${u.relevo ?? ""} ${u.nome}`.toLowerCase()));
  if (varzea) return { risco: "medio", rotulo: "atenção: várzea", motivo: `${varzea.nome}: sedimento inconsolidado de planície — atenção a solo mole e cheias.` };
  if (!unidades.length) return { risco: "baixo", rotulo: "sem dado", motivo: "Sem unidade geológica mapeada no terreno." };
  return { risco: "baixo", rotulo: "favorável", motivo: `${unidades[0].nome}: sem indício de rocha rasa no mapa de geodiversidade.` };
}

export function normalizarGeologia(json: unknown): DadosGeologia {
  if (!ehObjeto(json)) throw new Error("Resposta vazia.");
  if (ehObjeto(json.error)) throw new Error(String(json.error.message ?? "Erro do serviço."));
  if (!Array.isArray(json.results)) throw new Error("Resposta do identify fora do formato.");
  const vistos = new Map<string, UnidadeGeologica>();
  for (const r of json.results as { attributes?: Record<string, unknown> }[]) {
    const a = r.attributes ?? {};
    const sigla = texto(a.SIGLA_UNID) ?? texto(a.COD_UNIGEO);
    if (!sigla || vistos.has(sigla)) continue;
    vistos.set(sigla, {
      sigla, nome: texto(a.NOME_UNIDA) ?? sigla, litotipo: [texto(a.LITOTIPO1), texto(a.LITOTIPO2)].filter(Boolean).join(", ") || null,
      dominio: texto(a.DOM_GEO), relevo: texto(a.RELEVO), declividade: texto(a.DECLIVIDAD), coerencia: texto(a.GR_COER), mapa: texto(a.MAPA),
    });
  }
  const unidades = Array.from(vistos.values());
  return { unidades, avaliacao: avaliarGeologia(unidades) };
}

/** Anéis Esri JSON → polígonos GeoJSON: anel horário é contorno externo; anti-horário é furo do externo anterior. */
export function poligonosEsri(rings: Position[][]): Position[][][] {
  const partes: Position[][][] = [];
  for (const anel of rings) {
    if (!Array.isArray(anel) || anel.length < 4) continue;
    let soma = 0;
    for (let i = 0; i < anel.length - 1; i++) soma += (anel[i + 1][0] - anel[i][0]) * (anel[i + 1][1] + anel[i][1]);
    if (soma >= 0 || !partes.length) partes.push([anel]);
    else partes[partes.length - 1].push(anel);
  }
  return partes;
}

const STATUS_CAR: Record<string, string> = { AT: "ativo", PE: "pendente", SU: "suspenso", CA: "cancelado" };
const TIPO_CAR: Record<string, string> = { IRU: "imóvel rural", AST: "assentamento", PCT: "território tradicional" };

/** Resposta do `identify` do CAR (Esri JSON) → imóveis que sobrepõem o terreno, com a área em comum. */
export function normalizarCar(json: unknown, contorno: Contorno): DadosCar {
  const resultados = ehObjeto(json) && Array.isArray(json.results) ? json.results : null;
  if (!resultados) throw new Error("resposta inesperada do CAR");
  const total = turfArea(contorno);
  const porCodigo = new Map<string, ImovelCar>();
  const geometrias: DadosCar["geometrias"] = [];
  const recortes: Poligonal[] = [];
  for (const r of resultados) {
    if (!ehObjeto(r) || !ehObjeto(r.attributes) || !ehObjeto(r.geometry) || !Array.isArray(r.geometry.rings)) continue;
    const a = r.attributes;
    const codigo = texto(a.cod_imovel);
    if (!codigo || texto(a.flg_ativo) === "f") continue;
    const partes = poligonosEsri(r.geometry.rings as Position[][]);
    if (!partes.length) continue;
    const imovel = (partes.length === 1 ? turfPolygon(partes[0]) : { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: partes } }) as Poligonal;
    let sobreposta = 0;
    try { const dentro = recortarAo(contorno, imovel); if (dentro) { sobreposta = turfArea(dentro); recortes.push(dentro); } } catch { /* geometria inválida */ }
    const st = texto(a.ind_status_imovel), tp = texto(a.ind_tipo_imovel);
    porCodigo.set(codigo, {
      codigo, status: st ? STATUS_CAR[st] ?? st : null, tipo: tp ? TIPO_CAR[tp] ?? tp : null, municipio: texto(a.nom_municipio),
      areaHa: numero(typeof a.num_area_imovel === "string" ? a.num_area_imovel.replace(",", ".") : a.num_area_imovel),
      areaSobrepostaM2: sobreposta, percentualDoTerreno: total > 0 ? (sobreposta / total) * 100 : 0,
    });
    geometrias.push({ ...imovel, properties: { codigo } });
  }
  const uniao = unir(recortes);
  const coberto = uniao ? turfArea(uniao) : 0;
  return {
    imoveis: Array.from(porCodigo.values()).sort((x, y) => y.areaSobrepostaM2 - x.areaSobrepostaM2), geometrias,
    percentualCoberto: total > 0 ? Math.min(100, (coberto / total) * 100) : 0,
  };
}

/** Compara o nº do CAR informado no estudo com os imóveis encontrados (ignora pontuação e caixa). */
export function carConfere(informado: string | null | undefined, imoveis: ImovelCar[]): boolean | null {
  const limpo = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const alvo = informado ? limpo(informado) : "";
  if (alvo.length < 10) return null;
  return imoveis.some(i => limpo(i.codigo) === alvo);
}

/** Menor distância (m) de um ponto ao terreno: 0 se está dentro. */
function distanciaPontoAoTerreno(contorno: Contorno, p: Position): number {
  if (booleanPointInPolygon(point(p), contorno)) return 0;
  const bordas = flatten(polygonToLine(contorno) as Feature).features as Feature<LineString>[];
  return Math.round(Math.min(...bordas.map(l => pointToLineDistance(point(p), l, { units: "meters" }))));
}

/** Captações da ANA (pontos/multipontos) dentro do raio, da mais próxima para a mais distante. */
export function normalizarCaptacoes(fcs: FeatureCollection[], contorno: Contorno, raioM: number = FOLGA_M.mananciais): Captacao[] {
  const vistas = new Map<string, Captacao>();
  for (const fc of fcs) for (const f of fc.features) {
    const g = f.geometry;
    const pontos = g?.type === "Point" ? [g.coordinates] : g?.type === "MultiPoint" ? g.coordinates : [];
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const tipo = /superf/i.test(texto(p.tp_captaca) ?? "") ? "superficial" as const : "subterranea" as const;
    for (const c of pontos) {
      const d = distanciaPontoAoTerreno(contorno, c);
      if (d > raioM) continue;
      const chave = `${c[0].toFixed(5)},${c[1].toFixed(5)}|${tipo}`;
      if (vistas.has(chave)) continue;
      vistas.set(chave, {
        nome: texto(p.nm_captaca), manancial: texto(p.nm_fantasi), tipo, sistema: texto(p.sistema), municipio: texto(p.nm_municip),
        situacao: texto(p.status_man), distanciaM: d, coordenadas: [c[0], c[1]],
      });
    }
  }
  return Array.from(vistas.values()).sort((a, b) => a.distanciaM - b.distanciaM);
}

/** Massas d'água usadas para abastecimento (ANA) no entorno: nome, sistemas atendidos e distância. */
export function normalizarMassasAbastecimento(fc: FeatureCollection, contorno: Contorno, raioM: number = FOLGA_M.mananciais): Pick<DadosMananciais, "massas" | "geometrias"> {
  const area = bboxComFolga(contorno, raioM + 500);
  const porNome = new Map<string, MassaAbastecimento>();
  const geometrias: DadosMananciais["geometrias"] = [];
  for (const f of fc.features) {
    const polis = poligonosDe(f.geometry);
    if (!polis.length) continue;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const massa = (polis.length === 1 ? turfPolygon(polis[0]) : { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polis } }) as Poligonal;
    const recorte = bboxClip(massa, area) as Poligonal;
    if (!poligonosDe(recorte.geometry).some(a => a[0]?.length >= 4)) continue;
    const d = distanciaAteUc(contorno, recorte);
    if (d > raioM) continue;
    const nome = texto(p.nome_massa);
    const chave = nome ?? `massa-${geometrias.length}`;
    const atual = porNome.get(chave);
    if (!atual || d < atual.distanciaM) porNome.set(chave, { nome, sistemas: texto(p.nome_siste), distanciaM: d });
    geometrias.push({ ...recorte, properties: { nome } });
  }
  return { massas: Array.from(porNome.values()).sort((a, b) => a.distanciaM - b.distanciaM), geometrias };
}

export function normalizarFerroviasDnit(fc: FeatureCollection): Feature<LineString, PropsFerrovia>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const props: PropsFerrovia = { nome: texto(p.linha) ?? texto(p.concessionaria), concessionaria: texto(p.concessionaria), bitola: texto(p.bitola), origem: "DNIT" };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsFerrovia>);
  });
}

export function normalizarFerroviasIbama(fc: FeatureCollection): Feature<LineString, PropsFerrovia>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const props: PropsFerrovia = { nome: texto(p.nomeempreendimento), concessionaria: null, bitola: null, origem: "IBAMA" };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsFerrovia>);
  });
}

/** Gasodutos da EPE (uma coleção por camada). Traçados só "indicativos"/planejados ficam de fora: não geram faixa. */
export function normalizarDutosEpe(fc: FeatureCollection, tipo: PropsDuto["tipo"]): Feature<LineString, PropsDuto>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const categoria = texto(p.Categoria);
    if (categoria && !/existente/i.test(categoria)) return [];
    const props: PropsDuto = {
      nome: texto(p.Nome_Dut_1) ?? texto(p.DUTO_ID) ?? (texto(p.Distrib) ? `Rede de gás ${texto(p.Distrib)}` : null), tipo,
      operador: texto(p.Transporta) ?? texto(p.Distrib), origem: "EPE",
    };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsDuto>);
  });
}

export function normalizarDutosIbama(fc: FeatureCollection): Feature<LineString, PropsDuto>[] {
  return fc.features.flatMap(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const props: PropsDuto = { nome: texto(p.nomeempreendimento), tipo: "duto", operador: null, origem: "IBAMA" };
    return linhasDe(f.geometry).filter(c => c.length >= 2).map(c => lineString(c, props) as Feature<LineString, PropsDuto>);
  });
}

export function normalizarSiagas(fc: FeatureCollection, contorno: Contorno, raioM: number = FOLGA_M.furos): DadosFuros {
  const centro = turfCentroid(contorno);
  const pocos: Poco[] = [];
  for (const f of fc.features) {
    if (f.geometry?.type !== "Point") continue;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const [x, y] = f.geometry.coordinates;
    const d = Math.round(turfDistance(centro, point([x, y]), { units: "meters" }));
    if (d > raioM) continue;
    pocos.push({
      nome: texto(p.str_nome_ponto), natureza: texto(p.str_natureza_ponto), profundidadeM: numero(p.num_profundidade),
      nivelEstaticoM: numero(p.ne), aquifero: texto(p.str_aquifero), distanciaM: d, coordenadas: [x, y],
    });
  }
  return { pocos: pocos.sort((a, b) => a.distanciaM - b.distanciaM), raioM };
}

/** Legenda MapBiomas (Coleção 8/2023). Nativas = formações naturais; florestais = floresta/savana/mangue/restinga arbórea. */
export const CLASSES_MAPBIOMAS: Record<number, { nome: string; nativa: boolean; florestal: boolean }> = {
  1: { nome: "Floresta", nativa: true, florestal: true },
  3: { nome: "Formação florestal", nativa: true, florestal: true },
  4: { nome: "Formação savânica", nativa: true, florestal: true },
  5: { nome: "Mangue", nativa: true, florestal: true },
  6: { nome: "Floresta alagável", nativa: true, florestal: true },
  49: { nome: "Restinga arbórea", nativa: true, florestal: true },
  10: { nome: "Vegetação herbácea e arbustiva", nativa: true, florestal: false },
  11: { nome: "Campo alagado e área pantanosa", nativa: true, florestal: false },
  12: { nome: "Formação campestre", nativa: true, florestal: false },
  32: { nome: "Apicum", nativa: true, florestal: false },
  29: { nome: "Afloramento rochoso", nativa: true, florestal: false },
  50: { nome: "Restinga herbácea", nativa: true, florestal: false },
  13: { nome: "Outras formações não florestais", nativa: true, florestal: false },
  15: { nome: "Pastagem", nativa: false, florestal: false },
  9: { nome: "Silvicultura", nativa: false, florestal: false },
  18: { nome: "Agricultura", nativa: false, florestal: false },
  19: { nome: "Lavoura temporária", nativa: false, florestal: false },
  39: { nome: "Soja", nativa: false, florestal: false },
  20: { nome: "Cana", nativa: false, florestal: false },
  41: { nome: "Outras lavouras temporárias", nativa: false, florestal: false },
  36: { nome: "Lavoura perene", nativa: false, florestal: false },
  21: { nome: "Mosaico de usos", nativa: false, florestal: false },
  22: { nome: "Área não vegetada", nativa: false, florestal: false },
  23: { nome: "Praia, duna e areal", nativa: false, florestal: false },
  24: { nome: "Área urbanizada", nativa: false, florestal: false },
  30: { nome: "Mineração", nativa: false, florestal: false },
  25: { nome: "Outras áreas não vegetadas", nativa: false, florestal: false },
  26: { nome: "Corpo d'água", nativa: false, florestal: false },
  33: { nome: "Rio, lago e oceano", nativa: false, florestal: false },
  31: { nome: "Aquicultura", nativa: false, florestal: false },
};

/** Grade de amostragem dentro do terreno: no máximo `maxPontos`, lado ≥ 30 m (pixel do MapBiomas). */
export function gradeAmostragem(contorno: Contorno, maxPontos = 80, ladoMinM = 30): { pontos: Position[]; ladoM: number } {
  const areaM2 = turfArea(contorno);
  let lado = Math.max(ladoMinM, Math.sqrt(areaM2 / maxPontos));
  const [w, s, e, n] = turfBbox(contorno);
  const lat = (s + n) / 2;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const dLat = lado / 110_540, dLng = lado / (111_320 * Math.cos((lat * Math.PI) / 180));
    const pontos: Position[] = [];
    for (let y = s + dLat / 2; y < n; y += dLat) for (let x = w + dLng / 2; x < e; x += dLng) {
      if (booleanPointInPolygon(point([x, y]), contorno)) pontos.push([x, y]);
    }
    if (pontos.length <= maxPontos) {
      if (pontos.length === 0) return { pontos: [turfCentroid(contorno).geometry.coordinates], ladoM: Math.round(lado) };
      return { pontos, ladoM: Math.round(lado) };
    }
    lado *= Math.sqrt(pontos.length / maxPontos) * 1.02;
  }
  return { pontos: [turfCentroid(contorno).geometry.coordinates], ladoM: Math.round(lado) };
}

export function celulaQuadrada([x, y]: Position, ladoM: number): Position[][] {
  const dLat = ladoM / 110_540 / 2, dLng = ladoM / (111_320 * Math.cos((y * Math.PI) / 180)) / 2;
  return [[[x - dLng, y - dLat], [x + dLng, y - dLat], [x + dLng, y + dLat], [x - dLng, y + dLat], [x - dLng, y - dLat]]];
}

export function normalizarMapbiomas(json: unknown, ladoM: number): DadosVegetacao {
  if (!ehObjeto(json)) throw new Error("Resposta vazia.");
  if (ehObjeto(json.error)) throw new Error(String(json.error.message ?? "Erro do serviço."));
  if (!Array.isArray(json.results)) throw new Error("Resposta do identify fora do formato.");
  const celulas: Feature<Polygon, PropsCelula>[] = [];
  for (const r of json.results as { attributes?: Record<string, unknown>; geometry?: { x: number; y: number } }[]) {
    const classe = numero(r.attributes?.["UniqueValue.Pixel Value"] ?? r.attributes?.["Pixel Value"]);
    if (classe == null || !r.geometry) continue;
    const c = CLASSES_MAPBIOMAS[classe] ?? { nome: `Classe ${classe}`, nativa: false, florestal: false };
    celulas.push(turfPolygon(celulaQuadrada([r.geometry.x, r.geometry.y], ladoM), { classe, ...c }) as Feature<Polygon, PropsCelula>);
  }
  return { celulas, ladoM, colecao: "MapBiomas 2023" };
}

// ─── Cálculos (rodam no navegador; dependem do seletor de faixa de APP) ─────

/** Largura da APP hídrica conforme o Código Florestal (Lei 12.651/2012, art. 4º, I). */
export function larguraAppCodigoFlorestal(larguraRioM: number): number {
  if (larguraRioM < 10) return 30;
  if (larguraRioM < 50) return 50;
  if (larguraRioM < 200) return 100;
  if (larguraRioM < 600) return 200;
  return 500;
}

/** Largura provável do rio pela ordem de Strahler da BHO (quando não há largura medida). */
export function larguraRioPorOrdem(ordem: number | null): number {
  if (ordem == null || ordem <= 2) return 5;
  if (ordem <= 4) return 25;
  if (ordem <= 6) return 100;
  return 300;
}

/** APP de nascente/olho d'água: raio mínimo de 50 m (art. 4º, IV). */
export const RAIO_APP_NASCENTE_M = 50;

export type AppModo = "auto" | "30" | "50" | "100" | "200" | "500";

export type ResultadoApp = {
  areaM2: number; percentual: number; larguraM: number | null;
  /** Faixa de APP (recortada ao entorno) para desenhar. */
  faixa: Poligonal | null;
  /** Lâminas d'água usadas (recortadas). */
  aguas: Feature<Polygon, PropsAgua>[];
};

function unir(polys: Poligonal[]): Poligonal | null {
  const validos = polys.filter(Boolean);
  if (!validos.length) return null;
  if (validos.length === 1) return validos[0];
  try { return union(featureCollection(validos)) as Poligonal | null; }
  catch {
    // união em lote falhou (geometria ruim): une de dois em dois descartando a ruim
    let acc: Poligonal | null = validos[0];
    for (const p of validos.slice(1)) {
      try { acc = acc ? (union(featureCollection([acc, p])) as Poligonal | null) ?? acc : p; } catch { /* ignora */ }
    }
    return acc;
  }
}

function recortarAo(contorno: Contorno, p: Poligonal | null): Poligonal | null {
  if (!p) return null;
  try { return intersect(featureCollection([p, contorno])) as Poligonal | null; } catch { return null; }
}

/**
 * APP hídrica do terreno: faixa marginal dos rios (linhas ANA/OSM) e das lâminas
 * d'água (polígonos — rios largos como o Tocantins), mais o raio de 50 m das
 * nascentes. Une tudo, tira a própria água e mede só o que cai dentro do terreno.
 */
export function calcularApp(contorno: Contorno, hidro: DadosHidro[], modo: AppModo): ResultadoApp {
  const rios = hidro.flatMap(h => h.rios);
  const aguas = hidro.flatMap(h => h.aguas);
  const nascentes = hidro.flatMap(h => h.nascentes);
  const fixo = modo === "auto" ? null : Number(modo);
  const faixas: Poligonal[] = [];
  let larguraMax: number | null = null;
  const registrar = (w: number) => { larguraMax = larguraMax == null ? w : Math.max(larguraMax, w); };

  for (const agua of aguas) {
    try {
      const larguraRio = agua.properties?.larguraM ?? larguraMediaAgua(agua) ?? 0;
      const w = fixo ?? larguraAppCodigoFlorestal(larguraRio);
      const b = turfBuffer(agua, w, { units: "meters" }) as Poligonal | undefined;
      if (b) { faixas.push(b); registrar(w); }
    } catch { /* anel degenerado */ }
  }
  for (const rio of rios) {
    try {
      const largura = rio.properties.larguraM ?? (rio.properties.origem === "OSM"
        ? (rio.properties.tipo === "river" ? 25 : 5)
        : larguraRioPorOrdem(rio.properties.ordem));
      const w = fixo ?? larguraAppCodigoFlorestal(largura);
      // a faixa conta a partir da margem: soma meia largura do leito ao eixo
      const b = turfBuffer(rio, w + largura / 2, { units: "meters" }) as Poligonal | undefined;
      if (b) { faixas.push(b); registrar(w); }
    } catch { /* linha degenerada */ }
  }
  for (const n of nascentes) {
    try {
      const b = turfBuffer(n, RAIO_APP_NASCENTE_M, { units: "meters" }) as Poligonal | undefined;
      if (b) { faixas.push(b); registrar(RAIO_APP_NASCENTE_M); }
    } catch { /* ignora */ }
  }

  let faixa = unir(faixas);
  const agua = unir(aguas as Poligonal[]);
  if (faixa && agua) {
    try { faixa = (difference(featureCollection([faixa, agua])) as Poligonal | null) ?? null; } catch { /* mantém */ }
  }
  const dentro = recortarAo(contorno, faixa);
  const areaM2 = dentro ? turfArea(dentro) : 0;
  const total = turfArea(contorno);
  return { areaM2, percentual: total > 0 ? (areaM2 / total) * 100 : 0, larguraM: larguraMax, faixa, aguas };
}

export type ResultadoVegetacao = { percentualNativa: number; percentualFlorestal: number; areaNativaM2: number; amostras: number; classes: { nome: string; percentual: number }[] };

export function calcularVegetacao(contorno: Contorno, dados: DadosVegetacao): ResultadoVegetacao {
  const n = dados.celulas.length;
  const total = turfArea(contorno);
  if (!n) return { percentualNativa: 0, percentualFlorestal: 0, areaNativaM2: 0, amostras: 0, classes: [] };
  const nativas = dados.celulas.filter(c => c.properties.nativa).length;
  const florestais = dados.celulas.filter(c => c.properties.florestal).length;
  const porClasse = new Map<string, number>();
  for (const c of dados.celulas) porClasse.set(c.properties.nome, (porClasse.get(c.properties.nome) ?? 0) + 1);
  return {
    percentualNativa: (nativas / n) * 100, percentualFlorestal: (florestais / n) * 100,
    areaNativaM2: (nativas / n) * total, amostras: n,
    classes: Array.from(porClasse.entries()).map(([nome, q]) => ({ nome, percentual: (q / n) * 100 })).sort((a, b) => b.percentual - a.percentual),
  };
}

/**
 * Largura TOTAL de referência da faixa de servidão de linha de transmissão, por
 * tensão. Não há largura fixa em lei: cada concessionária calcula pela ABNT NBR
 * 5422 (flecha, balanço do cabo e distâncias de segurança) e a largura que vale é
 * a da escritura/decreto de utilidade pública. Valores usuais de mercado — ver
 * INVESTIGACAO-MOTOR.md. Sempre confirmar com a concessionária.
 */
export const TABELA_FAIXA_LT: readonly { ateKv: number; larguraM: number }[] = [
  { ateKv: 34.5, larguraM: 15 }, { ateKv: 69, larguraM: 20 }, { ateKv: 138, larguraM: 30 }, { ateKv: 230, larguraM: 40 },
  { ateKv: 345, larguraM: 50 }, { ateKv: 440, larguraM: 60 }, { ateKv: 525, larguraM: 70 }, { ateKv: Infinity, larguraM: 100 },
];
/** Sem tensão informada: assume 230 kV (40 m) e avisa. */
export const FAIXA_LT_SEM_TENSAO_M = 40;
export function larguraFaixaLt(tensaoKv: number | null): number {
  if (tensaoKv == null || !(tensaoKv > 0)) return FAIXA_LT_SEM_TENSAO_M;
  return TABELA_FAIXA_LT.find(l => tensaoKv <= l.ateKv)!.larguraM;
}

/**
 * Faixas ao longo de rodovias, ferrovias e dutos — o que é LEI e o que é referência:
 * • Rodovia: faixa NÃO EDIFICÁVEL de 15 m de cada lado, além da faixa de domínio
 *   (Lei 6.766/79, art. 4º, III, red. Lei 13.913/2019 — lei municipal pode reduzir até 5 m).
 *   A largura da faixa de domínio é definida pelo DNIT/DER por trecho: 35 m de cada lado é referência.
 * • Ferrovia: faixa NÃO EDIFICÁVEL de 15 m de cada lado, além da faixa de domínio
 *   (Lei 6.766/79, art. 4º, III-A). A faixa de domínio é da concessão: 15 m de cada lado é referência.
 * • Duto: a lei não fixa largura — a faixa é exigida no licenciamento ambiental
 *   (Lei 6.766/79, art. 4º, § 3º). 20 m no total é referência usual de servidão de gasoduto.
 * • Linha de transmissão: sem largura em lei; vale a escritura/declaração de utilidade pública (ver TABELA_FAIXA_LT).
 * O dono pode informar a largura CONFIRMADA (concessionária, DNIT, escritura) por item — ela substitui a referência.
 */
export const RODOVIA_FEDERAL = { dominioCadaLadoM: 35, naoEdificavelM: 15 } as const;
export const FERROVIA = { dominioCadaLadoM: 15, naoEdificavelM: 15 } as const;
export const DUTO_FAIXA_TOTAL_M = 20;
export const LARGURA_CONFIRMADA_MAX_M = 1000;

export type TipoServidao = "transmissao" | "rodovia" | "ferrovia" | "duto";
/** "confirmada" = informada pelo dono; "legal+referencia" = parte fixada em lei + parte de referência; "referencia" = só referência. */
export type BaseServidao = "confirmada" | "legal+referencia" | "referencia";
export type ItemServidao = { chave: string; tipo: TipoServidao; nome: string; larguraTotalM: number; areaM2: number; base: BaseServidao; composicao: string; tensaoKv?: number | null };
export type ResultadoServidao = { areaM2: number; percentual: number; faixa: Poligonal | null; itens: ItemServidao[] };
/** Larguras TOTAIS confirmadas pelo dono, por chave do item (ex.: "lt:LT 500 kV X", "rod:BR-010"). */
export type LargurasConfirmadas = Record<string, number>;
export type ExtrasServidao = { ferrovias?: Feature<LineString, PropsFerrovia>[]; dutos?: Feature<LineString, PropsDuto>[]; larguras?: LargurasConfirmadas };

/** Aceita só larguras plausíveis (0 < m ≤ 1000); descarta o resto. */
export function limparLargurasConfirmadas(entrada: unknown): LargurasConfirmadas {
  const saida: LargurasConfirmadas = {};
  if (!ehObjeto(entrada)) return saida;
  for (const [k, v] of Object.entries(entrada).slice(0, 200)) {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
    if (k.length <= 200 && Number.isFinite(n) && n > 0 && n <= LARGURA_CONFIRMADA_MAX_M) saida[k] = Math.round(n * 10) / 10;
  }
  return saida;
}

export function calcularServidao(contorno: Contorno, linhas: Feature<LineString, PropsLinha>[], rodovias: Feature<LineString, PropsRodovia>[], extras: ExtrasServidao = {}): ResultadoServidao {
  const faixas: Poligonal[] = [];
  const itens = new Map<string, ItemServidao>();
  const larguras = extras.larguras ?? {};
  const ferrovias = extras.ferrovias ?? [], dutos = extras.dutos ?? [];
  const aplicar = (eixo: Feature<LineString>, padrao: Omit<ItemServidao, "areaM2">) => {
    const confirmada = larguras[padrao.chave];
    const item = confirmada ? { ...padrao, larguraTotalM: confirmada, base: "confirmada" as const, composicao: `${confirmada} m no total — largura confirmada por você` } : padrao;
    try {
      const b = turfBuffer(eixo, item.larguraTotalM / 2, { units: "meters" }) as Poligonal | undefined;
      if (!b) return;
      faixas.push(b);
      const dentro = recortarAo(contorno, b);
      const a = dentro ? turfArea(dentro) : 0;
      itens.set(item.chave, { ...item, areaM2: (itens.get(item.chave)?.areaM2 ?? 0) + a });
    } catch { /* geometria inválida: ignora */ }
  };
  for (const l of linhas) {
    const largura = larguraFaixaLt(l.properties.tensaoKv);
    const nome = l.properties.nome ?? (l.properties.tensaoKv ? `LT ${l.properties.tensaoKv} kV` : "Linha de transmissão");
    aplicar(l, {
      chave: `lt:${nome}`, tipo: "transmissao", nome, larguraTotalM: largura, base: "referencia", tensaoKv: l.properties.tensaoKv,
      composicao: `${largura} m no total — referência pela tensão${l.properties.tensaoKv ? ` (${l.properties.tensaoKv} kV)` : " (tensão não informada)"}; vale a escritura/declaração de utilidade pública`,
    });
  }
  for (const r of rodovias) {
    const cadaLado = RODOVIA_FEDERAL.dominioCadaLadoM + RODOVIA_FEDERAL.naoEdificavelM;
    aplicar(r, {
      chave: `rod:${r.properties.nome}`, tipo: "rodovia", nome: r.properties.nome, larguraTotalM: cadaLado * 2, base: "legal+referencia",
      composicao: `de cada lado do eixo: ${RODOVIA_FEDERAL.dominioCadaLadoM} m de faixa de domínio (referência; o DNIT define por trecho) + ${RODOVIA_FEDERAL.naoEdificavelM} m não edificáveis (Lei 6.766/79, art. 4º, III)`,
    });
  }
  for (const fv of ferrovias) {
    const cadaLado = FERROVIA.dominioCadaLadoM + FERROVIA.naoEdificavelM;
    const nome = fv.properties.nome ?? "Ferrovia";
    aplicar(fv, {
      chave: `fer:${nome}`, tipo: "ferrovia", nome, larguraTotalM: cadaLado * 2, base: "legal+referencia",
      composicao: `de cada lado do eixo: ${FERROVIA.dominioCadaLadoM} m de faixa de domínio (referência; definida na concessão) + ${FERROVIA.naoEdificavelM} m não edificáveis (Lei 6.766/79, art. 4º, III-A)`,
    });
  }
  for (const d of dutos) {
    const nome = d.properties.nome ?? d.properties.tipo;
    aplicar(d, {
      chave: `duto:${nome}`, tipo: "duto", nome, larguraTotalM: DUTO_FAIXA_TOTAL_M, base: "referencia",
      composicao: `${DUTO_FAIXA_TOTAL_M} m no total — referência; a lei remete a faixa ao licenciamento ambiental (Lei 6.766/79, art. 4º, § 3º)`,
    });
  }
  const faixa = unir(faixas);
  const dentro = recortarAo(contorno, faixa);
  const areaM2 = dentro ? turfArea(dentro) : 0;
  const total = turfArea(contorno);
  const poucos = linhas.length + rodovias.length + ferrovias.length + dutos.length <= 3;
  return { areaM2, percentual: total > 0 ? (areaM2 / total) * 100 : 0, faixa, itens: Array.from(itens.values()).filter(i => i.areaM2 > 0.5 || poucos) };
}

/** Linhas do OSM que não duplicam as oficiais (EPE/IBAMA): só as que ficam a > 30 m de todas. */
export function linhasOsmComplementares(oficiais: Feature<LineString, PropsLinha>[], osm: Feature<LineString, PropsLinha>[]): Feature<LineString, PropsLinha>[] {
  if (!oficiais.length) return osm;
  return osm.filter(l => {
    const meio = l.geometry.coordinates[Math.floor(l.geometry.coordinates.length / 2)];
    return oficiais.every(o => pointToLineDistance(point(meio), o, { units: "meters" }) > 30);
  });
}

export type ResumoFuros = { total: number; distanciaMinKm: number | null; distanciaMaxKm: number | null; nivelEstaticoMedianoM: number | null; profundidadeMedianaM: number | null };

const mediana = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function resumirFuros(d: DadosFuros): ResumoFuros {
  const ds = d.pocos.map(p => p.distanciaM);
  return {
    total: d.pocos.length,
    distanciaMinKm: ds.length ? Math.min(...ds) / 1000 : null,
    distanciaMaxKm: ds.length ? Math.max(...ds) / 1000 : null,
    nivelEstaticoMedianoM: mediana(d.pocos.map(p => p.nivelEstaticoM).filter((n): n is number => n != null && n >= 0)),
    profundidadeMedianaM: mediana(d.pocos.map(p => p.profundidadeM).filter((n): n is number => n != null && n > 0)),
  };
}

export const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: v > 0 && v < 10 ? 1 : 0 })}%`;
export const fmtKm = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

// ─── Imagem de satélite: zoom nativo real da Esri na região ─────────────────

export const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";

export function tileDoPonto(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * Maior zoom com foto de verdade na Esri World Imagery para o ponto (consulta o
 * `tilemap` do serviço). No interior do MA costuma ser 17; em capitais, 19–20.
 * Acima disso a Esri devolve o ladrilho "Map data not yet available" — por isso
 * o mapa amplia o último nível real em vez de pedir ladrilhos inexistentes.
 */
export async function zoomNativoEsri(lat: number, lng: number, fetchImpl: typeof fetch = fetch, niveis: number[] = [17, 18, 19, 20, 21, 22]): Promise<number> {
  const respostas = await Promise.all(niveis.map(async z => {
    const { x, y } = tileDoPonto(lat, lng, z);
    try {
      const r = await fetchImpl(`${ESRI_IMAGERY}/tilemap/${z}/${y}/${x}/1/1?f=json`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) return false;
      const j = (await r.json()) as { data?: number[] };
      return Array.isArray(j.data) && j.data[0] === 1;
    } catch { return false; }
  }));
  let max = 16;
  for (let i = 0; i < niveis.length; i++) { if (respostas[i]) max = niveis[i]; else break; }
  return Math.max(max, 17);
}
