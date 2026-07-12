"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Feature, Polygon } from "geojson";
import {
  upsampleBilinear, suavizarGrade, pontoNoPoligono, passoNivel, isolinhas,
  declividadeGrade, celulaEmMetros, type GridElevacaoLike,
} from "@/lib/geo/relevo";

// Topografia 3D no padrão de estudo de loteamento (referência Lotelytics):
//   - superfície RECORTADA no polígono do terreno (nada do entorno é renderizado);
//   - malha densa (interpolação bilinear) + suavização → sem picos serrilhados;
//   - exagero vertical contido, sombreamento suave;
//   - curvas de nível brancas com etiquetas de cota;
//   - modos: Elevação (rampa hipsométrica suave) e Declividade (verde→vermelho).

interface GridElevacao extends GridElevacaoLike {
  cellsizeX: number;
  cellsizeY: number;
  west: number;
  south: number;
}

export type ModoRelevo = "elevacao" | "declividade";

const LARGURA_MUNDO = 100;

// Rampa hipsométrica suave (azul → verde → oliva → marrom), como a referência.
const RAMPA_ELEVACAO: { t: number; cor: THREE.Color }[] = [
  { t: 0.0, cor: new THREE.Color("#2c6fbb") },
  { t: 0.18, cor: new THREE.Color("#3f9d8a") },
  { t: 0.38, cor: new THREE.Color("#63a45f") },
  { t: 0.58, cor: new THREE.Color("#9aa55a") },
  { t: 0.78, cor: new THREE.Color("#b3985f") },
  { t: 1.0, cor: new THREE.Color("#8a6a45") },
];

// Declividade: gradiente contínuo verde → amarelo → laranja → vermelho.
const RAMPA_DECLIV: { s: number; cor: THREE.Color }[] = [
  { s: 0, cor: new THREE.Color("#22a35a") },
  { s: 5, cor: new THREE.Color("#7cb342") },
  { s: 10, cor: new THREE.Color("#e2b93b") },
  { s: 18, cor: new THREE.Color("#ef7d33") },
  { s: 25, cor: new THREE.Color("#d33c30") },
  { s: 40, cor: new THREE.Color("#8f1d16") },
];

function corRampa(stops: { t: number; cor: THREE.Color }[], t: number): THREE.Color {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i].t) {
      const a = stops[i - 1], b = stops[i];
      return a.cor.clone().lerp(b.cor, (x - a.t) / (b.t - a.t || 1));
    }
  }
  return stops[stops.length - 1].cor.clone();
}

function corDecliv(s: number): THREE.Color {
  if (s <= RAMPA_DECLIV[0].s) return RAMPA_DECLIV[0].cor.clone();
  for (let i = 1; i < RAMPA_DECLIV.length; i++) {
    if (s <= RAMPA_DECLIV[i].s) {
      const a = RAMPA_DECLIV[i - 1], b = RAMPA_DECLIV[i];
      return a.cor.clone().lerp(b.cor, (s - a.s) / (b.s - a.s || 1));
    }
  }
  return RAMPA_DECLIV[RAMPA_DECLIV.length - 1].cor.clone();
}

interface Processado {
  grid: GridElevacaoLike;
  slopes: number[][];
  mask: boolean[][];            // vértice dentro do terreno?
  toWorld: (col: number, row: number) => [number, number]; // → [x, z]
  alturaWorld: (alt: number) => number;
  profundidade: number;
  anel: [number, number][] | null;
}

function processar(grid: GridElevacao, geojson: string | null): Processado {
  // Densifica para ~96 pontos no eixo maior e suaviza o ruído do DEM.
  const alvo = 96;
  const fator = Math.max(1, Math.round((alvo - 1) / (Math.max(grid.ncols, grid.nrows) - 1)));
  const denso = suavizarGrade(upsampleBilinear(grid, fator), 2);

  const cellX = grid.cellsizeX / fator;
  const cellY = grid.cellsizeY / fator;
  const norte = grid.south + (grid.nrows - 1) * grid.cellsizeY;

  let anel: [number, number][] | null = null;
  if (geojson) {
    try {
      const f = JSON.parse(geojson) as Feature<Polygon>;
      anel = f.geometry.coordinates[0] as [number, number][];
    } catch { /* sem recorte */ }
  }

  const lngDe = (col: number) => grid.west + col * cellX;
  const latDe = (row: number) => norte - row * cellY;

  const mask: boolean[][] = [];
  for (let r = 0; r < denso.nrows; r++) {
    const linha: boolean[] = [];
    for (let c = 0; c < denso.ncols; c++) {
      linha.push(anel ? pontoNoPoligono(lngDe(c), latDe(r), anel) : true);
    }
    mask.push(linha);
  }

  // Recalcula min/max SÓ dentro do terreno (evita que o rio do entorno
  // "estique" a escala de cores — o triângulo azul do bug).
  let min = Infinity, max = -Infinity;
  for (let r = 0; r < denso.nrows; r++) {
    for (let c = 0; c < denso.ncols; c++) {
      if (!mask[r][c]) continue;
      const v = denso.z[r][c];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min)) { min = denso.min; max = denso.max; }
  const gridFinal: GridElevacaoLike = { ...denso, min, max };

  const latMedia = grid.south + ((grid.nrows - 1) * grid.cellsizeY) / 2;
  const { x: mX, y: mY } = celulaEmMetros(cellX, cellY, latMedia);
  const slopes = declividadeGrade(gridFinal, mX, mY);

  const profundidade = (LARGURA_MUNDO * (denso.nrows - 1) * mY) / ((denso.ncols - 1) * mX || 1);
  const larguraMetros = (denso.ncols - 1) * mX;
  const amplitude = Math.max(0.5, max - min);
  // Exagero vertical contido: relevo real ×2, limitado a 14% da largura da cena.
  const escala = Math.min((LARGURA_MUNDO / (larguraMetros || 1)) * 2, (LARGURA_MUNDO * 0.14) / amplitude);

  const toWorld = (col: number, row: number): [number, number] => [
    (col / (denso.ncols - 1) - 0.5) * LARGURA_MUNDO,
    (row / (denso.nrows - 1) - 0.5) * profundidade,
  ];
  const alturaWorld = (alt: number) => (alt - min) * escala;

  return { grid: gridFinal, slopes, mask, toWorld, alturaWorld, profundidade, anel };
}

