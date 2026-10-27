import { describe, expect, it } from "vitest";
import { ordenarProjetosPorPrazo } from "../projetos-prazo";

describe("prioridade de revisão de projetos", () => {
  it("mantém revisão pendente acima da ordenação por prazo", () => {
    const itens = [{ id: "1", prazo: "2026-01-01", revisao: false }, { id: "2", prazo: "2027-01-01", revisao: true }];
    expect(ordenarProjetosPorPrazo(itens, item => item.prazo, item => item.revisao).map(item => item.id)).toEqual(["2", "1"]);
  });
});
