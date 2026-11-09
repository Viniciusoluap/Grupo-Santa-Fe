import { describe, expect, it } from "vitest";
import { criarProjecao, gerarCenariosMassa, type CenarioMassa, type ParametrosMassa } from "@/lib/geo/massa";

describe("Rua simples pela divisa", () => {
  it("troca o lado da via e entrega o cenário com lotes, áreas e VGV recalculados", () => {
    const centro: [number, number] = [-49.88, -6.49];
    const proj = criarProjecao(centro);
    const gleba = [[-60, -150], [60, -150], [60, 150], [-60, 150], [-60, -150]].map((p) => proj.paraGeo(p));
    const params: ParametrosMassa = {
      tipologia: "rua_simples", tracadoVia: "divisa", larguraViaM: 6, testadaLoteM: 20,
      profundidadeLoteM: 120, loteMinimoM2: 1500, comprimentoMaxQuadraM: 300,
      percentInstitucional: 0, percentAreaVerde: 0, precoM2Lote: 20,
    };
    const [original] = gerarCenariosMassa(gleba, centro, params);
    const alternativos = gerarCenariosMassa(gleba, centro, { ...params, inverterLadoVia: true });
    const xDaVia = (c: CenarioMassa) => {
      const pontos = c.ruas!.flat();
      return pontos.reduce((s, p) => s + proj.paraMetros(p)[0], 0) / pontos.length;
    };
    expect(original.inviabilidade).toBeFalsy();
    expect(Math.abs(xDaVia(original))).toBeGreaterThan(50);
    for (const c of alternativos) {
      expect(c.inviabilidade).toBeFalsy();
      expect(c.viaLadoOposto).toBe(true);
      expect(xDaVia(c) * xDaVia(original)).toBeLessThan(0);
      expect(c.kpis.lotesVendaveis).toBeGreaterThan(0);
      expect(c.kpis.vgv).toBeGreaterThan(0);
      expect(c.quadroAreas?.sistemaViarioM2).toBe(c.sistemaViario?.areaGeometricaM2);
    }
  }, 30000);
});
