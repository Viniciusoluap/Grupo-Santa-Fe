// Paridade 17/11 (bloco 2): estudos de massa já salvos continuam abrindo com o motor novo (3.0.0).
// O fixture foi gerado pelo motor ANTERIOR do Santa Fé (o que estava em produção antes deste porte: sem
// `ajuste`, `fechoAreas`, `areas`, `contornoRestricoes`, destinos das restrições nem quadro com aproveitamento).
// Nada aqui recalcula o estudo: só confere que leitura, quadro, unidades, planta e avisos funcionam com o JSON antigo.
import { describe, expect, it } from "vitest";
import antigo from "./fixtures/massa-motor-anterior-salvo.json";
import type { CenarioMassa, ParametrosMassa } from "@/lib/geo/massa-parcelamento";
import { aproveitamentoDosParametros, estadoDoContornoApp, restricoesDosParametros, destinosDosParametros, VERSAO_ALGORITMO_MASSA } from "@/lib/geo/massa-parcelamento";
import { cenarioPrincipalDe, indicadoresDoCenario, mixDoCenario, quadroAreasDoCenario } from "@/lib/incorporacao/estudos-massa";
import { linhasQuadroAreas, DESTINOS_PADRAO } from "@/lib/incorporacao/massa-quadro-areas";
import { unidadesDoCenario } from "@/lib/incorporacao/unidades";
import { montarModeloPlanta, renderizarPlantaSvg, vistaInicial } from "@/lib/geo/planta-tecnica";
import type { Position } from "geojson";

const fx = antigo as unknown as { anel: Position[]; centro: [number, number] } & Record<"grid" | "rua_simples", { params: ParametrosMassa; cenarios: CenarioMassa[] }>;

describe("estudos de massa salvos pelo motor anterior abrem com o motor 3.0.0", () => {
  for (const tip of ["grid", "rua_simples"] as const) {
    const { params, cenarios } = fx[tip];
    const c = cenarios[0];

    it(`${tip}: o JSON antigo é mesmo do motor anterior (sem os campos novos)`, () => {
      expect(c.versaoAlgoritmo).not.toBe(VERSAO_ALGORITMO_MASSA);
      expect(c.fechoAreas).toBeUndefined();
      expect(c.contornoRestricoes).toBeUndefined();
      expect(params.destinoApp).toBeUndefined();
    });

    it(`${tip}: cenário principal, indicadores, mix e unidades saem do JSON gravado`, () => {
      const principal = cenarioPrincipalDe({
        massaCenariosJson: JSON.stringify({ params, cenarios }), cenarioEscolhidoId: c.id,
        semKml: false, lotesAvulsosJson: null, areaBrutaM2: c.quadroAreas?.areaBrutaM2 ?? 0,
      });
      expect(principal).not.toBeNull();
      expect(principal!.lotes.length).toBe(c.kpis.lotesVendaveis);
      expect(unidadesDoCenario(principal).length).toBe(c.kpis.lotesVendaveis);
      expect(indicadoresDoCenario(c)?.lotesVendaveis ?? c.kpis.lotesVendaveis).toBe(c.kpis.lotesVendaveis);
      expect(mixDoCenario(c, params.precoM2Lote).length).toBeGreaterThan(0);
    });

    it(`${tip}: quadro de áreas antigo é exibido sem NaN e sem inventar aproveitamento`, () => {
      const q = quadroAreasDoCenario(c, params, c.quadroAreas?.areaBrutaM2 ?? 0);
      const linhas = linhasQuadroAreas(q);
      expect(linhas.length).toBeGreaterThan(5);
      for (const l of linhas) expect(Number.isFinite(l.m2)).toBe(true);
      expect(q.areaVerdeEmRestricaoM2 ?? 0).toBe(0);
    });

    it(`${tip}: parâmetros antigos (sem destinos) caem no padrão da regra de 16/11`, () => {
      const d = destinosDosParametros(params);
      expect(d.appM2).toBe(DESTINOS_PADRAO.appM2);
      expect(restricoesDosParametros(params).appM2).toBe(params.appM2 ?? 0);
      const a = aproveitamentoDosParametros(params, c.quadroAreas?.areaBrutaM2 ?? 100_000);
      expect(Number.isFinite(a.economiaM2)).toBe(true);
    });

    it(`${tip}: planta técnica desenha o cenário antigo`, () => {
      const modelo = montarModeloPlanta(fx.anel, c, fx.centro);
      expect(modelo.nLotesVendaveis).toBe(c.kpis.lotesVendaveis);
      const svg = renderizarPlantaSvg(modelo, vistaInicial(modelo, 1200, 800));
      expect(svg).toContain(`Lotes vendáveis (${c.kpis.lotesVendaveis})`);
      expect(svg).not.toContain("NaN");
    });

    it(`${tip}: aviso do contorno da APP — estudo antigo sem contorno pede para gerar de novo, nunca quebra`, () => {
      expect(estadoDoContornoApp({ restricoes: null, appAreaM2: 4000, appNaGlebaM2: null, cenarios })).toBe("sem_contorno");
      expect(estadoDoContornoApp({ restricoes: null, appAreaM2: 0, appNaGlebaM2: null, cenarios })).toBeNull();
      const restricoes = [{ tipo: "app" as const, poligonos: [[fx.anel]] }];
      expect(estadoDoContornoApp({ restricoes, appAreaM2: 4000, appNaGlebaM2: 4000, cenarios })).toBe("cenarios_sem_contorno");
    });
  }
});
