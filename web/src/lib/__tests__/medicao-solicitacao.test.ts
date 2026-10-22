import { describe, expect, it, vi } from "vitest";
import { solicitarComAnexos, DESTINO_MEDICOES, AVISO_EMAIL } from "@/lib/obras/medicao-solicitacao";
function dependencias() {
  return {
    gerar: vi.fn(async (formato: "pdf" | "xls") => ({ ok: true as const, nome: `Repactuacao.${formato}`, mime: formato === "pdf" ? "application/pdf" : "application/vnd.ms-excel", bytes: new Uint8Array([1,2,3]) })),
    reservar: vi.fn(async () => true), enviar: vi.fn(async () => true), concluir: vi.fn(async (_enviado: boolean) => {}),
  };
}
describe("solicitação de medição com anexos", () => {
  it("envia ambos os anexos com bytes e MIME preservados para a empresa solicitada", async () => {
    const d = dependencias();
    await expect(solicitarComAnexos(d)).resolves.toEqual({ aviso: undefined });
    expect(DESTINO_MEDICOES).toBe("atendimento@prospectaconstrucoes.com");
    expect(d.enviar).toHaveBeenCalledWith([
      { filename: "Repactuacao.pdf", content: Buffer.from([1,2,3]), contentType: "application/pdf" },
      { filename: "Repactuacao.xls", content: Buffer.from([1,2,3]), contentType: "application/vnd.ms-excel" },
    ]);
    expect(d.concluir).toHaveBeenCalledWith(true);
  });
  it("não registra nem envia quando falta qualquer anexo", async () => {
    const d = dependencias();
    const gerar = vi.fn(async (f: "pdf" | "xls") => f === "xls" ? { ok: false as const, error: "PCI incompatível com XLS" } : d.gerar(f));
    await expect(solicitarComAnexos({ ...d, gerar })).rejects.toThrow("PCI incompatível");
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
