// LOTE B/D (25/10): Configurações › Integrações. Asaas, Pluggy e Evolution simulados — nada externo
// é chamado. Mesmos cenários de Prospecta/server/integracoes.test.ts (aqui com server actions).
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
const sessao = vi.hoisted(() => ({ user: { id: "admin-1", role: "admin" } as { id: string; role: string } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));

import {
  finalDaChave, salvarAsaasIntegracao, salvarEvolutionIntegracao, salvarPluggyIntegracao, statusIntegracoes, testarIntegracao,
  type IntegracoesDeps,
} from "@/lib/integracoes";
import { autenticarPluggyDetalhado, authenticatePluggy, mensagemRecusaPluggy } from "@/lib/bancos/pluggy";
import { ambienteDaChaveAsaas } from "@/lib/bancos/asaas-central";
import { testarEvolution } from "@/lib/evolution";
import * as acoes from "@/lib/actions/integracoes";

const resp = (corpo: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => corpo } as Response);

const CHAVE_ASAAS = "$aact_prod_000000000000abcd";
const ADMIN = { id: "admin-1", perfil: "admin" };

function setup(over: Partial<IntegracoesDeps> = {}) {
  const deps: IntegracoesDeps = {
    lerAsaas: vi.fn(async () => ({ apiKey: CHAVE_ASAAS, environment: "production" as const, fonte: "banco" as const })),
    asaasSalvoNoBanco: vi.fn(async () => true),
    lerWebhookAsaas: vi.fn(async () => ({ token: "token-webhook-9876", fonte: "banco" as const })),
    salvarAsaas: vi.fn(async () => undefined),
    lerPluggy: vi.fn(async () => ({ clientId: "client-id-1111", clientSecret: "client-secret-2222", fonte: "banco" as const })),
    salvarPluggy: vi.fn(async () => undefined),
    lerEvolution: vi.fn(async () => ({ url: "https://evo.up.railway.app", apiKey: "evo-chave-3333", fonte: "banco" as const })),
    salvarEvolution: vi.fn(async () => undefined),
    estadoWhatsapp: vi.fn(async () => "conectado" as const),
    fetchImpl: vi.fn(() => resp({})) as never,
    ...over,
  };
  return deps;
}

describe("Integrações — status mascarado", () => {
  it("mostra só os 4 últimos caracteres e nunca a chave", async () => {
    const s = await statusIntegracoes(setup());
    expect(s.asaas).toMatchObject({ configurado: true, final: "…abcd", fonte: "banco", ambiente: "production", webhookFinal: "…9876", salvaNoBancoIgnorada: false });
    expect(s.asaas.webhookUrl).toBe("https://www.gruposantafee.com.br/api/asaas/webhook");
    expect(s.pluggy).toEqual({ configurado: true, clientIdFinal: "…1111", secretFinal: "…2222", fonte: "banco" });
    expect(s.whatsapp).toMatchObject({ configurado: true, url: "https://evo.up.railway.app", final: "…3333" });
    const json = JSON.stringify(s);
    for (const segredo of [CHAVE_ASAAS, "token-webhook-9876", "client-id-1111", "client-secret-2222", "evo-chave-3333"]) expect(json).not.toContain(segredo);
  });

  it("avisa quando a chave em uso vem da variável de ambiente", async () => {
    const s = await statusIntegracoes(setup({ lerAsaas: vi.fn(async () => ({ apiKey: "$aact_hmlg_xyz12345", environment: "sandbox" as const, fonte: "env" as const })) }));
    expect(s.asaas).toMatchObject({ fonte: "env", ambiente: "sandbox", salvaNoBancoIgnorada: true });
  });

  it("nada configurado (e falha de leitura não derruba a tela)", async () => {
    const s = await statusIntegracoes(setup({
      lerAsaas: vi.fn(async () => null), lerWebhookAsaas: vi.fn(async () => null),
      lerPluggy: vi.fn(async () => { throw new Error("Segredo criptografado inválido."); }), lerEvolution: vi.fn(async () => null),
    }));
    expect(s.asaas.configurado).toBe(false);
    expect(s.asaas.webhookConfigurado).toBe(false);
    expect(s.pluggy.configurado).toBe(false);
    expect(s.whatsapp.configurado).toBe(false);
  });

  it("finalDaChave e ambiente pelo prefixo", () => {
    expect(finalDaChave("12345678")).toBe("…5678");
    expect(finalDaChave("abc")).toBe("…");
    expect(finalDaChave(null)).toBeNull();
    expect(ambienteDaChaveAsaas(" $aact_prod_x")).toBe("production");
    expect(ambienteDaChaveAsaas("$aact_hmlg_x")).toBe("sandbox");
  });
});

