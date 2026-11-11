"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Maximize2, Minus, Plus, Printer } from "lucide-react";
import type { Feature, Polygon } from "geojson";
import type { CenarioMassa } from "@/lib/geo/massa-parcelamento";
import {
  montarModeloPlanta, renderizarPlantaSvg, rotuloLote, vistaInicial, zoomEm, type VistaPlanta,
} from "@/lib/geo/planta-tecnica";

// Desenho técnico do parcelamento (correção 04) — modo principal do Estudo de Massa.
// Desenha exatamente os lotes/vias do cenário (mesma geometria do quadro de áreas e
// das unidades). Funciona sem serviço de satélite. Zoom (roda, botões, pinça), pan
// (arrastar), seleção de lote com destaque da quadra, exportação SVG e impressão.

interface Props {
  geojson: string;
  cenario: CenarioMassa;
  centro: [number, number];
  height?: number;
  titulo?: string;
}

export function PlantaTecnica({ geojson, cenario, centro, height = 520, titulo }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);
  const [vista, setVista] = useState<VistaPlanta | null>(null);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const arrasto = useRef<{ x: number; y: number; moveu: boolean; lote: number | null } | null>(null);

  const modelo = useMemo(() => {
    try {
      const [gleba, ...demaisContornos] = (JSON.parse(geojson) as Feature<Polygon>).geometry.coordinates;
      return montarModeloPlanta(gleba, cenario, centro, demaisContornos);
    } catch {
      return null;
    }
  }, [geojson, cenario, centro]);

  // largura responsiva (computador e tablet)
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const enquadrar = useCallback(() => { if (modelo) setVista(vistaInicial(modelo, largura, height)); }, [modelo, largura, height]);
  // novo cenário ou novo tamanho: reenquadra e limpa a seleção (ajuste durante a renderização, sem efeito em cascata)
  const [enquadrado, setEnquadrado] = useState<{ modelo: typeof modelo; largura: number; height: number } | null>(null);
  if (!enquadrado || enquadrado.modelo !== modelo || enquadrado.largura !== largura || enquadrado.height !== height) {
    setEnquadrado({ modelo, largura, height });
    setVista(modelo ? vistaInicial(modelo, largura, height) : null);
    setSelecionado(null);
  }

  const lote = selecionado !== null ? modelo?.lotes[selecionado] ?? null : null;
  const svg = useMemo(() => (modelo && vista ? renderizarPlantaSvg(modelo, vista, { selecionado, quadra: lote?.quadra ?? null, titulo }) : ""), [modelo, vista, selecionado, lote, titulo]);

  // roda do mouse: zoom no cursor (listener não passivo para impedir a rolagem da página)
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setVista((v) => (v ? zoomEm(v, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top) : v));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    // o lote sob o ponteiro é lido ANTES da captura (depois dela o alvo passa a ser a caixa)
    const alvo = (e.target as Element).closest?.("[data-lote]");
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    arrasto.current = { x: e.clientX, y: e.clientY, moveu: false, lote: alvo ? Number(alvo.getAttribute("data-lote")) : null };
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = ponteiros.current;
    if (!p.has(e.pointerId)) return;
    const anterior = p.get(e.pointerId)!;
    if (p.size === 2) {
      // pinça (tablet): zoom pela variação da distância entre os dois dedos
      const [a, b] = Array.from(p.values());
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a2, b2] = Array.from(p.values());
      const d1 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      const r = caixa.current!.getBoundingClientRect();
      if (d0 > 0) setVista((v) => (v ? zoomEm(v, d1 / d0, (a2.x + b2.x) / 2 - r.left, (a2.y + b2.y) / 2 - r.top) : v));
      if (arrasto.current) arrasto.current.moveu = true;
      return;
    }
    const dx = e.clientX - anterior.x, dy = e.clientY - anterior.y;
    p.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (arrasto.current && Math.hypot(e.clientX - arrasto.current.x, e.clientY - arrasto.current.y) > 4) arrasto.current.moveu = true;
    if (arrasto.current?.moveu) setVista((v) => (v ? { ...v, tx: v.tx + dx, ty: v.ty + dy } : v));
  }
  function onPointerUp(e: React.PointerEvent) {
    ponteiros.current.delete(e.pointerId);
    const a = arrasto.current;
    arrasto.current = null;
    if (a && !a.moveu) setSelecionado(a.lote);
  }

  function zoomBotao(f: number) { setVista((v) => (v ? zoomEm(v, f, v.larguraPx / 2, v.alturaPx / 2) : v)); }

  function svgParaExportar(): string {
    if (!modelo) return "";
    return renderizarPlantaSvg(modelo, vistaInicial(modelo, 1600, 1130), { titulo });
  }
  function baixarSvg() {
    const blob = new Blob([svgParaExportar()], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planta-${cenario.id}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function imprimir() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Planta ${cenario.id}</title><style>@page{size:A4 landscape;margin:8mm}body{margin:0}svg{width:100%;height:auto}</style></head><body>${svgParaExportar()}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  if (!modelo) return <div className="p-6 text-sm text-red-700">Geometria da gleba inválida — não é possível desenhar a planta.</div>;

  const btn = "p-2 min-h-9 min-w-9 bg-white/95 border border-gray-300 hover:border-[var(--brand-yellow)] text-[var(--brand-dark)] inline-flex items-center justify-center";
  return (
    <div className="space-y-2">
      <div className="relative" style={{ height }}>
        <div ref={caixa} role="img" aria-label={`Desenho técnico do ${cenario.id}: ${modelo.nLotesVendaveis} lotes vendáveis`}
          className="absolute inset-0 overflow-hidden border border-gray-200 bg-white touch-none select-none"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <button type="button" className={btn} aria-label="Aproximar" onClick={() => zoomBotao(1.4)}><Plus size={15} /></button>
          <button type="button" className={btn} aria-label="Afastar" onClick={() => zoomBotao(1 / 1.4)}><Minus size={15} /></button>
          <button type="button" className={btn} aria-label="Enquadrar a gleba" onClick={enquadrar}><Maximize2 size={14} /></button>
        </div>
        <div className="absolute right-12 top-2 flex gap-1">
          <button type="button" className={btn} aria-label="Baixar planta em SVG" title="Baixar SVG" onClick={baixarSvg}><Download size={14} /></button>
          <button type="button" className={btn} aria-label="Imprimir planta" title="Imprimir" onClick={imprimir}><Printer size={14} /></button>
        </div>
      </div>
      <div className="text-xs text-gray-700 min-h-5" aria-live="polite">
        {lote ? (
          <span><strong>{rotuloLote(lote)}</strong>{lote.quadra ? ` · quadra Q${lote.quadra.padStart(2, "0")} destacada` : ""}</span>
        ) : (
          <span className="text-gray-500">Toque/clique em um lote para ver quadra, número, área e dimensões. Arraste para mover; use a roda, a pinça ou os botões para zoom.</span>
        )}
      </div>
    </div>
  );
}
