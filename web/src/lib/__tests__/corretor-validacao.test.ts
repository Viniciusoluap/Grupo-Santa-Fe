import { describe, expect, it } from "vitest";
import { validarNovoCorretor } from "../corretores/validacao";

const base = { nome: "Ana Silva", email: "ana@exemplo.com", creci: "CRECI-GO 1234", telefone: "62999999999", senha: "senha123" };

describe("validarNovoCorretor", () => {
  it("aceita um cadastro completo", () => {
    expect(validarNovoCorretor(base)).toBeNull();
  });

  it("exige nome", () => {
    expect(validarNovoCorretor({ ...base, nome: "" })).toMatch(/obrigatórios/);
  });

  it("exige CRECI", () => {
    expect(validarNovoCorretor({ ...base, creci: "" })).toMatch(/obrigatórios/);
  });

  it("exige telefone", () => {
    expect(validarNovoCorretor({ ...base, telefone: "" })).toMatch(/obrigatórios/);
  });

  it("exige e-mail", () => {
    expect(validarNovoCorretor({ ...base, email: "" })).toMatch(/obrigatórios/);
  });

  it("exige senha de acesso com pelo menos 6 caracteres - é o que vira o login real", () => {
    expect(validarNovoCorretor({ ...base, senha: "" })).toMatch(/Senha de acesso/);
    expect(validarNovoCorretor({ ...base, senha: "123" })).toMatch(/Senha de acesso/);
  });

  it("aceita senha com exatamente 6 caracteres", () => {
    expect(validarNovoCorretor({ ...base, senha: "123456" })).toBeNull();
  });
});
