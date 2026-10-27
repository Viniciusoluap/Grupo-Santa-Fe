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
      { externalId: "pluggy:provider-77", identificadorBancario: "provider-77", data: "2026-10-01", descricao: "PIX MARIA", valor: 25, tipo: "credito", categoria: undefined, titular: "Maria" },
    ]);
    expect(fetchFake).toHaveBeenCalledTimes(2);
  });

  it("no HTTP 410 preserva detalhe da API e diagnostica o item", async () => {
    const fetchFake = vi.fn((url: string) => url.includes("/items/")
      ? Promise.resolve({ ok: true, json: async () => ({ status: "OUTDATED", executionStatus: "CONNECTION_ERROR", error: { message: "Conexão expirada" } }) } as Response)
      : Promise.resolve({ ok: false, status: 410, json: async () => ({ codeDescription: "ENDPOINT_GONE", message: "Use v2" }) } as Response));
    await expect(fetchPluggyTransactions("tok", "acc1", null, fetchFake as never, "item-1"))
      .rejects.toThrow(/HTTP 410.*Use v2.*OUTDATED.*Conexão expirada/);
  });
});
