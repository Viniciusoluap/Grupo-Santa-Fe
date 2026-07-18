import { describe, expect, it } from "vitest";
import {
  pesquisaPrimariaPreenchidaDoJson,
  resumoPesquisaPrimaria,
  type Entrevistado,
} from "@/lib/incorporacao/pesquisa-primaria";

function entrevistado(overrides: Partial<Entrevistado>): Entrevistado {
  return {
    id: "1",
    nome: "Fulano",
    faixaEtaria: "26-35",
    faixaRenda: "2_4sm",
    temImovelProprio: false,
    interesseComprar12Meses: true,
    tiposInteresse: ["apartamento"],
    notaApartamento: 5,
    notaCasaCondominio: 3,
    notaCasaRuaAberta: 2,
    tamanhoIdealM2: 80,
    quartosNecessarios: 3,
    itensImportancia: {},
    ...overrides,
  };
}

describe("resumoPesquisaPrimaria", () => {
  it("retorna zeros para lista vazia, sem dividir por zero", () => {
    const r = resumoPesquisaPrimaria([]);
    expect(r.totalEntrevistados).toBe(0);
    expect(r.pctInteresseComprar12Meses).toBe(0);
    expect(r.notaMediaApartamento).toBe(0);
    expect(r.quartosModaNecessarios).toBe(0);
  });

  it("calcula percentuais de interesse em comprar e imóvel próprio", () => {
    const r = resumoPesquisaPrimaria([
      entrevistado({ id: "1", interesseComprar12Meses: true, temImovelProprio: true }),
      entrevistado({ id: "2", interesseComprar12Meses: true, temImovelProprio: false }),
      entrevistado({ id: "3", interesseComprar12Meses: false, temImovelProprio: false }),
    ]);
    expect(r.pctInteresseComprar12Meses).toBeCloseTo(66.7, 1);
    expect(r.pctComImovelProprio).toBeCloseTo(33.3, 1);
  });

  it("calcula a distribuição de tipos de imóvel de interesse", () => {
    const r = resumoPesquisaPrimaria([
      entrevistado({ id: "1", tiposInteresse: ["apartamento", "casa_condominio"] }),
      entrevistado({ id: "2", tiposInteresse: ["apartamento"] }),
    ]);
    const apto = r.distribuicaoTipoImovel.find((d) => d.tipo === "apartamento");
    const casaCond = r.distribuicaoTipoImovel.find((d) => d.tipo === "casa_condominio");
    expect(apto?.pct).toBe(100);
    expect(casaCond?.pct).toBe(50);
  });

  it("calcula a média das notas ignorando entrevistados que não avaliaram (nota 0)", () => {
    const r = resumoPesquisaPrimaria([
      entrevistado({ id: "1", notaApartamento: 5 }),
      entrevistado({ id: "2", notaApartamento: 3 }),
      entrevistado({ id: "3", notaApartamento: 0 }),
    ]);
    expect(r.notaMediaApartamento).toBe(4);
  });

  it("calcula a moda de quartos necessários", () => {
    const r = resumoPesquisaPrimaria([
      entrevistado({ id: "1", quartosNecessarios: 3 }),
      entrevistado({ id: "2", quartosNecessarios: 3 }),
      entrevistado({ id: "3", quartosNecessarios: 2 }),
    ]);
    expect(r.quartosModaNecessarios).toBe(3);
  });

  it("ordena o ranking de itens do condomínio pelo % que paga mais por isso", () => {
    const r = resumoPesquisaPrimaria([
      entrevistado({ id: "1", itensImportancia: { Piscina: "importante_paga_mais" } }),
      entrevistado({ id: "2", itensImportancia: { Piscina: "importante_paga_mais", Playground: "importante_paga_mais" } }),
    ]);
    expect(r.rankingItens[0].item).toBe("Piscina");
    expect(r.rankingItens[0].pctImportantePagaMais).toBe(100);
  });
});

describe("pesquisaPrimariaPreenchidaDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(pesquisaPrimariaPreenchidaDoJson(null)).toBe(false);
    expect(pesquisaPrimariaPreenchidaDoJson("{invalido")).toBe(false);
    expect(pesquisaPrimariaPreenchidaDoJson(JSON.stringify({ entrevistados: [] }))).toBe(false);
  });

  it("retorna true quando existe ao menos um entrevistado", () => {
    expect(pesquisaPrimariaPreenchidaDoJson(JSON.stringify({ entrevistados: [entrevistado({})] }))).toBe(true);
  });
});
