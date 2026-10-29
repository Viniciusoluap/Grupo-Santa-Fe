import { describe, expect, it, vi } from "vitest";
import { verificarWebhookAsaas, type WebhookRecoveryConfig } from "@/lib/bancos/asaas-webhook-recovery";

const config: WebhookRecoveryConfig = {
  apiKey: "test-api-key", token: "test-webhook-token-32-characters-long", environment: "production",
  canonicalUrl: "https://app.example.invalid/api/asaas/webhook", legacyName: "ExampleApp", legacyHosts: ["old.example.invalid"],
};
const hook = { id: "hook_test", name: "ExampleApp", url: config.canonicalUrl, enabled: false, interrupted: true, authToken: "different-token" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function fake(hooks: unknown[], opts: { probeStatus?: number; probeBody?: unknown; pages?: boolean } = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === config.canonicalUrl) return response(opts.probeBody ?? { received: true }, opts.probeStatus ?? 200);
    if (init?.method === "PUT") return response({ ...hook, url: config.canonicalUrl, authToken: config.token, enabled: true, interrupted: false });
    return response({ data: hooks, hasMore: false });
  });
}
describe("Recuperação limitada do webhook Asaas", () => {
  it("diagnostica sem devolver tokens nem alterar o provedor", async () => {
    const fetcher = fake([hook]);
    const result = await verificarWebhookAsaas(config, false, fetcher as typeof fetch);
    expect(result).toMatchObject({ encontrado: true, interrompido: true, tokenConfere: false, recuperado: false });
    expect(JSON.stringify(result)).not.toContain(config.token);
    expect(JSON.stringify(result)).not.toContain(hook.authToken);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("verifica endpoint antes de atualizar apenas configuração deste webhook", async () => {
    const fetcher = fake([{ ...hook, url: "https://old.example.invalid/api/asaas/webhook" }]);
    const result = await verificarWebhookAsaas(config, true, fetcher as typeof fetch);
    expect(result.recuperado).toBe(true);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.asaas.com/v3/webhooks?limit=100&offset=0", config.canonicalUrl,
      "https://api.asaas.com/v3/webhooks/hook_test",
    ]);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ redirect: "manual", body: JSON.stringify({ event: "INTEGRATION_HEALTH_CHECK" }) });
    const update = JSON.parse(fetcher.mock.calls[2][1]!.body as string);
    expect(update).toEqual({ url: config.canonicalUrl, authToken: config.token, enabled: true, interrupted: false });
    expect(update).not.toHaveProperty("events");
  });
  it.each([302, 401, 500])("não reativa se endpoint retorna %s", async status => {
    const fetcher = fake([hook], { probeStatus: status });
    await expect(verificarWebhookAsaas(config, true, fetcher as typeof fetch)).rejects.toThrow("não foi reativada");
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });
  it("não confunde página HTML/login com confirmação do webhook", async () => {
    const fetcher = fake([hook], { probeBody: { login: true } });
    await expect(verificarWebhookAsaas(config, true, fetcher as typeof fetch)).rejects.toThrow("não confirmou");
  });
  it("não cria configuração nem altera webhook de outro host/nome/caminho", async () => {
    const fetcher = fake([
      { ...hook, url: "https://other.example.invalid/api/asaas/webhook" },
      { ...hook, name: "AnotherApp", url: "https://old.example.invalid/api/asaas/webhook" },
      { ...hook, url: "https://old.example.invalid/api/other" },
    ]);
    expect((await verificarWebhookAsaas(config, true, fetcher as typeof fetch)).encontrado).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("não altera correspondência ambígua", async () => {
    const fetcher = fake([hook, { ...hook, id: "hook_other" }]);
    await expect(verificarWebhookAsaas(config, true, fetcher as typeof fetch)).rejects.toThrow("Mais de um");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("suporta token omitido pelo provedor sem alegar divergência", async () => {
    const fetcher = fake([{ ...hook, authToken: undefined }]);
    expect((await verificarWebhookAsaas(config, false, fetcher as typeof fetch)).tokenConfere).toBeNull();
  });
  it("não modifica token inválido nem gera credencial nova", async () => {
    const fetcher = fake([hook]);
    await expect(verificarWebhookAsaas({ ...config, token: "short" }, true, fetcher as typeof fetch)).rejects.toThrow("32 a 255");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("respeita ambiente sandbox e paginação", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ data: [], hasMore: false }));
    await verificarWebhookAsaas({ ...config, environment: "sandbox" }, false, fetcher as typeof fetch);
    expect(fetcher.mock.calls[0][0]).toMatch(/^https:\/\/sandbox.asaas.com\/api\/v3\/webhooks/);
  });
  it("não inclui descrição arbitrária do provedor em erro", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ errors: [{ description: config.apiKey }] }, 401));
    await expect(verificarWebhookAsaas(config, false, fetcher as typeof fetch)).rejects.toThrow("HTTP 401");
    await verificarWebhookAsaas(config, false, fetcher as typeof fetch).catch(error => expect(error.message).not.toContain(config.apiKey));
  });
});
