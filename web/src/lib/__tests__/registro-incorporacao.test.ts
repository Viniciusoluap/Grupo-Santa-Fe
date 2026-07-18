import { describe, expect, it } from "vitest";
import {
  registroCompletoDoJson,
  resumoRegistro,
  type DocumentoRegistro,
} from "@/lib/incorporacao/registro-incorporacao";

function doc(overrides: Partial<DocumentoRegistro>): DocumentoRegistro {
  return {
    id: "1",
    nome: "Título de propriedade do terreno",
    status: "pendente",
    ...overrides,
  };
}

describe("resumoRegistro", () => {
  it("conta totais e percentual de documentos obtidos", () => {
    const r = resumoRegistro([
      doc({ id: "1", status: "obtido" }),
      doc({ id: "2", status: "em_providencia" }),
      doc({ id: "3", status: "pendente" }),
      doc({ id: "4", status: "pendente" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.obtidos).toBe(1);
    expect(r.emProvidencia).toBe(1);
    expect(r.pendentes).toHaveLength(2);
    expect(r.pctObtido).toBe(25);
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoRegistro([]);
    expect(r.total).toBe(0);
    expect(r.pctObtido).toBe(0);
  });
});

describe("registroCompletoDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(registroCompletoDoJson(null)).toBe(false);
    expect(registroCompletoDoJson("{invalido")).toBe(false);
    expect(registroCompletoDoJson(JSON.stringify({ documentos: [] }))).toBe(false);
  });

  it("retorna true apenas quando todos os documentos estão obtidos", () => {
    expect(registroCompletoDoJson(JSON.stringify({ documentos: [doc({ status: "obtido" })] }))).toBe(true);
    expect(
      registroCompletoDoJson(
        JSON.stringify({ documentos: [doc({ id: "1", status: "obtido" }), doc({ id: "2", status: "pendente" })] })
      )
    ).toBe(false);
  });
});