describe("Integrações — testar com a mensagem real", () => {
  it("Asaas 401: mostra o errors[].description devolvido e a dica de restrição de IP", async () => {
    const fetchImpl = vi.fn<(u: string) => Promise<Response>>(() => resp({ errors: [{ code: "invalid_access_token", description: "A chave de API fornecida é inválida" }] }, 401));
    const r = await testarIntegracao("asaas", ADMIN, setup({ fetchImpl: fetchImpl as never }));
    expect(r.ok).toBe(false);
    expect(r.mensagem).toBe("O Asaas recusou o acesso (HTTP 401): A chave de API fornecida é inválida. Confira se a chave está ativa e se há restrição de IP no Asaas (Integrações › Chave de API).");
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://api.asaas.com/v3/finance/balance");
  });

  it("Asaas 500 sem corpo: HTTP sem dica de IP", async () => {
    const r = await testarIntegracao("asaas", ADMIN, setup({ fetchImpl: vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => { throw new Error("vazio"); } } as unknown as Response)) as never }));
    expect(r.mensagem).toBe("O Asaas recusou o acesso (HTTP 500).");
  });

  it("Asaas ok: conectado com ambiente e saldo; sem chave avisa", async () => {
    const r = await testarIntegracao("asaas", ADMIN, setup({ fetchImpl: vi.fn(() => resp({ balance: 10 })) as never }));
    expect(r.ok).toBe(true);
    expect(r.mensagem).toMatch(/^Asaas conectado \(produção\)\. Saldo: R\$\s10,00\.$/);
    expect(await testarIntegracao("asaas", ADMIN, setup({ lerAsaas: vi.fn(async () => null) }))).toEqual({ ok: false, mensagem: "Nenhuma chave do Asaas configurada." });
  });

  it("Pluggy 403: mostra o message e a dica do plano gratuito", async () => {
    const r = await testarIntegracao("pluggy", ADMIN, setup({ fetchImpl: vi.fn(() => resp({ code: 403, message: "Your trial has expired, please contact sales" }, 403)) as never }));
    expect(r).toEqual({ ok: false, mensagem: "A Pluggy recusou (HTTP 403): Your trial has expired, please contact sales — o plano gratuito da Pluggy não libera a API; use Importar extrato." });
  });

  it("Pluggy 401 sem trial: sem a dica do plano; ok: conectada", async () => {
    expect((await testarIntegracao("pluggy", ADMIN, setup({ fetchImpl: vi.fn(() => resp({ message: "Invalid credentials" }, 401)) as never }))).mensagem)
      .toBe("A Pluggy recusou (HTTP 401): Invalid credentials");
    expect(await testarIntegracao("pluggy", ADMIN, setup({ fetchImpl: vi.fn(() => resp({ apiKey: "tok" })) as never }))).toEqual({ ok: true, mensagem: "Pluggy conectada." });
  });

  it("WhatsApp: servidor ok e estado da conexão do admin", async () => {
    const deps = setup({ fetchImpl: vi.fn(() => resp([])) as never, estadoWhatsapp: vi.fn(async () => "aguardando_qr" as const) });
    const r = await testarIntegracao("whatsapp", ADMIN, deps);
    expect(r).toMatchObject({ ok: true, estado: "aguardando_qr" });
    expect(r.mensagem).toContain("aguardando a leitura do QR code");
    expect(deps.estadoWhatsapp).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ url: "https://evo.up.railway.app" }));
  });

  it("WhatsApp: chave recusada mostra o motivo da Evolution", async () => {
    const r = await testarIntegracao("whatsapp", ADMIN, setup({ fetchImpl: vi.fn(() => resp({ response: { message: ["Unauthorized"] } }, 401)) as never }));
    expect(r).toEqual({ ok: false, mensagem: "A Evolution recusou a chave (HTTP 401): Unauthorized. Confira a AUTHENTICATION_API_KEY." });
  });
});

