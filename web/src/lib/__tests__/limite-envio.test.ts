// Revisão do Codex (18/10): a Vercel recusa corpos acima de 4,5 MB; o envio é barrado antes.
import { describe, expect, it } from "vitest";
import { enviarFormComProgresso, LIMITE_ENVIO_BYTES, tamanhoDoEnvio } from "@/lib/envio-progresso";

describe("limite de envio", () => {
  it("soma textos e arquivos do formulário", () => {
    const dados = new FormData();
    dados.set("imagens", "a".repeat(1000));
    dados.set("arquivo", new Blob([new Uint8Array(500)]));
    expect(tamanhoDoEnvio(dados)).toBe(1500);
  });
  it("recusa acima do limite antes de enviar", async () => {
    const dados = new FormData();
    dados.set("imagens", "a".repeat(LIMITE_ENVIO_BYTES + 1));
    await expect(enviarFormComProgresso("/api/x", dados)).rejects.toThrow(/limite de 4 MB/);
  });
});
