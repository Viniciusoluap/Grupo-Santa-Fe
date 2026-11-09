import { gerarEstudoMassa, type EstudoMassaGerado, type ParametrosMassa } from "@/lib/geo/massa-parcelamento";
import type { Position } from "geojson";

// Executa o motor no Web Worker (fallback: thread principal, se o navegador não suportar).
// Um único worker por vez: um novo pedido encerra o anterior (sem execuções concorrentes).

let atual: Worker | null = null;
let seq = 0;

export function cancelarMotorMassa() {
  atual?.terminate();
  atual = null;
}

export function executarMotorMassa(
  anel: Position[], centro: [number, number], params: ParametrosMassa,
  onProgress: (fracao: number, etapa: string) => void
): Promise<EstudoMassaGerado> {
  cancelarMotorMassa();
  const id = ++seq;
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./massa.worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  if (!worker) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try { resolve(gerarEstudoMassa(anel, centro, params, { onProgress })); } catch (e) { reject(e); }
      }, 30);
    });
  }
  atual = worker;
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent<{ id: number; tipo: string; fracao?: number; etapa?: string; resultado?: EstudoMassaGerado; mensagem?: string }>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.tipo === "progresso") onProgress(m.fracao ?? 0, m.etapa ?? "");
      else {
        w.terminate();
        if (atual === w) atual = null;
        if (m.tipo === "ok" && m.resultado) resolve(m.resultado);
        else reject(new Error(m.mensagem || "Falha no motor de parcelamento."));
      }
    };
    w.onerror = (ev) => { w.terminate(); if (atual === w) atual = null; reject(new Error(ev.message || "Falha no motor de parcelamento.")); };
    w.postMessage({ id, anel, centro, params });
  });
}
