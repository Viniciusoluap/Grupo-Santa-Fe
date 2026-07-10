"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { indiceFaixa, FAIXAS_DECLIVIDADE } from "@/lib/geo/relevo";

// Renderiza a topografia 3D a partir da grade de elevações (DEM).
// Dois modos de coloração:
//   - "elevacao": rampa hipsométrica (azul→verde→amarelo→laranja→vermelho→branco)
//     com curvas de nível (bandas escurecidas a cada intervalo de cota).
//   - "declividade": cores por faixa (Plano/Leve/Moderado/Íngreme/Inviável).

interface GridElevacao {
  ncols: number;
  nrows: number;
  z: number[][];
  min: number;
  max: number;
  cellsizeX: number;
  cellsizeY: number;
}

export type ModoRelevo = "elevacao" | "declividade";

// Rampa hipsométrica clássica (stops em t = 0..1).
const RAMPA: { t: number; cor: THREE.Color }[] = [
  { t: 0.0, cor: new THREE.Color("#1e40af") },
  { t: 0.2, cor: new THREE.Color("#16a34a") },
  { t: 0.45, cor: new THREE.Color("#a3e635") },
  { t: 0.65, cor: new THREE.Color("#eab308") },
  { t: 0.82, cor: new THREE.Color("#f97316") },
  { t: 0.93, cor: new THREE.Color("#dc2626") },
  { t: 1.0, cor: new THREE.Color("#f8fafc") },
];

function corElevacao(t: number): THREE.Color {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMPA.length; i++) {
    if (x <= RAMPA[i].t) {
      const a = RAMPA[i - 1];
      const b = RAMPA[i];
      const k = (x - a.t) / (b.t - a.t || 1);
      return a.cor.clone().lerp(b.cor, k);
    }
  }
  return RAMPA[RAMPA.length - 1].cor.clone();
}

const CORES_FAIXA = FAIXAS_DECLIVIDADE.map((f) => new THREE.Color(f.corHex));

function Terreno({
  grid,
  slopes,
  modo,
  nContornos,
}: {
  grid: GridElevacao;
  slopes: number[][] | null;
  modo: ModoRelevo;
  nContornos: number;
}) {
  const geometry = useMemo(() => {
    const { ncols, nrows, z, min, max } = grid;
    const largura = 100;
    const profundidade = (largura * nrows) / ncols;
    const geo = new THREE.PlaneGeometry(largura, profundidade, ncols - 1, nrows - 1);

    const amplitude = Math.max(1, max - min);
    const escalaV = (largura * 0.28) / amplitude; // exagero vertical legível

    const pos = geo.attributes.position;
    const colors: number[] = [];
    const passoCota = amplitude / Math.max(1, nContornos);

    for (let r = 0; r < nrows; r++) {
      for (let c = 0; c < ncols; c++) {
        const idx = r * ncols + c;
        const alt = z[r]?.[c] ?? min;
        pos.setZ(idx, (alt - min) * escalaV);

        let col: THREE.Color;
        if (modo === "declividade" && slopes) {
          col = CORES_FAIXA[indiceFaixa(slopes[r]?.[c] ?? 0)].clone();
        } else {
          const t = (alt - min) / amplitude;
          col = corElevacao(t);
          // Curvas de nível: escurece as células próximas de cada isolinha de cota.
          const resto = ((alt - min) % passoCota) / passoCota;
          if (resto < 0.06 || resto > 0.94) col.multiplyScalar(0.6);
        }
        colors.push(col.r, col.g, col.b);
      }
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [grid, slopes, modo, nContornos]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.95} metalness={0} />
    </mesh>
  );
}

export function Viewer3D({
  grid,
  slopes = null,
  modo = "elevacao",
  nContornos = 12,
}: {
  grid: GridElevacao;
  slopes?: number[][] | null;
  modo?: ModoRelevo;
  nContornos?: number;
}) {
  return (
    <div style={{ height: 440, width: "100%" }} className="bg-[#0b1220]">
      <Canvas camera={{ position: [80, 65, 95], fov: 42 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[60, 90, 40]} intensity={1.15} />
        <directionalLight position={[-50, 40, -30]} intensity={0.35} />
        <Terreno grid={grid} slopes={slopes} modo={modo} nContornos={nContornos} />
        <OrbitControls enableDamping />
      </Canvas>
    </div>
  );
}
