// Mesmo conteúdo em Prospecta/server/email-erro.test.ts.
import { describe, expect, it } from "vitest";
import { descreverErroSmtp } from "@/lib/email-erro";

describe("descreverErroSmtp", () => {
  it("senha recusada orienta senha de app", () => {
    expect(descreverErroSmtp({ code: "EAUTH", responseCode: 535, message: "Invalid login" })).toContain("senha de app");
  });
  it("conexão: confere host e porta", () => {
    expect(descreverErroSmtp({ code: "ETIMEDOUT" })).toContain("SMTP_HOST");
    expect(descreverErroSmtp({ code: "ENOTFOUND" })).toContain("(código ENOTFOUND)");
  });
  it("erro desconhecido não vaza dados", () => {
    expect(descreverErroSmtp(new Error("senha=abc"))).toBe("Falha desconhecida no envio.");
    expect(descreverErroSmtp(null)).toBe("Falha desconhecida no envio.");
  });
});
