import { describe, expect, it } from "vitest";
import { areaDoPerfil, MODULOS_CORRETOR, normalizarPermissoes, podeAcessarAlgum, podeAcessarModulo, podeAdministrarSeguranca, primeiroModulo } from "@/lib/perfis-acesso";

const u = (perfil: string, permissoes: string[] = [], ativo = true) => ({ perfil, permissoes, ativo });

describe("perfis e acesso por módulo (itens 02, 05 e 06)", () => {
  it("área de cada perfil após o login", () => {
    expect(["admin", "colaborador", "corretor", "cliente", "empreiteiro", "user", null].map(areaDoPerfil))
      .toEqual(["painel", "painel", "corretor", "portal", "empreiteiro", null, null]);
  });
  it("admin acessa tudo; inativo nada", () => {
    expect(podeAcessarModulo(u("admin"), "obras")).toBe(true);
    expect(podeAcessarModulo(u("admin", [], false), "obras")).toBe(false);
  });
  it("colaborador só nos módulos liberados (revogar tira o acesso)", () => {
    expect(podeAcessarModulo(u("colaborador", ["obras"]), "obras")).toBe(true);
    expect(podeAcessarModulo(u("colaborador", ["obras"]), "financiamentos")).toBe(false);
    expect(podeAcessarModulo(u("colaborador", []), "obras")).toBe(false);
  });
  it("corretor só Imóveis, Agenda, WhatsApp e Comissões, mesmo com permissões gravadas", () => {
    expect(MODULOS_CORRETOR).toEqual(["imoveis", "agenda", "whatsapp", "comissoes"]);
    expect(podeAcessarModulo(u("corretor", ["obras", "leads"]), "obras")).toBe(false);
    expect(podeAcessarModulo(u("corretor"), "comissoes")).toBe(true);
  });
  it("cliente e empreiteiro não usam módulos do painel", () => {
    expect(podeAcessarAlgum(u("cliente", ["obras"]), ["obras", "leads"])).toBe(false);
    expect(podeAcessarAlgum(u("empreiteiro", ["obras"]), ["obras"])).toBe(false);
  });
  it("segurança (usuários/permissões/exclusão definitiva) só admin ativo", () => {
    expect(podeAdministrarSeguranca(u("admin"))).toBe(true);
    expect(podeAdministrarSeguranca(u("colaborador", ["configuracoes"]))).toBe(false);
    expect(podeAdministrarSeguranca(u("admin", [], false))).toBe(false);
  });
  it("primeiro módulo liberado e normalização de permissões", () => {
    expect(primeiroModulo(u("colaborador", ["obras", "leads"]), ["leads", "obras"])).toBe("leads");
    expect(primeiroModulo(u("colaborador"), ["leads"])).toBeNull();
    expect(normalizarPermissoes("colaborador", ["obras", "obras", "x", 1], ["obras", "leads"])).toEqual(["obras"]);
    expect(normalizarPermissoes("corretor", ["obras"], ["obras"])).toEqual([]);
  });
});
