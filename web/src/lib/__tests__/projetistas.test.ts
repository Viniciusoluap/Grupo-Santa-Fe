import { describe, expect, it } from "vitest";
import {
  projetistasCompatibilizadosDoJson,
  resumoProjetistas,
  type Projetista,
} from "@/lib/incorporacao/projetistas";

function projetista(overrides: Partial<Projetista>): Projetista {
  return {
    id: "1",
    disciplina: "Arquitetura",
    empresaOuProfissional: "Escritório X",
    status: "contratado",
    ...overrides,
  };
}

describe("resumoProjetistas", () => {
  it("conta totais e percentual de compatibilização", () => {
    const r = resumoProjetistas([
      projetista({ id: "1", status: "compatibilizado" }),
      projetista({ id: "2", status: "entregue" }),
      projetista({ id: "3", status: "em_desenvolvimento" }),
      projetista({ id: "4", status: "nao_contratado" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.contratados).toBe(3);
    expect(r.entregues).toBe(2);
    expect(r.compatibilizados).toBe(1);
    expect(r.pctCompatibilizado).toBe(25);
  });

  it("identifica projetistas atrasados (prazo vencido e não entregue)", () => {
    const hoje = new Date("2026-07-18");
    const r = resumoProjetistas(
      [
        projetista({ id: "1", prazoEntrega: "2026-07-01", status: "em_desenvolvimento" }),
        projetista({ id: "2", prazoEntrega: "2026-08-01", status: "em_desenvolvimento" }),
        projetista({ id: "3", prazoEntrega: "2026-07-01", status: "entregue" }),
      ],
      hoje
    );
    expect(r.atrasados).toHaveLength(1);
    expect(r.atrasados[0].id).toBe("1");
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoProjetistas([]);
    expect(r.total).toBe(0);
    expect(r.pctCompatibilizado).toBe(0);
    expect(r.atrasados).toHaveLength(0);
  });
});

describe("projetistasCompatibilizadosDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(projetistasCompatibilizadosDoJson(null)).toBe(false);
    expect(projetistasCompatibilizadosDoJson("{invalido")).toBe(false);
    expect(projetistasCompatibilizadosDoJson(JSON.stringify({ projetistas: [] }))).toBe(false);
  });

  it("retorna true apenas quando todos os projetistas estão compatibilizados", () => {
    expect(
      projetistasCompatibilizadosDoJson(
        JSON.stringify({ projetistas: [projetista({ status: "compatibilizado" })] })
      )
    ).toBe(true);
    expect(
      projetistasCompatibilizadosDoJson(
        JSON.stringify({
          projetistas: [projetista({ id: "1", status: "compatibilizado" }), projetista({ id: "2", status: "entregue" })],
        })
      )
    ).toBe(false);
  });
});
