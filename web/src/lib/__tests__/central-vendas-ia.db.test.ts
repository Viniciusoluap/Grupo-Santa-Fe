// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-ia.test.ts) — etapa 5:
// agente de IA (respostas simuladas; nenhuma chamada à Anthropic). Regras proibidas verificadas na saída,
// transferência para humano em cada gatilho, LGPD e limite de tokens.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;

import { aviso, criarBanco, montarCenario, NUMERO_TESTE, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { definirDependencias } from "@/lib/central-vendas/base";
import { configSchema } from "@/lib/central-vendas/config";
import { processarFila } from "@/lib/central-vendas/envio";
import { lerSaidaIA } from "@/lib/central-vendas/ia";
import { processarEventoEvolution } from "@/lib/whatsapp/webhook-evolution";
import { gatilhoNoTexto, valorCanonico, violacoesResposta } from "@/lib/central-vendas/regras";

let b: Banco;
let c: Cenario;
let seq = 0;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
const montar = async (config = {}) => { c = await montarCenario(b, { config }); };
const cliente = async (texto: string) => { c.avancar(0.01); return processarEventoEvolution(aviso(`M${++seq}`, NUMERO_TESTE, texto)); };
const estado = async () => (await c.prisma.centralVendasLead.findFirst({ select: { statusAtendimento: true, statusAnalise: true, motivoTransferencia: true, semProgresso: true } }))!;

describe("regras proibidas (saída da IA)", () => {
  const base = "Colina Park: casas a partir de R$ 180.000,00. Parcelas a partir de R$ 650,00 conforme análise. Entrada facilitada em 10x.";
  it.each([
    ["Sim! Seu financiamento está aprovado.", ["promessa_aprovacao"]],
    ["Com certeza você vai ser aprovado, pode ficar tranquilo.", ["promessa_aprovacao"]],
    ["Garantimos a aprovação do seu crédito.", ["promessa_aprovacao"]],
    ["Você já está pré-aprovado!", ["promessa_aprovacao"]],
    ["A taxa de juros é de 7,5% ao ano.", ["condicao_nao_cadastrada"]],
    ["As parcelas ficam em R$ 499,00.", ["condicao_nao_cadastrada"]],
    ["Dá para fazer em 360 parcelas.", ["condicao_nao_cadastrada"]],
    ["Infelizmente seu cadastro foi reprovado.", ["decisao_financeira"]],
  ])("bloqueia: %s", (resposta, esperado) => {
    expect(violacoesResposta(resposta, base)).toEqual(esperado);
  });
  it.each([
    "As casas do Colina Park começam em R$ 180 mil.",
    "As parcelas começam em R$ 650,00, conforme a análise da equipe.",
    "A entrada pode ser em 10x.",
    "A aprovação depende da análise do banco; nossa equipe vai avaliar seu cadastro.",
    "Qual é a sua renda mensal?",
  ])("permite o que está cadastrado ou neutro: %s", resposta => {
    expect(violacoesResposta(resposta, base)).toEqual([]);
  });
  it("normaliza números e detecta gatilhos no texto do cliente", () => {
    expect(valorCanonico("R$ 1.234,56")).toBe("1234.56");
    expect(valorCanonico("180 mil")).toBe("180000");
    expect(valorCanonico("650,00")).toBe("650");
    expect(gatilhoNoTexto("Quero falar com um atendente")).toBe("pedido_cliente");
    expect(gatilhoNoTexto("Isso é um absurdo!")).toBe("reclamacao");
    expect(gatilhoNoTexto("Vou procurar meu advogado")).toBe("juridico");
    expect(gatilhoNoTexto("Tem desconto à vista?")).toBe("negociacao_valor");
    expect(gatilhoNoTexto("Minha renda é 3 mil")).toBeNull();
  });
  it("campo fora da lista fechada é descartado (a IA não consegue marcar aprovado)", () => {
    const s = lerSaidaIA(JSON.stringify({ resposta: "ok", confianca: 0.9, statusAnalise: "aprovado", campos: { aprovado: true, nome: "Ana" } }));
    expect(s).toEqual({ resposta: "ok", confianca: 0.9, transferir: false, campos: { nome: "Ana" } });
  });
  it("modelo de IA igual ao da Prospecta e Central entra desligada, em modo de teste", () => {
    expect(configSchema.parse({})).toMatchObject({ ativo: false, modoTeste: true, modeloIA: "claude-sonnet-5" });
  });
});

describe("atendimento pela IA", () => {
  beforeEach(async () => {
    await montar();
    await c.prisma.centralVendasProduto.create({ data: { slug: "teste", nome: "Residencial Teste", cidade: "Imperatriz", precoMin: 180000, condicoes: "Parcelas a partir de R$ 650,00 conforme análise." } });
    c.ia("Olá! Sou a assistente do Grupo Santa Fé. Posso usar seus dados só neste atendimento (LGPD)? Responda SIM.");
    await cliente("Olá [ref:teste]");
  });

  it("saúda e pede o consentimento; sem consentimento não grava dados; com ele, grava LGPD e os campos", async () => {
    expect(c.envios.map(e => e.texto)).toEqual([expect.stringContaining("LGPD")]);
    c.ia("Antes preciso do seu consentimento.", { nome: "Ana Souza", cidade: "Imperatriz" });
    await cliente("Sou Ana, de Imperatriz");
    expect((await c.prisma.lead.findFirst())?.nome).toBe("Cliente Teste");
    expect(await c.prisma.centralVendasLead.findFirst({ select: { cidade: true, lgpdConsentimento: true } })).toEqual({ cidade: null, lgpdConsentimento: false });
    c.ia("Obrigada, Ana! Qual a sua renda mensal?", { lgpdConsentimento: true, nome: "Ana Souza", cidade: "Imperatriz" });
    await cliente("SIM, autorizo. Sou Ana Souza de Imperatriz");
    expect((await c.prisma.lead.findFirst())?.nome).toBe("Ana Souza");
    const cv = await c.prisma.centralVendasLead.findFirst();
    expect(cv).toMatchObject({ cidade: "Imperatriz", lgpdConsentimento: true });
    expect(cv?.lgpdConsentimentoEm).not.toBeNull();
    expect((await c.prisma.lead.findFirst())?.etapaOperacional).toBe("em_atendimento");
    expect(c.chamadasIA[0].sistema).toContain("Residencial Teste");
    expect(c.chamadasIA[0].sistema).toContain("Nunca prometa");
  });

  it("cliente pede aprovação e taxa; a IA simulada promete → nada disso sai, vai para humano", async () => {
    c.ia("Sim, seu financiamento está aprovado! A taxa é de 7% ao ano.");
    await cliente("Eu vou ser aprovado? Qual a taxa?");
    expect(c.envios.some(e => /aprovad|7%/i.test(e.texto))).toBe(false);
    expect(await estado()).toMatchObject({ statusAtendimento: "em_atendimento_humano", statusAnalise: "nao_enviado", motivoTransferencia: "resposta_bloqueada" });
    expect(await c.prisma.centralVendasEvento.count({ where: { tipo: "resposta_ia_bloqueada" } })).toBe(1);
    expect(c.envios.at(-1)!.texto).toMatch(/vou passar seu atendimento/i);
  });

  it("condição cadastrada pode ser citada; inventada, não", async () => {
    c.ia("As parcelas do Residencial Teste começam em R$ 650,00, conforme análise.");
    await cliente("Quanto fica a parcela?");
    expect(c.envios.at(-1)!.texto).toContain("R$ 650,00");
    expect((await estado()).statusAtendimento).toBe("em_atendimento_ia");
  });

  it.each([
    ["Quero falar com um atendente", "pedido_cliente"],
    ["Que absurdo esse atendimento, péssimo", "reclamacao"],
    ["Vou entrar com processo judicial", "juridico"],
    ["Consegue baixar o preço? Quero negociar", "negociacao_valor"],
  ])("gatilho no texto do cliente (%s) → humano sem chamar a IA", async (texto, motivo) => {
    const chamadas = c.chamadasIA.length;
    await cliente(texto);
    // A IA não é chamada para responder; só para gerar o resumo ao atendente.
    expect(c.chamadasIA.slice(chamadas).map(p => p.sistema.slice(0, 7))).toEqual(["Resuma "]);
    expect(await estado()).toMatchObject({ statusAtendimento: "em_atendimento_humano", motivoTransferencia: motivo });
    const cv = (await c.prisma.centralVendasLead.findFirst())!;
    expect(cv.resumoTransferencia).toBeTruthy();
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "precisa de você" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: cv.operadorId }]);
    // Já em atendimento humano: a IA não responde mais.
    await cliente("Alô?");
    expect(c.chamadasIA.length).toBe(chamadas + 1); // só o resumo da transferência usou a IA
  });

  it("confiança abaixo do limiar → humano", async () => {
    c.respostasIA.push(JSON.stringify({ resposta: "Não sei bem.", confianca: 0.3, transferir: false, campos: {} }));
    await cliente("Quero saber de um terreno na praia");
    expect(await estado()).toMatchObject({ motivoTransferencia: "baixa_confianca" });
  });

  it("três mensagens seguidas sem progresso → humano", async () => {
    for (let i = 0; i < 2; i++) { c.ia("Pode me dizer sua cidade?"); await cliente("hum"); }
    expect((await estado()).statusAtendimento).toBe("em_atendimento_ia");
    c.ia("Pode me dizer sua cidade?");
    await cliente("hum");
    expect(await estado()).toMatchObject({ statusAtendimento: "em_atendimento_humano", motivoTransferencia: "sem_progresso" });
  });

  it("a IA pede transferência no JSON → humano", async () => {
    c.ia("Vou chamar um consultor.", {}, { transferir: true });
    await cliente("É uma situação complicada com meu nome no SPC");
    expect(await estado()).toMatchObject({ motivoTransferencia: "modelo" });
  });
});

