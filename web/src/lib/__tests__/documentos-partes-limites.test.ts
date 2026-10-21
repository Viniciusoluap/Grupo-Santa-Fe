import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { validarParte } from "@/lib/documentos-upload-partes";
import { LIMITE_DOCUMENTO_BYTES } from "@/lib/documentos-upload-partes-limites";

describe("upload documental", () => {
  it("aceita 20 partes de 1 MiB e rejeita partes fora do limite", () => {
    const base = { uploadId: "11111111-1111-4111-8111-111111111111", parte: 19, total: 20, nome: "arquivo.pdf" };
    expect(LIMITE_DOCUMENTO_BYTES).toBe(20 * 1024 * 1024);
    expect(validarParte({ ...base, chunk: Buffer.alloc(1024 * 1024).toString("base64") }).parte).toBe(19);
    expect(() => validarParte({ ...base, total: 21, chunk: "YQ==" })).toThrow();
    expect(() => validarParte({ ...base, chunk: Buffer.alloc(1024 * 1024 + 1).toString("base64") })).toThrow();
  });
});
