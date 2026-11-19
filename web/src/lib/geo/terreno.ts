import { featureCollection, polygon, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

export type GeometriaTerreno = Feature<Polygon | MultiPolygon>;

export function poligonosDoTerreno(terreno: GeometriaTerreno): Position[][][] {
  const geometria = terreno.geometry;
  return geometria.type === "Polygon" ? [geometria.coordinates] : geometria.coordinates;
}

/** Dissolve sobreposições e divisas comuns sem unir áreas separadas. */
export function uniaoDoTerreno(terreno: GeometriaTerreno): GeometriaTerreno {
  if (terreno.geometry.type === "Polygon") return terreno;
  const partes = poligonosDoTerreno(terreno).map(aneis => polygon(aneis));
  return union(featureCollection(partes)) ?? terreno;
}