describe("custo e falhas da IA", () => {
  it("limite mensal de tokens: a IA para, tudo vai para humano e o admin é avisado uma vez", async () => {
    await montar({ limiteMensalTokens: 100 });
    c.ia("Olá! Posso usar seus dados (LGPD)?");
    await cliente("Olá [ref:teste]"); // consome 150 tokens (simulado)
    expect(await c.prisma.centralVendasTokensMes.findMany({ select: { tokens: true } })).toEqual([{ tokens: 150 }]);
    expect(await c.prisma.centralVendasLead.findMany({ select: { tokensConsumidos: true } })).toEqual([{ tokensConsumidos: 150 }]);
    const chamadas = c.chamadasIA.length;
    await cliente("SIM");
    expect(c.chamadasIA.length).toBe(chamadas);
    expect(await estado()).toMatchObject({ statusAtendimento: "em_atendimento_humano", motivoTransferencia: "limite_tokens" });
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "limite de tokens" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.admin }]);
  });

  it("falha da IA fica na fila e é reprocessada com backoff, sem responder duas vezes", async () => {
    await montar();
    c.respostasIA.push(new Error("Anthropic fora do ar (simulado)"));
    await cliente("Olá [ref:teste]");
    expect(await c.prisma.centralVendasFila.findMany({ select: { tipo: true, status: true, tentativas: true } })).toEqual([{ tipo: "ia", status: "pendente", tentativas: 1 }]);
    expect(c.envios).toHaveLength(0);
    await processarFila(); // ainda no prazo do backoff: nada acontece
    expect(c.envios).toHaveLength(0);
    c.avancar(2);
    c.ia("Olá! Posso usar seus dados (LGPD)?");
    await processarFila();
    await processarFila();
    expect(c.envios).toHaveLength(1);
    expect(await c.prisma.centralVendasFila.findMany({ orderBy: { id: "asc" }, select: { tipo: true, status: true } })).toEqual([{ tipo: "ia", status: "concluido" }, { tipo: "mensagem", status: "concluido" }]);
  });
});
