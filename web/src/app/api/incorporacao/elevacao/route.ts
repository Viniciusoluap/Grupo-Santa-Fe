import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Amostra um modelo digital de elevação (DEM) dentro do bounding box do terreno
// e devolve uma grade de alturas para renderizar a topografia 3D.
//
// Fonte primária: OpenTopography Global DEM API (Copernicus GLO-30), que exige
// OPENTOPOGRAPHY_API_KEY e devolve um raster AAIGrid (ASCII) fácil de parsear.
// Fallback keyless: Open Topo Data (amostragem por pontos), caso a chave não
// esteja configurada.

export interface GridElevacao {
  ncols: number;
  nrows: number;
  cellsizeX: number; // graus por célula em X (lng)
  cellsizeY: number; // graus por célula em Y (lat)
  west: number;
  south: number;
  z: number[][]; // [linha][coluna] em metros; linha 0 = norte
  min: number;
  max: number;
  fonte: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await req.json()) as { south: number; north: number; west: number; east: number };
  const { south, north, west, east } = body;
  if ([south, north, west, east].some((n) => typeof n !== "number" || isNaN(n))) {
    return NextResponse.json({ error: "Bounding box inválido." }, { status: 400 });
  }

  const key = process.env.OPENTOPOGRAPHY_API_KEY;
  try {
    const grid = key
      ? await openTopography(south, north, west, east, key)
      : await openTopoData(south, north, west, east);
    return NextResponse.json(grid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao obter elevação.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function openTopography(
  south: number, north: number, west: number, east: number, key: string
): Promise<GridElevacao> {
  const url =
    `https://portal.opentopography.org/API/globaldem?demtype=COP30` +
    `&south=${south}&north=${north}&west=${west}&east=${east}` +
    `&outputFormat=AAIGrid&API_Key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`OpenTopography retornou ${res.status}.`);
  const text = await res.text();
  return parseAAIGrid(text);
}

/** Parseia um raster ASCII AAIGrid em uma grade de elevações. */
export function parseAAIGrid(text: string): GridElevacao {
  const lines = text.trim().split(/\r?\n/);
  const header: Record<string, number> = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].trim().match(/^(\w+)\s+(-?[\d.]+)$/);
    if (!m) break;
    header[m[1].toLowerCase()] = parseFloat(m[2]);
  }
  const ncols = header["ncols"];
  const nrows = header["nrows"];
  const cellsize = header["cellsize"];
  const xll = header["xllcorner"];
  const yll = header["yllcorner"];
  const nodata = header["nodata_value"] ?? -9999;
  if (!ncols || !nrows || !cellsize) throw new Error("Cabeçalho AAIGrid inválido.");

  const z: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < nrows && i < lines.length; r++, i++) {
    const vals = lines[i].trim().split(/\s+/).map(Number);
    const row: number[] = [];
    for (let c = 0; c < ncols; c++) {
      let v = vals[c];
      if (v === nodata || isNaN(v)) v = 0;
      row.push(v);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    z.push(row);
  }
  if (!isFinite(min)) { min = 0; max = 0; }

  return {
    ncols, nrows, cellsizeX: cellsize, cellsizeY: cellsize,
    west: xll, south: yll, z, min, max, fonte: "OpenTopography COP30 (Copernicus GLO-30)",
  };
}

/** Fallback keyless: amostra uma grade NxN de pontos via Open Topo Data (SRTM 30m). */
async function openTopoData(
  south: number, north: number, west: number, east: number
): Promise<GridElevacao> {
  const N = 24; // 24x24 = 576 pontos → 6 requisições (100/req) ≈ 12 s, dentro do limite
  const locs: string[] = [];
  const cellsizeY = (north - south) / (N - 1);
  const cellsizeX = (east - west) / (N - 1);
  for (let r = 0; r < N; r++) {
    const lat = north - r * cellsizeY; // linha 0 = norte
    for (let c = 0; c < N; c++) {
      const lng = west + c * cellsizeX;
      locs.push(`${lat.toFixed(6)},${lng.toFixed(6)}`);
    }
  }

  const z: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  let min = Infinity, max = -Infinity;
  const CHUNK = 100;
  let idx = 0;
  for (let start = 0; start < locs.length; start += CHUNK) {
    const chunk = locs.slice(start, start + CHUNK);
    const url = `https://api.opentopodata.org/v1/srtm30m?locations=${chunk.join("|")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Open Topo Data retornou ${res.status}.`);
    const json = (await res.json()) as { results: { elevation: number | null }[] };
    for (const p of json.results) {
      const v = p.elevation ?? 0;
      const r = Math.floor(idx / N);
      const c = idx % N;
      z[r][c] = v;
      if (v < min) min = v;
      if (v > max) max = v;
      idx++;
    }
    // respeita rate limit de 1 req/s
    if (start + CHUNK < locs.length) await new Promise((r) => setTimeout(r, 1100));
  }
  if (!isFinite(min)) { min = 0; max = 0; }

  return {
    ncols: N, nrows: N, cellsizeX, cellsizeY, west, south, z, min, max,
    fonte: "Open Topo Data SRTM 30m (sem chave)",
  };
}
