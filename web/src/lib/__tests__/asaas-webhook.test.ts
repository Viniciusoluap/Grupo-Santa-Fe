import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ token: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/bancos", () => ({
  tokenWebhookAsaas: deps.token,
  sincronizarPorEvento: deps.sync,
  segredoConfere: (received: unknown, expected: string | null) => Boolean(expected && received === expected),
}));
import { POST } from "@/app/api/asaas/webhook/route";

function deliver(body: unknown, token = "test-hook-token") {
  return POST(new Request("https://example.invalid/api/asaas/webhook", {
    method: "POST", headers: { "asaas-access-token": token, "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}
describe("Asaas webhook: paridade de validação", () => {
  beforeEach(() => { vi.resetAllMocks(); deps.token.mockResolvedValue("test-hook-token"); deps.sync.mockResolvedValue([]); });
  afterEach(() => vi.restoreAllMocks());
  it("rejeita token inválido sem sincronizar", async () => {
    expect((await deliver({ event: "TRANSFER_DONE" }, "wrong")).status).toBe(401);
    expect(deps.sync).not.toHaveBeenCalled();
  });
  it("falha fechado sem token configurado", async () => {
    deps.token.mockResolvedValue(null);
    expect((await deliver({ event: "TRANSFER_DONE" })).status).toBe(401);
    expect(deps.sync).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { event: 1 }, { event: " " }, { event: "PAYMENT_RECEIVED" }, { event: "PAYMENT_CONFIRMED", payment: { id: 123 } }])("rejeita payload inválido sem sincronizar (%j)", async body => {
    expect((await deliver(body)).status).toBe(400);
    expect(deps.sync).not.toHaveBeenCalled();
  });
  it("rejeita JSON inválido", async () => {
    const res = await POST(new Request("https://example.invalid/api/asaas/webhook", { method: "POST", headers: { "asaas-access-token": "test-hook-token" }, body: "{" }));
    expect(res.status).toBe(400);
    expect(deps.sync).not.toHaveBeenCalled();
  });
  it("preserva sincronização de evento válido", async () => {
    expect((await deliver({ event: "PAYMENT_RECEIVED", payment: { id: "pay_test" } })).status).toBe(200);
    expect(deps.sync).toHaveBeenCalledWith({ provedor: "asaas" });
  });
  it("aceita eventos válidos sem pagamento", async () => {
    expect((await deliver({ event: "TRANSFER_DONE" })).status).toBe(200);
    expect(deps.sync).toHaveBeenCalledOnce();
  });
  it("health check autenticado não sincroniza", async () => {
    expect((await deliver({ event: "INTEGRATION_HEALTH_CHECK" })).status).toBe(200);
    expect(deps.sync).not.toHaveBeenCalled();
  });
});
