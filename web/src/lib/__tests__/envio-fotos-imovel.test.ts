import { describe, expect, it, vi, beforeEach } from "vitest";
import { enviarImovelComFotos, separarFotosDoImovel } from "@/lib/envio-fotos-imovel";

const enviar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/envio-progresso", () => ({ enviarFormComProgresso: enviar, publicarEnvio: vi.fn() }));

const nova = "data:image/jpeg;base64,/9j/";
const existente = "/api/imovel-foto/antiga";

beforeEach(() => { enviar.mockReset(); vi.unstubAllGlobals(); });

describe("envio individual de fotografias", () => {
  it("mantém URLs já gravadas e retira base64 do cadastro", () => {
    const dados = new FormData();
    dados.set("imagens", JSON.stringify([nova, existente]));
    expect(separarFotosDoImovel(dados)).toEqual({ lista: [nova, existente], novas: [nova] });
    expect(JSON.parse(String(dados.get("imagens")))).toEqual([existente]);
  });

  it("envia uma foto por requisição e restaura a ordem final", async () => {
    const dados = new FormData();
    dados.set("titulo", "Casa");
    dados.set("imagens", JSON.stringify([nova, existente]));
    enviar.mockResolvedValueOnce({ id: "i1" }).mockResolvedValueOnce({ url: "/api/imovel-foto/nova" });
    const ordem = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", ordem);
    expect(await enviarImovelComFotos(dados)).toBe("i1");
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0][1].get("imagens")).toBe(JSON.stringify([existente]));
    expect(enviar.mock.calls[1][1].get("imagem")).toBe(nova);
    expect(JSON.parse(ordem.mock.calls[0][1].body.get("imagens"))).toEqual(["/api/imovel-foto/nova", existente]);
  });

  it("repete apenas a foto cuja transferência falhou", async () => {
    const dados = new FormData();
    dados.set("imagens", JSON.stringify([nova]));
    enviar.mockResolvedValueOnce({ id: "i1" }).mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce({ url: "/api/imovel-foto/nova" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await enviarImovelComFotos(dados);
    expect(enviar).toHaveBeenCalledTimes(3);
  });
});
