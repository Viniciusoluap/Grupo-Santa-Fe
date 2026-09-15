import { describe, expect, it } from "vitest";
import { deveBloquearDesativacaoUltimoAdmin } from "../auth/admin-guard";

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
