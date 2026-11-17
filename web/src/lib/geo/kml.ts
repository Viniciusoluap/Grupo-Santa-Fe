// Parsing de KML → GeoJSON e métricas do terreno (área, perímetro, centróide).
// Usa @tmcw/togeojson + @xmldom/xmldom (server-side) e @turf/turf para geometria.
//
// Um KML de gleba normalmente contém um <Placemark> com um <Polygon>; pode trazer várias áreas
// (pastas/MultiGeometry) e furos — todos são lidos (paridade com a Prospecta, 17/11).

import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import area from "@turf/area";
import length from "@turf/length";
import centroid from "@turf/centroid";
import { centerOfMass, multiPolygon } from "@turf/turf";
import { polygon as turfPolygon, lineString } from "@turf/helpers";
import type { Feature, Geometry, Polygon, Position } from "geojson";
import { poligonosDoTerreno, uniaoDoTerreno, type GeometriaTerreno } from "./terreno";

export interface TerrenoGeo {
  /**
   * GeoJSON do terreno (anéis em [lng, lat]). Paridade 17/11 (Prospecta 355f3aa): um KML com várias áreas
   * separadas vira MultiPolygon, e os furos (innerBoundaryIs) são mantidos — antes só o primeiro polígono era lido.
   */
  feature: GeometriaTerreno;
  /** Área em metros quadrados (das áreas unidas, sem contar duas vezes a sobreposição; furos descontados). */
  areaM2: number;
  /** Perímetro em metros (soma dos contornos externos). */
  perimetroM: number;
  /** Centróide [lng, lat] (ponderado pela área quando há várias áreas). */
  centro: [number, number];
  /** Vértices do anel externo da primeira área em [lng, lat] (compatibilidade). */
  anel: Position[];
}

/**
 * Lê TODOS os polígonos de um documento KML (pastas, MultiGeometry, geometrias mistas) e calcula as métricas.
 * Uma área só continua sendo Feature<Polygon> (com os furos); várias áreas viram Feature<MultiPolygon>.
 * Regra igual à Prospecta (`server/_core/geo/kml.ts`).
 * @throws Error se nenhum polígono válido for encontrado.
 */
export function parseKmlTerreno(kmlText: string): TerrenoGeo {
  const doc = new DOMParser().parseFromString(kmlText, "text/xml");
  // @tmcw/togeojson espera um Document DOM; o xmldom implementa a interface.
  const geojson = kmlToGeoJSON(doc as unknown as Document);
  const partes: Feature<Polygon>[] = [];
  for (const { geometry, properties } of geojson.features) {
    if (!geometry) continue;
    for (const aneis of aneisDosPoligonos(geometry)) partes.push(turfPolygon(aneis, properties ?? {}));
  }
  if (partes.length === 0) {
    throw new Error(
      "Nenhum polígono encontrado no KML. Verifique se o arquivo contém a área do terreno."
    );
  }

  const feature: GeometriaTerreno = partes.length === 1 ? partes[0] : multiPolygon(partes.map((p) => p.geometry.coordinates));
  const contorno = uniaoDoTerreno(feature);
  const poligonos = poligonosDoTerreno(contorno);
  const perimetroKm = poligonos.reduce((total, [anel]) => total + length(lineString(anel), { units: "kilometers" }), 0);
  const centro = partes.length === 1
    ? (centroid(feature).geometry.coordinates as [number, number])
    : centroPonderado(poligonos);

  return {
    feature,
    areaM2: Math.round(area(contorno)),
    perimetroM: Math.round(perimetroKm * 1000),
    centro: [centro[0], centro[1]],
    anel: partes[0].geometry.coordinates[0],
  };
}

function aneisDosPoligonos(geometria: Geometry): Position[][][] {
  switch (geometria.type) {
    case "Polygon": return [geometria.coordinates];
    case "MultiPolygon": return geometria.coordinates;
    case "GeometryCollection": return geometria.geometries.flatMap(aneisDosPoligonos);
    default: return [];
  }
}

function centroPonderado(poligonos: Position[][][]): [number, number] {
  let areaTotal = 0;
  let lngTotal = 0;
  let latTotal = 0;
  for (const aneis of poligonos) {
    for (let i = 0; i < aneis.length; i++) {
      const parte = turfPolygon([aneis[i]]);
      const areaParte = (i === 0 ? 1 : -1) * area(parte);
      const [lng, lat] = centerOfMass(parte).geometry.coordinates;
      areaTotal += areaParte;
      lngTotal += lng * areaParte;
      latTotal += lat * areaParte;
    }
  }
  if (areaTotal <= 0) throw new Error("O KML não contém polígonos com área válida.");
  return [lngTotal / areaTotal, latTotal / areaTotal];
}

/** Percorre um FeatureCollection/Feature e retorna o primeiro Polygon (ou o anel externo de um MultiPolygon). */
export function extrairPrimeiroPolygon(
  geojson: ReturnType<typeof kmlToGeoJSON>
): Feature<Polygon> | null {
  const features = geojson.type === "FeatureCollection" ? geojson.features : [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      return turfPolygon(g.coordinates, f.properties ?? {});
    }
    if (g.type === "MultiPolygon" && g.coordinates.length > 0) {
      return turfPolygon(g.coordinates[0], f.properties ?? {});
    }
  }
  return null;
}

/**
 * Constrói um TerrenoGeo a partir de um anel de coordenadas [lng, lat] já conhecido
 * (usado em testes e quando a geometria vem de outra fonte que não KML).
 * Fecha o anel automaticamente se necessário.
 */
export function terrenoDeAnel(anel: Position[]): TerrenoGeo {
  const fechado = anelFechado(anel);
  const poly: Feature<Polygon> = turfPolygon([fechado]);
  const areaM2 = Math.round(area(poly));
  const perimetroM = Math.round(length(lineString(fechado), { units: "kilometers" }) * 1000);
  const c = centroid(poly).geometry.coordinates as [number, number];
  return { feature: poly, areaM2, perimetroM, centro: [c[0], c[1]], anel: fechado };
}

function anelFechado(anel: Position[]): Position[] {
  if (anel.length < 3) throw new Error("Anel precisa de ao menos 3 vértices.");
  const first = anel[0];
  const last = anel[anel.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return anel;
  return [...anel, first];
}
