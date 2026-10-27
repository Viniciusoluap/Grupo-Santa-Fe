import { describe, expect, it } from "vitest";
import { TEMPLATES_WHATSAPP_PADRAO, validarTemplateWhatsapp } from "@/lib/whatsapp/templates";

describe("templates WhatsApp", () => {
  it("mantém a captação sem variável de serviço e a agenda com dia e horário", () => {
    const captacao = TEMPLATES_WHATSAPP_PADRAO.find((t) => t.id === "captacao")!;
    const visita = TEMPLATES_WHATSAPP_PADRAO.find((t) => t.id === "visita")!;
    expect(captacao.body).not.toMatch(/\{\{servi[cç]o?s?\}\}/i);
    expect(visita.body).toContain("{{dia}}");
    expect(visita.body).toContain("{{horario}}");
    expect(visita.body).not.toMatch(/endere[cç]o/i);
  });

  it("aceita as variáveis oficiais e rejeita variável desconhecida", () => {
    expect(() => validarTemplateWhatsapp("Olá {{nome}}, {{servicos}} em {{dia}} às {{horario}}" )).not.toThrow();
    expect(() => validarTemplateWhatsapp("Olá {{senha}}" )).toThrow(/Variáveis inválidas/);
  });
});
