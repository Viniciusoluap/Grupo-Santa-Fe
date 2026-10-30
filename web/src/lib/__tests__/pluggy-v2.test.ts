import { describe, expect, it, vi } from "vitest";
import { fetchPluggyTransactions } from "@/lib/bancos/pluggy";

describe("Pluggy v2", () => {
  it("percorre cursor, preserva contraparte e prefere providerId estável", async () => {
    const fetchFake = vi.fn((url: string) => {
      expect(url).toContain("/v2/transactions");
      if (!url.includes("after=")) return Promise.resolve({ ok: true, json: async () => ({
        next: "?accountId=acc1&after=cursor-opaco",
        results: [{ id: "id-item-1", providerId: "provider-77", providerCode: "nsu-9", date: "2026-10-01", description: "PIX", descriptionRaw: "PIX MARIA", amount: 25, type: "CREDIT", paymentData: { payer: { name: "Maria" } } }],
      }) } as Response);
      return Promise.resolve({ ok: true, json: async () => ({ next: null, results: [] }) } as Response);
    });
    expect(await fetchPluggyTransactions("tok", "acc1", "2026-01-01", fetchFake as never)).toEqual([
      { externalId: "id-item-1", identificadorBancario: "provider-77", data: "2026-10-01", descricao: "PIX MARIA", valor: 25, tipo: "credito", categoria: undefined, titular: "Maria" },
    ]);
    expect(fetchFake).toHaveBeenCalledTimes(2);
    // Lote 3, item 13A: a v2 recusa `pageSize` ("property pageSize should not exist"); só accountId + cursor.
    expect(fetchFake.mock.calls[0][0]).toMatch(/\/v2\/transactions\?accountId=acc1$/);
    expect(fetchFake.mock.calls[0][0]).not.toContain("pageSize");
    expect(fetchFake.mock.calls[0][0]).not.toContain("dateFrom");
    expect(fetchFake.mock.calls[1][0]).toContain("after=cursor-opaco");
  });

  it("13A: sem pageSize nem filtro de data na URL; corta por data e deduplica localmente", async () => {
    const fetchFake = vi.fn((url: string) => {
      expect(url).not.toContain("pageSize");
      if (!url.includes("after=")) return Promise.resolve({ ok: true, json: async () => ({
        next: "?accountId=acc1&after=p2",
        results: [
          { id: "antiga", date: "2026-07-31T23:00:00Z", description: "Antes do corte", amount: 5, type: "CREDIT" },
          { id: "nova", date: "2026-08-01T10:00:00Z", description: "No corte", amount: 7, type: "DEBIT" },
        ],
      }) } as Response);
      return Promise.resolve({ ok: true, json: async () => ({ next: null, results: [
        { id: "nova", date: "2026-08-01T10:00:00Z", description: "No corte", amount: 7, type: "DEBIT" },
        { id: "depois", date: "2026-08-02", description: "Depois", amount: 9, type: "CREDIT" },
      ] }) } as Response);
    });
    const txs = await fetchPluggyTransactions("tok", "acc1", "2026-08-01", fetchFake as never);
    expect(txs.map((t) => t.externalId)).toEqual(["nova", "depois"]);
  });

  it("13A: cursor repetido interrompe a sincronização (não duplica)", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [], next: "?accountId=acc&after=x" }) });
    await expect(fetchPluggyTransactions("tok", "acc", null, fake)).rejects.toThrow("cursor repetido");
  });

  it("rejeita cursor de outro host antes de enviar a chave", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [], next: "https://outro-host.example/token" }) });
    await expect(fetchPluggyTransactions("segredo", "acc", null, fake)).rejects.toThrow("cursor inválido");
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("no HTTP 410 preserva detalhe da API e diagnostica o item", async () => {
    const fetchFake = vi.fn((url: string) => url.includes("/items/")
      ? Promise.resolve({ ok: true, json: async () => ({ status: "OUTDATED", executionStatus: "CONNECTION_ERROR", error: { message: "Conexão expirada" } }) } as Response)
      : Promise.resolve({ ok: false, status: 410, json: async () => ({ codeDescription: "ENDPOINT_GONE", message: "Use v2" }) } as Response));
    await expect(fetchPluggyTransactions("tok", "acc1", null, fetchFake as never, "item-1"))
      .rejects.toThrow(/HTTP 410.*Use v2.*OUTDATED.*Conexão expirada/);
  });
});
