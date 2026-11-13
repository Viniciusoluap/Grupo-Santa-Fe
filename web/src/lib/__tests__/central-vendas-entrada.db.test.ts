// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-entrada.test.ts) —
// etapa 3: serviço de entrada (WhatsApp, site, Logyca), deduplicação e origem. Banco em memória (PGlite com o
// Prisma real); envio e IA simulados — nenhuma chamada externa.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;

import { aviso, criarBanco, montarCenario, NUMERO_TESTE, OUTRO_NUMERO, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { cifrar, definirDependencias } from "@/lib/central-vendas/base";
import { receberContato } from "@/lib/central-vendas/entrada";
import { tratarEntrada } from "@/lib/central-vendas/rotas";
import { processarEventoEvolution } from "@/lib/whatsapp/webhook-evolution";
import { extrairRef, linkCampanha, origemDoRef } from "@/lib/central-vendas/regras";

let b: Banco;
let c: Cenario;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
beforeEach(async () => { c = await montarCenario(b); });

describe("origem pelo código de campanha", () => {
  it("lê [ref:...] e resolve canal/empreendimento", () => {
    expect(extrairRef("Olá! [ref:instagram-colina-park]")).toBe("instagram-colina-park");
    expect(extrairRef("Olá [REF: Teste ]")).toBe("teste");
    expect(extrairRef("sem código")).toBeNull();
    const produtos = [{ id: 7, slug: "colina-park" }];
    expect(origemDoRef("instagram-colina-park", [], produtos)).toEqual({ canal: "instagram", campanha: "instagram-colina-park", produtoId: 7 });
    expect(origemDoRef("x", [{ codigo: "x", canal: "facebook", produtoId: null }], produtos)).toEqual({ canal: "facebook", campanha: "x", produtoId: null });
    expect(linkCampanha("(99) 99000-0000", "instagram-colina-park")).toBe("https://wa.me/5599990000000?text=Ol%C3%A1!%20%5Bref%3Ainstagram-colina-park%5D");
  });
});

describe("mensagem de número novo no WhatsApp", () => {
  it("cria um único lead, mesmo com o aviso repetido, com origem da campanha e operador do rodízio", async () => {
    await c.prisma.centralVendasProduto.create({ data: { slug: "colina-park", nome: "Colina Park" } });
    const ev = aviso("MSG1", NUMERO_TESTE, "Olá! [ref:instagram-colina-park]");
    await processarEventoEvolution(ev);
    await processarEventoEvolution(ev); // a Evolution reenviou o mesmo aviso
    const ls = await c.prisma.lead.findMany({ select: { id: true, nome: true, telefone: true, origem: true, responsavelId: true, etapaOperacional: true } });
    expect(ls).toEqual([{ id: expect.any(String), nome: "Cliente Teste", telefone: "99988887777", origem: "instagram", responsavelId: U.olga, etapaOperacional: expect.any(String) }]);
    const leadId = ls[0].id;
    expect(await c.prisma.centralVendasLead.findMany({ select: { leadId: true, origem: true, campanha: true, produtoId: true, operadorId: true } })).toEqual([
      { leadId, origem: "whatsapp", campanha: "instagram-colina-park", produtoId: 1, operadorId: U.olga },
    ]);
    expect(await c.prisma.mensagemWhatsapp.findMany({ where: { direcao: "entrada" }, select: { leadId: true } })).toEqual([{ leadId }]);
    expect((await c.prisma.centralVendasEvento.findMany({ orderBy: { id: "asc" } })).map(e => e.tipo)).toEqual(expect.arrayContaining(["lead_criado", "atribuido"]));
  });

  it("avisos simultâneos de mensagens diferentes do mesmo número não duplicam o lead", async () => {
    const r = await Promise.all([1, 2, 3].map(i => receberContato({ origem: "whatsapp", telefone: NUMERO_TESTE, texto: `oi ${i}` })));
    expect(r.filter(x => x.criado)).toHaveLength(1);
    expect(await c.prisma.lead.count()).toBe(1);
    // Com e sem o 9º dígito e o 55: mesma chave de telefone.
    expect((await receberContato({ origem: "whatsapp", telefone: "99 8888-7777" })).criado).toBe(false);
    expect(await c.prisma.lead.count()).toBe(1);
  });

  it("lead que já existia no CRM não é recriado e fica com atendimento humano (a IA não assume)", async () => {
    await c.novoLead({ nome: "Maria Antiga", telefone: "(99) 98888-7777", responsavelId: U.otto });
    await processarEventoEvolution(aviso("M2", NUMERO_TESTE, "Oi, sou eu"));
    expect(await c.prisma.lead.count()).toBe(1);
    expect(await c.prisma.centralVendasLead.findMany({ select: { origem: true, statusAtendimento: true, operadorId: true } })).toEqual([{ origem: "crm", statusAtendimento: "em_atendimento_humano", operadorId: U.otto }]);
    expect(c.chamadasIA).toHaveLength(0);
  });

  it("modo de teste ignora números fora da lista e Central desligada não faz nada", async () => {
    await processarEventoEvolution(aviso("M3", OUTRO_NUMERO, "Olá"));
    expect(await c.prisma.lead.count()).toBe(0);
    await c.salvarConfig({ ativo: false });
    await processarEventoEvolution(aviso("M4", NUMERO_TESTE, "Olá"));
    expect(await c.prisma.lead.count()).toBe(0);
    expect(await c.prisma.mensagemWhatsapp.count()).toBe(2); // o WhatsApp segue como antes
  });
});

describe("entrada do site e da Logyca", () => {
  const req = (token: string | null, body: unknown, ip = "1.1.1.1") => ({ authorization: token ? `Bearer ${token}` : null, body, ip });

  beforeEach(async () => {
    await c.salvarConfig({ segredos: { tokenSite: cifrar("tok-site"), tokenLogycaEntrada: cifrar("tok-logyca") } });
  });

  it("exige token, valida o payload e é idempotente pela origem + ID externo", async () => {
    const body = { telefone: NUMERO_TESTE, nome: "Bia Site", idExterno: "form-1", campanha: "site-colina" };
    expect((await tratarEntrada("site", req(null, body))).status).toBe(401);
    expect((await tratarEntrada("site", req("errado", body))).status).toBe(401);
    expect((await tratarEntrada("site", req("tok-site", { telefone: "1" }))).status).toBe(400);
    expect((await tratarEntrada("site", req("tok-site", { ...body, cpf: "x" }))).status).toBe(400); // campo desconhecido
    const a = await tratarEntrada("site", req("tok-site", body));
    const d = await tratarEntrada("site", req("tok-site", body));
    const leadId = await c.lead();
    expect(a).toMatchObject({ status: 200, body: { novo: true, leadId } });
    expect(d).toMatchObject({ status: 200, body: { novo: false, leadId } });
    expect(await c.prisma.lead.findMany({ select: { nome: true, origem: true } })).toEqual([{ nome: "Bia Site", origem: "site" }]);
    // Saudação com o pedido de consentimento saiu para o lead do site (10h: dentro da janela).
    expect(c.envios.map(e => e.texto)).toEqual([expect.stringContaining("LGPD")]);
    expect(JSON.stringify(a.body)).not.toContain(NUMERO_TESTE);
  });

  it("Logyca desligada por padrão; ligada, o dado do Santa Fé prevalece e o conflito é registrado", async () => {
    const body = { telefone: NUMERO_TESTE, nome: "Outro Nome", idExterno: "lg-1" };
    expect((await tratarEntrada("logyca", req("tok-logyca", body))).status).toBe(404);
    await c.novoLead({ nome: "Nome Santa Fé", telefone: "99988887777" });
    await c.salvarConfig({ logyca: { ativo: true, usarParaEnvio: false, endpointEnvio: "" }, segredos: { tokenLogycaEntrada: cifrar("tok-logyca") } });
    expect((await tratarEntrada("logyca", req("tok-logyca", body))).status).toBe(200);
    expect(await c.prisma.lead.findMany({ select: { nome: true } })).toEqual([{ nome: "Nome Santa Fé" }]);
    expect(await c.prisma.centralVendasEvento.findMany({ where: { tipo: "conflito_logyca" }, select: { tipo: true, payload: true } })).toEqual([
      { tipo: "conflito_logyca", payload: JSON.stringify({ campos: ["nome"], prevalece: "santa_fe" }) },
    ]);
  });

  it("limita a taxa por origem e IP", async () => {
    const body = { telefone: NUMERO_TESTE };
    const r = [];
    for (let i = 0; i < 32; i++) r.push((await tratarEntrada("site", req("tok-site", body, "9.9.9.9"))).status);
    expect(r.slice(0, 30).every(s => s === 200)).toBe(true);
    expect(r.slice(30)).toEqual([429, 429]);
  });
});
