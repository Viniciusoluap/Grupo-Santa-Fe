"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Renderiza a topografia 3D a partir da grade de elevações (DEM).
// A malha é um PlaneGeometry deformado pelas alturas, com exagero vertical
// para leitura e coloração por altitude (verde→marrom→branco).

interface GridElevacao {
  ncols: number;
  nrows: number;
  z: number[][];
  min: number;
  max: number;
  cellsizeX: number;
  cellsizeY: number;
}

function Terreno({ grid }: { grid: GridElevacao }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const { ncols, nrows, z, min, max } = grid;
    const largura = 100;
    const profundidade = (largura * nrows) / ncols;
    const geo = new THREE.PlaneGeometry(largura, profundidade, ncols - 1, nrows - 1);

    const amplitude = Math.max(1, max - min);
    // Exagero vertical proporcional para tornar o relevo legível.
    const escalaV = (largura * 0.25) / amplitude;

    const pos = geo.attributes.position;
    const colors: number[] = [];
    const cBaixo = new THREE.Color("#3f8f4f");
    const cMeio = new THREE.Color("#c9a24b");
    const cAlto = new THREE.Color("#f2f2f2");

    for (let r = 0; r < nrows; r++) {
      for (let c = 0; c < ncols; c++) {
        const idx = r * ncols + c;
        const alt = z[r]?.[c] ?? min;
        pos.setZ(idx, (alt - min) * escalaV);
        const t = (alt - min) / amplitude;
        const col = t < 0.5
          ? cBaixo.clone().lerp(cMeio, t * 2)
          : cMeio.clone().lerp(cAlto, (t - 0.5) * 2);
        colors.push(col.r, col.g, col.b);
      }
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [grid]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial vertexColors flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Viewer3D({ grid }: { grid: GridElevacao }) {
  return (
    <div style={{ height: 420, width: "100%" }}>
      <Canvas camera={{ position: [70, 60, 90], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[50, 80, 30]} intensity={1.1} />
        <Terreno grid={grid} />
        <OrbitControls enableDamping />
      </Canvas>
    </div>
  );
}
