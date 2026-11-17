import { gerarEstudoMassa, type EntradaGleba, type EstudoMassaGerado, type ParametrosMassa, type RestricaoGeometrica, type ViaEntorno } from "@/lib/geo/massa-parcelamento";

// Executa o motor no Web Worker (fallback: thread principal, se o navegador não suportar).
// Um único worker por vez: um novo pedido encerra o anterior (sem execuções concorrentes).
// A gleba pode ter várias áreas contínuas (KML com áreas separadas) e furos; as vias do entorno
// (OpenStreetMap) são opcionais — sem elas o motor ainda exige acesso pela divisa. As áreas restritas com contorno
// (APP do mapa do Terreno) saem da área loteável pela posição real.

let atual: Worker | null = null;
let seq = 0;

export function cancelarMotorMassa() {
  atual?.terminate();
  atual = null;
}

export function executarMotorMassa(
  entrada: EntradaGleba, centro: [number, number], params: ParametrosMassa, viasEntorno: ViaEntorno[] | null,
  onProgress: (fracao: number, etapa: string) => void, restricoes: RestricaoGeometrica[] | null = null,
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
        try { resolve(gerarEstudoMassa(entrada, centro, params, { onProgress, viasEntorno, restricoes })); } catch (e) { reject(e); }
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
    w.postMessage({ id, entrada, centro, params, viasEntorno, restricoes });
  });
}
