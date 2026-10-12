import { describe, expect, it } from "vitest";
import { capturarErroAcao, exigirResultado } from "@/lib/acao-resultado";

describe("erro de Server Action devolvido como dado", () => {
  it("mensagem original chega à tela", async () => {
    const r = await capturarErroAcao(async () => { throw new Error("A unidade foi alterada em outra sessão."); });
    expect(() => exigirResultado(r)).toThrow("A unidade foi alterada em outra sessão.");
  });
  it("sucesso passa intacto", async () => {
    expect(exigirResultado(await capturarErroAcao(async () => ({ ok: 1 })))).toEqual({ ok: 1 });
    expect(exigirResultado(await capturarErroAcao(async () => undefined))).toBeUndefined();
  });
  it("redirect/notFound do Next continuam sendo lançados", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    await expect(capturarErroAcao(async () => { throw redirect; })).rejects.toBe(redirect);
  });
});