describe("Integrações — trocar valida antes de salvar", () => {
  it("Asaas: chave recusada não é salva e devolve a mensagem real", async () => {
    const deps = setup({ fetchImpl: vi.fn(() => resp({ errors: [{ description: "IP não autorizado" }] }, 401)) as never });
    await expect(salvarAsaasIntegracao({ apiKey: "$aact_prod_ruim12345" }, deps)).rejects.toThrow(/IP não autorizado/);
    expect(deps.salvarAsaas).not.toHaveBeenCalled();
  });

  it("Asaas: ambiente inferido pelo prefixo; chave e token salvos juntos", async () => {
    const deps = setup({ fetchImpl: vi.fn(() => resp({ balance: 0 })) as never });
    await expect(salvarAsaasIntegracao({ apiKey: ` ${CHAVE_ASAAS} `, webhookToken: "tok-novo-1234" }, deps)).resolves.toEqual({ success: true, ambiente: "production" });
    expect(deps.salvarAsaas).toHaveBeenCalledWith({ apiKey: CHAVE_ASAAS, webhookToken: "tok-novo-1234" });
    await salvarAsaasIntegracao({ apiKey: "$aact_hmlg_teste1234" }, deps);
    expect(deps.salvarAsaas).toHaveBeenLastCalledWith({ apiKey: "$aact_hmlg_teste1234" });
  });

  it("Asaas: só o token do webhook não chama o Asaas; vazio ou curto é recusado", async () => {
    const fetchImpl = vi.fn(() => resp({}));
    const deps = setup({ fetchImpl: fetchImpl as never });
    await expect(salvarAsaasIntegracao({ webhookToken: "tok-novo-1234" }, deps)).resolves.toEqual({ success: true, ambiente: null });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(deps.salvarAsaas).toHaveBeenCalledWith({ webhookToken: "tok-novo-1234" });
    await expect(salvarAsaasIntegracao({}, deps)).rejects.toThrow("Cole a nova chave de API ou o novo token do webhook.");
    await expect(salvarAsaasIntegracao({ webhookToken: "curto" }, deps)).rejects.toThrow(/inválido/);
  });

  it("Pluggy: recusa não salva; aceita salva", async () => {
    const recusa = setup({ fetchImpl: vi.fn(() => resp({ message: "Invalid credentials" }, 401)) as never });
    await expect(salvarPluggyIntegracao({ clientId: "x", clientSecret: "y" }, recusa)).rejects.toThrow("A Pluggy recusou (HTTP 401): Invalid credentials");
    expect(recusa.salvarPluggy).not.toHaveBeenCalled();
    const ok = setup({ fetchImpl: vi.fn(() => resp({ apiKey: "tok" })) as never });
    await salvarPluggyIntegracao({ clientId: " cid ", clientSecret: "sec" }, ok);
    expect(ok.salvarPluggy).toHaveBeenCalledWith({ clientId: "cid", clientSecret: "sec" });
    await expect(salvarPluggyIntegracao({ clientId: "", clientSecret: "y" }, ok)).rejects.toThrow("Informe o Client ID.");
  });

  it("Evolution: endereço normalizado antes de testar e de salvar; recusa não salva", async () => {
    const fetchImpl = vi.fn<(u: string) => Promise<Response>>(() => resp([]));
    const deps = setup({ fetchImpl: fetchImpl as never });
    await expect(salvarEvolutionIntegracao({ url: "  evo.up.railway.app/manager/ ", apiKey: "chave-evo-5555" }, deps)).resolves.toEqual({ success: true, url: "https://evo.up.railway.app" });
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://evo.up.railway.app/instance/fetchInstances");
    expect(deps.salvarEvolution).toHaveBeenCalledWith({ url: "https://evo.up.railway.app", apiKey: "chave-evo-5555" });
    const recusa = setup({ fetchImpl: vi.fn(() => resp({}, 401)) as never });
    await expect(salvarEvolutionIntegracao({ url: "evo.app", apiKey: "chave-evo-5555" }, recusa)).rejects.toThrow(/recusou a chave \(HTTP 401\)/);
    expect(recusa.salvarEvolution).not.toHaveBeenCalled();
    await expect(salvarEvolutionIntegracao({ url: "evo.app", apiKey: "curta" }, deps)).rejects.toThrow("Chave de acesso muito curta.");
  });
});

