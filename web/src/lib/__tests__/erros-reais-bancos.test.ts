import { describe, expect, it } from "vitest";
import { dicaPluggy, mensagemRecusaPluggy } from "@/lib/bancos/pluggy";
import { dicaAsaas, fetchAsaasSaldo } from "@/lib/bancos/asaas-extrato";

// Lote 4 (frente antiga Lote D): erros reais do Asaas/Pluggy com o motivo e o que fazer.
// Mesmo teste nos dois sistemas. Nenhuma chamada externa (fetch simulado).
const resp = (corpo: unknown, status: number) => ({ ok: status < 400, status, json: async () => corpo }) as unknown as Response;

describe("erros reais — Pluggy", () => {
  it("dica por status", () => {
    expect(dicaPluggy(401)).toMatch(/Credencial inválida/);
    expect(dicaPluggy(400)).toMatch(/parâmetros inválidos/);
    expect(dicaPluggy(403)).toMatch(/Acesso negado/);
    expect(dicaPluggy(404)).toMatch(/reconecte/);
    expect(dicaPluggy(429)).toMatch(/Limite/);
    expect(dicaPluggy(503)).toMatch(/instável/);
    expect(dicaPluggy(200)).toBe("");
    expect(dicaPluggy(null)).toBe("");
  });

  it("mensagem: motivo real + dica; trial mantém a dica do plano; rede sem resposta", () => {
    expect(mensagemRecusaPluggy(400, "property pageSize should not exist")).toBe(`A Pluggy recusou (HTTP 400): property pageSize should not exist.${dicaPluggy(400)}`);
    expect(mensagemRecusaPluggy(403, "Your trial has expired")).toMatch(/plano gratuito/);
    expect(mensagemRecusaPluggy(null, "ECONNRESET")).toBe("Não consegui falar com a Pluggy: ECONNRESET");
  });
});

describe("erros reais — Asaas", () => {
  it("401 traz o motivo do Asaas e a dica de restrição de IP", async () => {
    const f = async () => resp({ errors: [{ code: "invalid_access_token", description: "A chave de API fornecida é inválida" }] }, 401);
    await expect(fetchAsaasSaldo("$aact_prod_x", f as typeof fetch)).rejects.toThrow(/HTTP 401\): A chave de API fornecida é inválida\. Confira .*restrição de IP/);
  });

  it("outros status", async () => {
    expect(dicaAsaas(403)).toMatch(/permissão/);
    expect(dicaAsaas(429)).toMatch(/Limite/);
    expect(dicaAsaas(500)).toMatch(/instável/);
    expect(dicaAsaas(400)).toBe("");
    const f = async () => resp({}, 503);
    await expect(fetchAsaasSaldo("$aact_x", f as typeof fetch)).rejects.toThrow(/HTTP 503\)\. O Asaas está instável/);
  });
});
