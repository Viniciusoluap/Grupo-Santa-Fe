// Pedido de 25/10: WhatsApp por QR code (Evolution API). Servidor simulado; nada real é chamado.
// Gêmeo de Prospecta/server/whatsapp-evolution.test.ts.
import { describe, expect, it, vi } from "vitest";
import { enviarTextoEvolution, estadoInstancia, gerarQrCode, numeroConectado, removerInstancia, testarEvolution } from "@/lib/evolution";

const cfg = { url: "https://evo.exemplo.app/", apiKey: "chave-teste-123" };
const resp = (corpo: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => corpo } as Response);

describe("cliente Evolution (QR code)", () => {
  it("testa o servidor com a chave no cabeçalho apikey e explica recusa/queda", async () => {
    const f = vi.fn((url: string, init?: RequestInit) => {
      expect(url).toBe("https://evo.exemplo.app/instance/fetchInstances");
      expect((init?.headers as Record<string, string>).apikey).toBe("chave-teste-123");
      return resp([]);
    });
    await testarEvolution(cfg, f as never);
    await expect(testarEvolution(cfg, vi.fn(() => resp({}, 401)) as never)).rejects.toThrow(/recusou a chave/);
    await expect(testarEvolution(cfg, vi.fn(() => Promise.reject(new Error("dns"))) as never)).rejects.toThrow(/Confira o endereço/);
  });

  it("instância inexistente: cria e devolve o QR do create", async () => {
    const chamadas: string[] = [];
    const f = vi.fn((url: string, init?: RequestInit) => {
      chamadas.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("connectionState")) return resp({}, 404);
      if (url.endsWith("/instance/create")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ instanceName: "santafe-u1", integration: "WHATSAPP-BAILEYS", qrcode: true });
        return resp({ qrcode: { base64: "data:image/png;base64,AAA" } });
      }
      return resp({});
    });
    expect(await gerarQrCode(cfg, "santafe-u1", f as never)).toEqual({ qrCode: "data:image/png;base64,AAA", estado: "connecting" });
    expect(chamadas).toEqual(["GET https://evo.exemplo.app/instance/connectionState/santafe-u1", "POST https://evo.exemplo.app/instance/create"]);
  });

  it("instância existente e desconectada: pede novo QR; já conectada: não gera QR", async () => {
    const f = vi.fn((url: string) => url.includes("connectionState") ? resp({ instance: { state: "close" } }) : resp({ base64: "BBB" }));
    expect(await gerarQrCode(cfg, "x", f as never)).toEqual({ qrCode: "BBB", estado: "connecting" });
    const aberto = vi.fn(() => resp({ instance: { state: "open" } }));
    expect(await gerarQrCode(cfg, "x", aberto as never)).toEqual({ qrCode: null, estado: "open" });
    expect(aberto).toHaveBeenCalledTimes(1);
  });

  it("estado, número conectado, envio com DDI 55 e remoção", async () => {
    expect(await estadoInstancia(cfg, "x", vi.fn(() => resp({ instance: { state: "connecting" } })) as never)).toBe("connecting");
    expect(await numeroConectado(cfg, "x", vi.fn(() => resp([{ ownerJid: "5594999998888@s.whatsapp.net" }])) as never)).toBe("5594999998888");
    const envio = vi.fn((_u: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ number: "5594988887777", text: "Olá" });
      return resp({ key: { id: "MSG1" } });
    });
    expect(await enviarTextoEvolution(cfg, "x", "(94) 98888-7777", "Olá", envio as never)).toBe("MSG1");
    expect(await enviarTextoEvolution(cfg, "x", "94988887777", "Olá", vi.fn(() => resp({}, 400)) as never)).toBeNull();
    const rm = vi.fn((_url: string) => resp({}));
    await removerInstancia(cfg, "x", rm as never);
    expect(rm.mock.calls.map(c => String(c[0]))).toEqual(["https://evo.exemplo.app/instance/logout/x", "https://evo.exemplo.app/instance/delete/x"]);
  });
});
