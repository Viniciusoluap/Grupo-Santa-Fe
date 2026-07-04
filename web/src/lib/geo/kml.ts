// Parsing de KML → GeoJSON e métricas do terreno (área, perímetro, centróide).
// Usa @tmcw/togeojson + @xmldom/xmldom (server-side) e @turf/turf para geometria.
//
// Um KML de gleba normalmente contém um <Placemark> com um <Polygon>. Extraímos
// o primeiro polígono encontrado e calculamos suas métricas em unidades métricas.

import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import area from "@turf/area";
import length from "@turf/length";
import centroid from "@turf/centroid";
import { polygon as turfPolygon, lineString } from "@turf/helpers";
import type { Feature, Polygon, Position } from "geojson";

export interface TerrenoGeo {
  /** GeoJSON Feature<Polygon> do terreno (anéis em [lng, lat]). */
  feature: Feature<Polygon>;
  /** Área em metros quadrados. */
  areaM2: number;
  /** Perímetro em metros. */
  perimetroM: number;
  /** Centróide [lng, lat]. */
  centro: [number, number];
  /** Vértices do anel externo em [lng, lat]. */
  anel: Position[];
}

/**
 * Extrai o primeiro polígono de um documento KML e calcula suas métricas.
 * @throws Error se nenhum polígono válido for encontrado.
 */
export function parseKmlTerreno(kmlText: string): TerrenoGeo {
  const doc = new DOMParser().parseFromString(kmlText, "text/xml");
  // @tmcw/togeojson espera um Document DOM; o xmldom implementa a interface.
  const geojson = kmlToGeoJSON(doc as unknown as Document);

  const poly = extrairPrimeiroPolygon(geojson);
  if (!poly) {
    throw new Error(
      "Nenhum polígono encontrado no KML. Verifique se o arquivo contém a área do terreno."
    );
  }

  const areaM2 = Math.round(area(poly));
  const anel = poly.geometry.coordinates[0];
  const perimetroM = Math.round(length(lineString(anel), { units: "kilometers" }) * 1000);
  const c = centroid(poly).geometry.coordinates as [number, number];

  return {
    feature: poly,
    areaM2,
    perimetroM,
    centro: [c[0], c[1]],
    anel,
  };
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
  const poly = turfPolygon([fechado]);
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
