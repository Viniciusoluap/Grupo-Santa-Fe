import { describe, expect, it } from "vitest";
import { podeSerResponsavel, rotuloResponsavel } from "../crm/responsavel";

describe("podeSerResponsavel", () => {
  it("aceita admin, colaborador e corretor ativos", () => {
    for (const papel of ["admin", "colaborador", "corretor"]) {
      expect(podeSerResponsavel({ papel, ativo: true })).toBe(true);
    }
  });

  it("recusa cliente, inativo ou inexistente", () => {
    expect(podeSerResponsavel({ papel: "cliente", ativo: true })).toBe(false);
    expect(podeSerResponsavel({ papel: "admin", ativo: false })).toBe(false);
    expect(podeSerResponsavel(null)).toBe(false);
  });
});

describe("rotuloResponsavel", () => {
  it("mostra nome e papel", () => {
    expect(rotuloResponsavel({ nome: "Bianca", papel: "colaborador" })).toBe("Bianca (Colaborador)");
    expect(rotuloResponsavel({ nome: "X", papel: "outro" })).toBe("X");
  });
});
