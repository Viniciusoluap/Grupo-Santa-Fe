// Pedido de 25/10: templates preenchidos, endereço da Evolution e conversas. Nada externo é chamado.
// Mesmos cenários de Prospecta/server/whatsapp-conversas.test.ts + regras próprias do Santa Fé.
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AUTH_SECRET ||= "segredo-de-teste";

import { limparExtras, listaPorExtenso, preencherTemplate, primeiroNome, textosPorDestinatario, variaveisDoTexto } from "@/lib/whatsapp/variaveis";
import { montarValoresLead } from "@/lib/whatsapp/valores-lead-regra";
import { mesmoTelefone, normalizarUrlEvolution, registrarWebhookEvolution, testarEvolution, textoDaMensagem } from "@/lib/evolution";
import { normalizarStatusEvolution, segredoWebhookEvolution, webhookEvolutionAutorizado } from "@/lib/whatsapp/webhook-evolution";

const resposta = (corpo: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => corpo } as Response);

describe("variáveis do template", () => {
  it("preenche por destinatário e aponta o que falta", () => {
    const t = "Olá {{nome}}, sobre {{servico}} com {{ corretor }}. {{horario}}";
    expect(variaveisDoTexto(t)).toEqual(["nome", "servico", "corretor", "horario"]);
    const r = preencherTemplate(t, { nome: "Ana", servico: "Construção e Financiamento", corretor: "Paulo" });
    expect(r.texto).toBe("Olá Ana, sobre Construção e Financiamento com Paulo. {{horario}}");
    expect(r.faltando).toEqual(["horario"]);
    expect(preencherTemplate(t, { nome: "Ana", servico: "x", corretor: "y", horario: "10h" }).faltando).toEqual([]);
  });
  it("primeiro nome e lista por extenso", () => {
    expect(primeiroNome("  Maria  das Dores ")).toBe("Maria");
    expect(listaPorExtenso(["Construção", "Financiamento", "Construção", "Projeto"])).toBe("Construção, Financiamento e Projeto");
    expect(listaPorExtenso([])).toBe("");
  });
  it("bloqueia o envio quando sobra {{…}} e usa os campos da tela", () => {
    const valores = new Map([["a", { nome: "Ana" }], ["b", { nome: "Bia" }]]);
    const sem = textosPorDestinatario("Oi {{nome}}, às {{horario}}", ["a", "b"], valores, limparExtras({ horario: "  ", x: 1 }));
    expect(sem.erro).toBe("Preencha {{horario}} antes de enviar (2 destinatário(s) sem esse dado).");
    const com = textosPorDestinatario("Oi {{nome}}, às {{horario}}", ["a", "b"], valores, limparExtras({ Horario: " 10h " }));
    expect(com.erro).toBeNull();
    expect(com.textos.get("b")).toBe("Oi Bia, às 10h");
  });
  it("valores do lead do Santa Fé (serviços legíveis, corretor, imóvel, banco, endereço)", () => {
    const v = montarValoresLead({
      nome: "Maria Souza", servicos: ["Financiamento MCMV", "Obra e reforma"], corretor: null, imovelFinanciamento: null,
      imovelInteresse: "Casa Jardim", banco: "Caixa Econômica Federal", enderecoImovel: { rua: "Rua A, 10", bairro: "Centro" }, enderecoObra: "Obra X",
    }, "Paulo");
    expect(v).toEqual({ nome: "Maria", servico: "Financiamento MCMV e Obra e reforma", corretor: "Paulo", imovel: "Casa Jardim", banco: "Caixa Econômica Federal", endereco: "Rua A, 10, Centro" });
    expect(montarValoresLead({ nome: "Jo", servicos: [], corretor: "Ana", imovelFinanciamento: null, imovelInteresse: null, banco: null, enderecoImovel: null, enderecoObra: "Rua B" }, null).endereco).toBe("Rua B");
  });
});

describe("Evolution", () => {
  it("endereço sempre https e sem /manager (http fazia o POST virar GET → 404)", () => {
    expect(normalizarUrlEvolution("http://evo.up.railway.app/manager")).toBe("https://evo.up.railway.app");
    expect(normalizarUrlEvolution("evo.up.railway.app/")).toBe("https://evo.up.railway.app");
    expect(normalizarUrlEvolution("https://evo.up.railway.app")).toBe("https://evo.up.railway.app");
  });
  it("teste do servidor exige a lista de instâncias (JSON) e mostra o motivo do erro", async () => {
    await expect(testarEvolution({ url: "evo.app", apiKey: "k" }, (() => resposta([])) as never)).resolves.toBeUndefined();
    await expect(testarEvolution({ url: "evo.app/manager", apiKey: "k" }, (() => resposta({ ok: 1 })) as never)).rejects.toThrow("não é a API da Evolution");
    await expect(testarEvolution({ url: "evo.app", apiKey: "k" }, (() => resposta({ response: { message: [["Cannot GET"]] } }, 404)) as never))
      .rejects.toThrow("A Evolution respondeu com erro (HTTP 404): Cannot GET.");
  });
  it("registra o webhook com cabeçalho secreto e eventos de mensagem", async () => {
    const f = vi.fn((url: string, init?: RequestInit) => {
      expect(url).toBe("https://evo.app/webhook/set/inst1");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body)).webhook).toMatchObject({
        enabled: true, url: "https://site/api/whatsapp/evolution-webhook", headers: { "x-webhook-token": "seg" },
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
      });
      return resposta({});
    });
    await registrarWebhookEvolution({ url: "http://evo.app/manager", apiKey: "k" }, "inst1", "https://site/api/whatsapp/evolution-webhook", "seg", f as never);
    expect(f).toHaveBeenCalledOnce();
    await expect(registrarWebhookEvolution({ url: "evo.app", apiKey: "k" }, "i", "u", "s", (() => resposta({ message: "bad" }, 400)) as never))
      .rejects.toThrow("(HTTP 400): bad.");
  });
  it("texto de mensagens recebidas e comparação de telefone (com/sem 9º dígito)", () => {
    expect(textoDaMensagem({ conversation: "Oi" })).toBe("Oi");
    expect(textoDaMensagem({ extendedTextMessage: { text: "Tudo bem?" } })).toBe("Tudo bem?");
    expect(textoDaMensagem({ imageMessage: { caption: "planta" } })).toBe("[imagem] planta");
    expect(textoDaMensagem({ audioMessage: {} })).toBe("[áudio]");
    expect(mesmoTelefone("(94) 99304-4689", "559493044689")).toBe(true);
    expect(mesmoTelefone("94 99304-4689", "5594993044689")).toBe(true);
    expect(mesmoTelefone("94 99304-4689", "5594993044680")).toBe(false);
  });
  it("webhook: segredo HMAC do AUTH_SECRET e status de entrega/leitura", () => {
    const esperado = createHmac("sha256", process.env.AUTH_SECRET!).update("evolution-webhook").digest("hex");
    expect(segredoWebhookEvolution()).toBe(esperado);
    expect(webhookEvolutionAutorizado(esperado)).toBe(true);
    expect(webhookEvolutionAutorizado("errado")).toBe(false);
    expect(webhookEvolutionAutorizado(null)).toBe(false);
    expect(normalizarStatusEvolution("DELIVERY_ACK")).toBe("entregue");
    expect(normalizarStatusEvolution("READ")).toBe("lida");
    expect(normalizarStatusEvolution("SERVER_ACK")).toBe("enviada");
  });
});
