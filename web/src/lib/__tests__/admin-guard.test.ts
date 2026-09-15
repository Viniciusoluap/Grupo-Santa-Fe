import { describe, expect, it } from "vitest";
import { deveBloquearDesativacaoUltimoAdmin, sessaoAindaValida } from "../auth/admin-guard";

describe("deveBloquearDesativacaoUltimoAdmin", () => {
  it("bloqueia desativar o último admin ativo", () => {
    expect(deveBloquearDesativacaoUltimoAdmin({ papel: "admin", ativo: true }, 1)).toBe(true);
  });

  it("permite desativar um admin quando há outros admins ativos", () => {
    expect(deveBloquearDesativacaoUltimoAdmin({ papel: "admin", ativo: true }, 2)).toBe(false);
  });

  it("não se aplica a usuários que não são admin", () => {
    expect(deveBloquearDesativacaoUltimoAdmin({ papel: "corretor", ativo: true }, 1)).toBe(false);
    expect(deveBloquearDesativacaoUltimoAdmin({ papel: "colaborador", ativo: true }, 0)).toBe(false);
  });

  it("não se aplica a um admin que já está inativo (nada a bloquear)", () => {
    expect(deveBloquearDesativacaoUltimoAdmin({ papel: "admin", ativo: false }, 1)).toBe(false);
  });

  it("retorna false para alvo inexistente", () => {
    expect(deveBloquearDesativacaoUltimoAdmin(null, 1)).toBe(false);
    expect(deveBloquearDesativacaoUltimoAdmin(undefined, 1)).toBe(false);
  });

  it("bloqueia mesmo se a contagem vier zerada por inconsistência (defensivo)", () => {
    expect(deveBloquearDesativacaoUltimoAdmin({ papel: "admin", ativo: true }, 0)).toBe(true);
  });
});

describe("sessaoAindaValida", () => {
  it("aceita quando sessionVersion do token bate com o do banco e usuário está ativo", () => {
    expect(sessaoAindaValida({ ativo: true, sessionVersion: 3 }, 3)).toBe(true);
  });

  it("rejeita quando a senha foi redefinida depois do token ser emitido (versão divergente)", () => {
    expect(sessaoAindaValida({ ativo: true, sessionVersion: 4 }, 3)).toBe(false);
  });

  it("rejeita quando o usuário foi desativado, mesmo com a versão batendo", () => {
    expect(sessaoAindaValida({ ativo: false, sessionVersion: 3 }, 3)).toBe(false);
  });

  it("rejeita quando o usuário não existe mais no banco", () => {
    expect(sessaoAindaValida(null, 3)).toBe(false);
    expect(sessaoAindaValida(undefined, 3)).toBe(false);
  });

  it("rejeita quando o token não tem sessionVersion (token antigo/malformado)", () => {
    expect(sessaoAindaValida({ ativo: true, sessionVersion: 0 }, undefined)).toBe(false);
  });
});
