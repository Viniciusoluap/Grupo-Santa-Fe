import { describe, expect, it } from "vitest";
import {
  materialPublicitarioAprovadoDoJson,
  resumoMaterialPublicitario,
  type PecaPublicitaria,
} from "@/lib/incorporacao/material-publicitario";

function peca(overrides: Partial<PecaPublicitaria>): PecaPublicitaria {
  return { id: "1", tipo: "Site", nome: "Site do empreendimento", status: "em_producao", ...overrides };
}

describe("resumoMaterialPublicitario", () => {
  it("conta totais e percentual aprovado", () => {
    const r = resumoMaterialPublicitario([
      peca({ id: "1", status: "aprovado" }),
      peca({ id: "2", status: "em_aprovacao" }),
      peca({ id: "3", status: "em_producao" }),
      peca({ id: "4", status: "reprovado" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.aprovadas).toBe(1);
    expect(r.emAprovacao).toBe(1);
    expect(r.pctAprovado).toBe(25);
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoMaterialPublicitario([]);
    expect(r.total).toBe(0);
    expect(r.pctAprovado).toBe(0);
  });
});

describe("materialPublicitarioAprovadoDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(materialPublicitarioAprovadoDoJson(null)).toBe(false);
    expect(materialPublicitarioAprovadoDoJson("{invalido")).toBe(false);
    expect(materialPublicitarioAprovadoDoJson(JSON.stringify({ pecas: [] }))).toBe(false);
  });

  it("retorna true apenas quando todas as peças estão aprovadas", () => {
    expect(materialPublicitarioAprovadoDoJson(JSON.stringify({ pecas: [peca({ status: "aprovado" })] }))).toBe(true);
    expect(
      materialPublicitarioAprovadoDoJson(
        JSON.stringify({ pecas: [peca({ id: "1", status: "aprovado" }), peca({ id: "2", status: "em_aprovacao" })] })
      )
    ).toBe(false);
  });
});

it("soma orçamento de todas as peças sem depender da aprovação e preserva dados legados", () => {
  const lista = [peca({ valorOrcado: 100.15 }), peca({ status: "aprovado", valorOrcado: 200.25 }), peca({ status: "reprovado", valorOrcado: 50.10 }), peca({ status: "em_aprovacao" })];
  expect(resumoMaterialPublicitario(lista)).toMatchObject({ valorTotalOrcado: 350.50, aprovadas: 1, emAprovacao: 1 });
  expect(resumoMaterialPublicitario(lista.slice(1)).valorTotalOrcado).toBe(250.35);
  expect(resumoMaterialPublicitario([peca({ valorOrcado: -1 }), peca({ valorOrcado: NaN })]).valorTotalOrcado).toBe(0);
});
