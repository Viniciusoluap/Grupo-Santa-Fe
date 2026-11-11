// Fumaça do componente do desenho técnico (paridade com a Prospecta): renderiza no servidor
// com um cenário real do motor v2 e confere que o SVG sai com os lotes e as ferramentas.
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { Position } from "geojson";
import { PlantaTecnica } from "@/app/admin/incorporacao/_components/planta-tecnica";
import { criarProjecao, gerarEstudoMassa } from "@/lib/geo/massa-parcelamento";

const CENTRO: [number, number] = [-44.3, -2.53];
const proj = criarProjecao(CENTRO);
const anel: Position[] = [[-150, -100], [150, -100], [150, 100], [-150, 100], [-150, -100]].map((p) => proj.paraGeo(p));

describe("PlantaTecnica (componente)", () => {
  it("desenha os lotes do cenário da grade (motor v2) já na primeira renderização", () => {
    const r = gerarEstudoMassa(anel, CENTRO, {
      tipologia: "grid", larguraViaM: 12, testadaLoteM: 10, profundidadeLoteM: 25, loteMinimoM2: 250,
      comprimentoMaxQuadraM: 120, percentInstitucional: 0.05, percentAreaVerde: 0.1, precoM2Lote: 500,
    });
    expect(r.cenarios.length).toBeGreaterThan(0);
    const c = r.cenarios[0];
    const geojson = JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [anel] } });
    const html = renderToString(<PlantaTecnica geojson={geojson} cenario={c} centro={CENTRO} />);
    expect((html.match(/data-lote="/g) ?? []).length).toBe(c.lotes.length);
    expect(html).toContain("<svg");
  });
});