function Superficie({ p, modo }: { p: Processado; modo: ModoRelevo }) {
  const geometry = useMemo(() => {
    const { grid, slopes, mask, toWorld, alturaWorld } = p;
    const { ncols, nrows, z, min, max } = grid;
    const amplitude = Math.max(0.5, max - min);

    const posicoes: number[] = [];
    const cores: number[] = [];
    const indices: number[] = [];
    const idx: number[][] = [];

    for (let r = 0; r < nrows; r++) {
      idx.push([]);
      for (let c = 0; c < ncols; c++) {
        if (!mask[r][c]) { idx[r].push(-1); continue; }
        const [x, zz] = toWorld(c, r);
        posicoes.push(x, alturaWorld(z[r][c]), zz);
        const cor = modo === "declividade"
          ? corDecliv(slopes[r][c])
          : corRampa(RAMPA_ELEVACAO, (z[r][c] - min) / amplitude);
        cores.push(cor.r, cor.g, cor.b);
        idx[r].push(posicoes.length / 3 - 1);
      }
    }

    for (let r = 0; r < nrows - 1; r++) {
      for (let c = 0; c < ncols - 1; c++) {
        const a = idx[r][c], b = idx[r][c + 1], d = idx[r + 1][c], e = idx[r + 1][c + 1];
        if (a >= 0 && b >= 0 && d >= 0) indices.push(a, d, b);
        if (b >= 0 && d >= 0 && e >= 0) indices.push(b, d, e);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posicoes, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [p, modo]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function CurvasDeNivel({ p }: { p: Processado }) {
  const { linhas, etiquetas } = useMemo(() => {
    const { grid, mask, toWorld, alturaWorld } = p;
    const passo = passoNivel(grid.max - grid.min, 10);
    const niveis: number[] = [];
    for (let n = Math.ceil(grid.min / passo) * passo; n < grid.max; n += passo) niveis.push(n);

    const segs = isolinhas(grid, niveis);
    const pontos: number[] = [];
    const porNivel = new Map<number, [number, number][]>();

    for (const s of segs) {
      const cA = Math.min(grid.ncols - 1, Math.round(s.a[0]));
      const rA = Math.min(grid.nrows - 1, Math.round(s.a[1]));
      if (!mask[rA]?.[cA]) continue; // só dentro do terreno
      const [xa, za] = toWorld(s.a[0], s.a[1]);
      const [xb, zb] = toWorld(s.b[0], s.b[1]);
      const y = alturaWorld(s.nivel) + 0.25;
      pontos.push(xa, y, za, xb, y, zb);
      if (!porNivel.has(s.nivel)) porNivel.set(s.nivel, []);
      porNivel.get(s.nivel)!.push([(xa + xb) / 2, (za + zb) / 2]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pontos, 3));

    // Uma etiqueta de cota por nível, no meio da curva.
    const etiquetas: { texto: string; pos: [number, number, number] }[] = [];
    for (const [nivel, mids] of porNivel) {
      if (mids.length < 4) continue;
      const m = mids[Math.floor(mids.length / 2)];
      etiquetas.push({ texto: `${Math.round(nivel)}m`, pos: [m[0], alturaWorld(nivel) + 1.6, m[1]] });
    }

    return { linhas: geo, etiquetas };
  }, [p]);

  return (
    <>
      <lineSegments geometry={linhas}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </lineSegments>
      {etiquetas.map((e, i) => (
        <EtiquetaCota key={i} texto={e.texto} pos={e.pos} />
      ))}
    </>
  );
}

function EtiquetaCota({ texto, pos }: { texto: string; pos: [number, number, number] }) {
  const textura = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.beginPath();
    ctx.roundRect(6, 6, 116, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, 64, 25);
    const t = new THREE.CanvasTexture(canvas);
    t.anisotropy = 2;
    return t;
  }, [texto]);

  return (
    <sprite position={pos} scale={[7, 2.6, 1]}>
      <spriteMaterial map={textura} depthTest={false} transparent />
    </sprite>
  );
}

export function Viewer3D({
  grid, geojson = null, modo = "elevacao",
}: {
  grid: GridElevacao;
  geojson?: string | null;
  modo?: ModoRelevo;
  /** compat: ignorado — a declividade é calculada internamente na malha densa */
  slopes?: number[][] | null;
  nContornos?: number;
}) {
  const p = useMemo(() => processar(grid, geojson), [grid, geojson]);

  return (
    <div style={{ height: 460, width: "100%" }} className="bg-[#0d1526] rounded-sm">
      <Canvas camera={{ position: [0, 78, 92], fov: 40 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[60, 110, 50]} intensity={1.0} />
        <directionalLight position={[-40, 60, -50]} intensity={0.3} />
        <gridHelper args={[280, 28, "#1d2a45", "#16203a"]} position={[0, -1.5, 0]} />
        <Superficie p={p} modo={modo} />
        <CurvasDeNivel p={p} />
        <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
    </div>
  );
}