describe("Integrações — só o admin (server actions devolvem { erro })", () => {
  it("colaborador, corretor e cliente são barrados em todas as ações", async () => {
    for (const role of ["colaborador", "corretor", "cliente"]) {
      sessao.user.role = role;
      expect(await acoes.statusIntegracoesAcao()).toEqual({ erro: "Não autorizado." });
      expect(await acoes.testarIntegracaoAcao("asaas")).toMatchObject({ ok: false, erro: "Não autorizado." });
      expect(await acoes.salvarAsaasIntegracaoAcao({ webhookToken: "token-novo-123" })).toEqual({ erro: "Não autorizado." });
      expect(await acoes.salvarPluggyIntegracaoAcao({ clientId: "a", clientSecret: "b" })).toEqual({ erro: "Não autorizado." });
      expect(await acoes.salvarEvolutionIntegracaoAcao({ url: "https://evo.app", apiKey: "chave-evo-5555" })).toEqual({ erro: "Não autorizado." });
    }
    sessao.user.role = "admin";
    expect(await acoes.testarIntegracaoAcao("x" as never)).toMatchObject({ ok: false, erro: "Serviço inválido." });
    expect(await acoes.salvarAsaasIntegracaoAcao({})).toEqual({ erro: "Cole a nova chave de API ou o novo token do webhook." });
  });
});

describe("Pluggy e Evolution — erro real (LOTE D)", () => {
  it("autenticação detalhada devolve status e mensagem; authenticatePluggy continua devolvendo null", async () => {
    const f = vi.fn(() => resp({ message: "Forbidden" }, 403)) as never;
    expect(await autenticarPluggyDetalhado("a", "b", f)).toEqual({ ok: false, status: 403, mensagem: "Forbidden" });
    expect(await authenticatePluggy("a", "b", f)).toBeNull();
    expect(await autenticarPluggyDetalhado("a", "b", vi.fn(() => Promise.reject(new Error("ECONNRESET"))) as never)).toEqual({ ok: false, status: null, mensagem: "ECONNRESET" });
    expect(mensagemRecusaPluggy(null, "ECONNRESET")).toBe("Não consegui falar com a Pluggy: ECONNRESET");
    expect(mensagemRecusaPluggy(403, "Subscription required")).toContain("plano gratuito");
  });

  it("Evolution 403 mostra o motivo devolvido", async () => {
    await expect(testarEvolution({ url: "https://evo.app", apiKey: "k" }, vi.fn(() => resp({ message: "Forbidden key" }, 403)) as never))
      .rejects.toThrow("A Evolution recusou a chave (HTTP 403): Forbidden key. Confira a AUTHENTICATION_API_KEY.");
  });
});
