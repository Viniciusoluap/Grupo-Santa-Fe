// Mesmo conteúdo em Prospecta/server/email-erro.test.ts.
import { describe, expect, it } from "vitest";
import { descreverErroSmtp, falhaTemporariaSmtp } from "@/lib/email-erro";

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
  it("EMESSAGE não culpa o remetente e é tratada como temporária", () => {
    const erro = { code: "EMESSAGE", responseCode: 550 };
    expect(descreverErroSmtp(erro)).toContain("recusou a mensagem");
    expect(descreverErroSmtp(erro)).not.toContain("SMTP_USER");
    expect(falhaTemporariaSmtp(erro)).toBe(true);
    expect(falhaTemporariaSmtp({ responseCode: 451 })).toBe(true);
    expect(falhaTemporariaSmtp({ code: "EAUTH", responseCode: 535 })).toBe(false);
    expect(falhaTemporariaSmtp({ code: "EENVELOPE", responseCode: 550 })).toBe(false);
  });
});
