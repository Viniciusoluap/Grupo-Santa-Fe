import { describe, expect, it } from "vitest";
import { itemRegistroValido, LIMITE_DOCUMENTO_REGISTRO, mimeDocumentoRegistro } from "@/lib/incorporacao/registro-documento-validacao";

describe("anexos privados do registro", () => {
  it("aceita apenas item existente no checklist e rejeita IDs arbitrários", () => {
    const json = JSON.stringify({ documentos: [{ id: "etapa_123", nome: "Documento" }] });
    expect(itemRegistroValido("padrao-0", null)).toBe(true);
    expect(itemRegistroValido("etapa_123", json)).toBe(true);
    expect(itemRegistroValido("etapa_124", json)).toBe(false);
    expect(itemRegistroValido("../etapa_123", json)).toBe(false);
    expect(itemRegistroValido("padrao-9999", null)).toBe(false);
    const due = JSON.stringify({ versao: 1, etapas: [{
      id: "b49cc8b0-a080-4bd7-9406-4b7fb9ef4651", nome: "Cartório", procedimentos: "", observacoes: "", tarefas: [],
      documentos: [{ id: "e6717244-650e-4515-9803-f9620ec17752", nome: "Matrícula", obtido: false }],
    }] });
    expect(itemRegistroValido("dd_b49cc8b0-a080-4bd7-9406-4b7fb9ef4651_e6717244-650e-4515-9803-f9620ec17752", null, due)).toBe(true);
    expect(itemRegistroValido("dd_b49cc8b0-a080-4bd7-9406-4b7fb9ef4651_d1a3195e-a061-4d4f-8b93-b3000c460480", null, due)).toBe(false);
  });

  it("verifica assinatura real, sem confiar no nome ou Content-Type", () => {
    expect(mimeDocumentoRegistro(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
    expect(mimeDocumentoRegistro(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(mimeDocumentoRegistro(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(mimeDocumentoRegistro(Buffer.from("<script>"))).toBeNull();
    expect(LIMITE_DOCUMENTO_REGISTRO).toBeLessThan(4.5 * 1024 * 1024);
  });
});
