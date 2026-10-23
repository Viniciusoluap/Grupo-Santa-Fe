import { describe, expect, it } from "vitest";
import { diaPrazoProjeto, exibirDiaPrazoProjeto, ordenarProjetosPorPrazo, persistirDiaPrazoProjeto } from "./projetos-prazo";

describe("prazo civil dos projetos", () => {
  it("persiste um dia sem hora visível e preserva legados em UTC e Fortaleza", () => {
    expect(diaPrazoProjeto(persistirDiaPrazoProjeto("2026-10-23"))).toBe("2026-10-23");
    expect(exibirDiaPrazoProjeto("2026-10-23T11:00:00.000Z")).toBe("23/10/2026");
    expect(diaPrazoProjeto("2026-10-23T00:00:00.000Z")).toBe("2026-10-23");
    expect(diaPrazoProjeto("2026-10-24T02:00:00.000Z")).toBe("2026-10-23");
    expect(() => persistirDiaPrazoProjeto("2026-02-30")).toThrow();
  });

  it("ordena vencidos, hoje, futuros, empates por ID e sem prazo no fim", () => {
    const itens = [{ id: 9, prazo: null }, { id: 4, prazo: "2026-10-24" },
      { id: 3, prazo: "2026-10-23" }, { id: 2, prazo: "2026-10-22" }, { id: 1, prazo: "2026-10-23" }];
    expect(ordenarProjetosPorPrazo(itens, p => p.prazo).map(p => p.id)).toEqual([2, 1, 3, 4, 9]);
  });
});
