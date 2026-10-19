import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ acesso: vi.fn(), referencia: vi.fn(), medicao: vi.fn() }));
vi.mock("@/lib/obras/acesso-empreiteiro", () => ({ exigirObraOuEmpreiteiro: m.acesso }));
vi.mock("@/lib/db", () => ({ prisma: { obraProgressoHistorico: { findUnique: m.referencia, findUniqueOrThrow: m.medicao } } }));
import { GET } from "@/app/api/obras/medicoes/[medicaoId]/[arquivo]/route";
const req = new NextRequest("http://localhost/api/obras/medicoes/m1/arquivo.pdf");
const contexto = () => ({ params: Promise.resolve({ medicaoId: "m1", arquivo: "arquivo.pdf" }) });
beforeEach(() => { vi.clearAllMocks(); m.referencia.mockResolvedValue({ obraId: "obra1" }); });
describe("arquivos CAIXA privados", () => {
  it("recusa outra obra antes de carregar arquivo e fotos privados", async () => {
    m.acesso.mockRejectedValue(new Error("Esta obra não está vinculada a você."));
    expect((await GET(req, contexto())).status).toBe(403);
    expect(m.medicao).not.toHaveBeenCalled();
  });
  it("não usa a PCI atual como substituta silenciosa de medição sem versão", async () => {
    m.acesso.mockResolvedValue("admin"); m.medicao.mockResolvedValue({ pciVersao: null });
    expect((await GET(req, contexto())).status).toBe(409);
    expect(m.acesso).toHaveBeenCalledWith("obra1");
  });
});
