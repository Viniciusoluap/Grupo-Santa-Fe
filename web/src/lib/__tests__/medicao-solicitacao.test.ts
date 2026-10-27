import { describe, expect, it, vi } from "vitest";
import { solicitarComAnexos, DESTINO_MEDICOES, AVISO_EMAIL } from "@/lib/obras/medicao-solicitacao";
function dependencias() {
  return {
    gerar: vi.fn(async (formato: "pdf") => ({ ok: true as const, nome: `Repactuacao.${formato}`, mime: "application/pdf", bytes: new Uint8Array([1,2,3]) })),
    reservar: vi.fn(async () => true), enviar: vi.fn(async () => true), concluir: vi.fn(async (_enviado: boolean) => {}),
  };
}
describe("solicitação de medição com anexos", () => {
  it("envia só o PDF (Lote 02, correção 01: sem XLS) com bytes e MIME preservados para a empresa solicitada", async () => {
    const d = dependencias();
    await expect(solicitarComAnexos(d)).resolves.toEqual({ aviso: undefined });
    expect(DESTINO_MEDICOES).toBe("atendimento@prospectaconstrucoes.com");
    expect(d.enviar).toHaveBeenCalledWith([
      { filename: "Repactuacao.pdf", content: Buffer.from([1,2,3]), contentType: "application/pdf" },
    ]);
    expect(d.gerar).toHaveBeenCalledTimes(1);
    expect(d.gerar).toHaveBeenCalledWith("pdf");
    expect(d.concluir).toHaveBeenCalledWith(true);
  });
  it("não registra nem envia quando o PDF não pode ser gerado", async () => {
    const d = dependencias();
    const gerar = vi.fn(async (_f: "pdf") => ({ ok: false as const, error: "PCI ausente" }));
    await expect(solicitarComAnexos({ ...d, gerar })).rejects.toThrow("PCI ausente");
    expect(d.reservar).not.toHaveBeenCalled(); expect(d.enviar).not.toHaveBeenCalled();
  });
  it("não envia novamente quando outra requisição já reservou a solicitação", async () => {
    const d = dependencias(); d.reservar.mockResolvedValue(false);
    await expect(solicitarComAnexos(d)).rejects.toThrow("já foi enviada");
    expect(d.enviar).not.toHaveBeenCalled(); expect(d.concluir).not.toHaveBeenCalled();
  });
  it.each([false, "throw"])("persiste falha e avisa que o e-mail precisa ser reenviado (%s)", async modo => {
    const d = dependencias();
    if (modo === "throw") d.enviar.mockRejectedValue(new Error("SMTP indisponível")); else d.enviar.mockResolvedValue(false);
    await expect(solicitarComAnexos(d)).resolves.toEqual({ aviso: AVISO_EMAIL });
    expect(d.concluir).toHaveBeenCalledWith(false);
  });
});
