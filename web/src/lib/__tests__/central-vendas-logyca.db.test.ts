// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-logyca.test.ts) —
// etapa 10: adaptador Logyca (desligado por padrão). Só o que a documentação confirma: envio POST com Bearer e
// { number, message }; entrada pelo bloco "HTTP Request" com token próprio. fetch simulado.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;

import { criarBanco, montarCenario, NUMERO_TESTE, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { cifrar, definirDependencias } from "@/lib/central-vendas/base";
import { enfileirarTemplate, processarFila } from "@/lib/central-vendas/envio";
import { enviarLogyca } from "@/lib/central-vendas/logyca";
import { tratarEntrada } from "@/lib/central-vendas/rotas";
import { configSchema } from "@/lib/central-vendas/config";

describe("envio pela Logyca", () => {
  it("POST no endpoint de 'Mensagens API' com Bearer e { number, message }", async () => {
    const f = vi.fn<(u: string, i: RequestInit) => Promise<Response>>(async () => new Response("{}", { status: 200 }));
    const r = await enviarLogyca({ endpoint: "https://api.logyca.exemplo/mensagens", token: "tk" }, "99 98888-7777", "Olá", f as never);
    expect(r).toEqual({ ok: true, status: 200 });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.logyca.exemplo/mensagens");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tk", "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ number: "5599988887777", message: "Olá" });
  });
  it("recusa endpoint sem https e trata erro HTTP e rede sem lançar", async () => {
    expect(await enviarLogyca({ endpoint: "http://x.exemplo", token: "t" }, "1", "m")).toMatchObject({ ok: false, erro: expect.stringContaining("https") });
    expect(await enviarLogyca({ endpoint: "https://x.exemplo", token: "t" }, "1", "m", (async () => new Response("", { status: 401 })) as never)).toMatchObject({ ok: false, status: 401 });
    expect(await enviarLogyca({ endpoint: "https://x.exemplo", token: "t" }, "1", "m", (async () => { throw new Error("rede"); }) as never)).toMatchObject({ ok: false, status: 0 });
  });
  it("a flag começa desligada", () => {
    expect(configSchema.parse({}).logyca).toEqual({ ativo: false, usarParaEnvio: false, endpointEnvio: "" });
  });
});

describe("Logyca integrada à Central", () => {
  let b: Banco;
  let c: Cenario;
  let ana: string;
  beforeAll(async () => { b = await criarBanco(); }, 60_000);
  afterAll(async () => { definirDependencias(); await b?.fechar(); });
  beforeEach(async () => {
    c = await montarCenario(b);
    definirDependencias({ enviar: null }); // usa o envio padrão (Logyca), com fetch simulado
    ana = await c.novoLead({ nome: "Ana", telefone: "99988887777" });
    await c.prisma.centralVendasLead.create({ data: { leadId: ana, operadorId: U.olga } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("ligada para envio: a fila manda pela Logyca; falha vai para reprocessamento", async () => {
    await c.salvarConfig({ logyca: { ativo: true, usarParaEnvio: true, endpointEnvio: "https://api.logyca.exemplo/mensagens" }, segredos: { tokenLogycaEnvio: cifrar("tk-envio") } });
    const f = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", f);
    await enfileirarTemplate({ leadId: ana, slug: "cv-sem-resposta", chave: "x1", proativa: false });
    await processarFila();
    expect(await c.prisma.centralVendasFila.findMany({ select: { status: true, tentativas: true } })).toEqual([{ status: "pendente", tentativas: 1 }]);
    f.mockImplementation(async () => new Response("{}", { status: 200 }));
    c.avancar(2);
    await processarFila();
    expect(await c.prisma.centralVendasFila.findMany({ select: { status: true } })).toEqual([{ status: "concluido" }]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body)).number).toBe("5599988887777");
  });

  it("entrada da Logyca exige o token próprio e não aciona a IA", async () => {
    const req = (t: string) => ({ authorization: `Bearer ${t}`, body: { telefone: "5599977776666", nome: "Caio", mensagem: "Quero saber do Colina", idExterno: "lg-9" }, ip: "2.2.2.2" });
    await c.salvarConfig({ numerosTeste: [NUMERO_TESTE, "5599977776666"], logyca: { ativo: true, usarParaEnvio: false, endpointEnvio: "" }, segredos: { tokenLogycaEntrada: cifrar("tk-in") } });
    expect((await tratarEntrada("logyca", req("errado"))).status).toBe(401);
    expect(await tratarEntrada("logyca", req("tk-in"))).toMatchObject({ status: 200, body: { novo: true } });
    expect(await tratarEntrada("logyca", req("tk-in"))).toMatchObject({ status: 200, body: { novo: false } });
    expect(c.chamadasIA).toHaveLength(0);
    expect(await c.prisma.centralVendasLead.findMany({ where: { leadId: { not: ana } }, select: { origem: true, idExterno: true } })).toEqual([{ origem: "logyca", idExterno: "lg-9" }]);
  });
});
