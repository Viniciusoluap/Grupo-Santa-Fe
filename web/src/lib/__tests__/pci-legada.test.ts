import { describe, expect, it } from "vitest";
import { localizarIncidenciasPci } from "../caixa/pci";
import { SERVICOS_PROGRESSO } from "../financeiro/progresso";

const valores = SERVICOS_PROGRESSO.map(servico => Number(servico.incidenciaPadrao));
function planilha(inicio: number) {
  const celulas = new Map<string, string | number>();
  valores.forEach((valor, indice) => {
    celulas.set(`G${inicio + indice}`, indice + 1);
    celulas.set(`X${inicio + indice}`, valor);
  });
  return { celulas, ler: (endereco: string) => celulas.get(endereco) ?? null };
}

describe("incidências de modelos da PCI", () => {
  it.each([113, 120])("encontra os vinte itens iniciados na linha %i", inicio => {
    const { ler } = planilha(inicio);
    expect(localizarIncidenciasPci(ler)).toEqual({ linha: inicio, incidencias: valores });
  });

  it("não desloca os itens da PCI antiga para a linha 120", () => {
    const { ler } = planilha(113);
    const encontrado = localizarIncidenciasPci(ler);
    expect(encontrado.incidencias[0]).toBe(3.1);
    expect(encontrado.incidencias[7]).toBe(9);
  });

  it("recusa total incompleto e sequência quebrada", () => {
    const a = planilha(113);
    a.celulas.set("X113", 1);
    expect(() => localizarIncidenciasPci(a.ler)).toThrow(/soma.*100%/i);
    const b = planilha(120);
    b.celulas.delete("G128");
    expect(() => localizarIncidenciasPci(b.ler)).toThrow(/20 serviços/);
  });
});
