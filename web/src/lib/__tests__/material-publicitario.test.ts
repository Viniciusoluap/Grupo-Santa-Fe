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
