// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-e2e.test.ts) —
// etapa 11: critério de pronto ponta a ponta, em modo de teste, com o webhook real da Evolution, banco em memória e
// IA/envio simulados. Nenhuma ação manual além da configuração inicial e da decisão do analista.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;
const sessao = vi.hoisted(() => ({ atual: null as null | { user: { id: string; role: string; permissoes?: string[] } } }));
vi.mock("@/auth", () => ({ auth: async () => sessao.atual }));
const como = (id: string, role: string, permissoes?: string[]) => { sessao.atual = { user: { id, role, ...(permissoes ? { permissoes } : {}) } }; };

import { aviso, criarBanco, montarCenario, NUMERO_TESTE, OUTRO_NUMERO, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { definirDependencias } from "@/lib/central-vendas/base";
import { exigirResultado } from "@/lib/acao-resultado";
import * as acoes from "@/lib/actions/central-vendas";
import { processarEventoEvolution } from "@/lib/whatsapp/webhook-evolution";

let b: Banco;
let c: Cenario;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
const ok = async <T,>(p: Promise<T | { erroAcao: string }>) => exigirResultado(await p);
beforeEach(async () => {
  c = await montarCenario(b);
  // Configuração feita uma vez pelo admin, pela tela (actions): checklist e produto "teste".
  como(U.admin, "admin");
  await ok(acoes.salvarChecklistCentralVendas({ nome: "MCMV", itens: [
    { chave: "rg", nome: "RG ou CNH", tipo: "rg", obrigatorio: true },
    { chave: "renda", nome: "Comprovante de renda", tipo: "income_proof_formal", obrigatorio: true },
    { chave: "residencia", nome: "Comprovante de residência", tipo: "address_proof", obrigatorio: true },
  ], ativo: true }));
  await ok(acoes.salvarProdutoCentralVendas({ nome: "Residencial Teste", slug: "teste", tipo: "empreendimento", cidade: "Imperatriz", descricao: "Casas de 2 quartos.", requisitos: "", condicoes: "", checklistId: 1, ativo: true }));
});

let seq = 0;
const cliente = async (texto: string, numero = NUMERO_TESTE) => { c.avancar(0.01); return processarEventoEvolution(aviso(`E${++seq}`, numero, texto)); };
const documento = async (nome: string) => { c.avancar(0.01); return processarEventoEvolution(aviso(`E${++seq}`, NUMERO_TESTE, "", { message: { documentMessage: { fileName: nome, mimetype: "application/pdf", fileLength: 2048 } } })); };

describe("critério de pronto em modo de teste", () => {
  it("'Olá [ref:teste]' → lead, atribuição, IA, qualificação, documentos, análise, decisão e mensagem — tudo no painel e na auditoria", async () => {
    // 1) Número autorizado manda o link da campanha; um número fora da lista não é atendido.
    c.ia("Olá! Sou a assistente do Grupo Santa Fé. Posso usar seus dados só neste atendimento (LGPD)? Responda SIM.");
    await cliente("Olá [ref:teste]");
    await cliente("Olá [ref:teste]", OUTRO_NUMERO);
    expect(await c.prisma.centralVendasLead.findMany({ select: { campanha: true, produtoId: true } })).toEqual([{ campanha: "teste", produtoId: 1 }]);
    expect(await c.prisma.lead.findMany({ select: { telefone: true, origem: true, responsavelId: true } })).toEqual([{ telefone: "99988887777", origem: "whatsapp", responsavelId: U.olga }]);
    const leadId = (await c.lead())!;

    // 2) Consentimento e qualificação pela IA (respostas simuladas).
    c.ia("Obrigada! Qual é o seu nome completo e cidade?", { lgpdConsentimento: true });
    await cliente("SIM");
    c.ia("Perfeito, Ana! Vou te mandar a lista de documentos.", { nome: "Ana Souza", cidade: "Imperatriz", renda: 3200, tipoRenda: "formal", fgts: 5000, estadoCivil: "solteiro", composicaoRenda: false, produto: "teste" });
    await cliente("Ana Souza, Imperatriz, ganho 3200 de carteira assinada, tenho 5 mil de FGTS, solteira, sem composição, quero o Residencial Teste");
    expect(await c.prisma.lead.findUnique({ where: { id: leadId }, select: { nome: true, etapaOperacional: true } })).toEqual({ nome: "Ana Souza", etapaOperacional: "em_atendimento" });
    const q = (await c.prisma.centralVendasLead.findUnique({ where: { leadId } }))!;
    expect({ cidade: q.cidade, renda: q.renda?.toFixed(2), tipoRenda: q.tipoRenda, fgts: q.fgts?.toFixed(2), lgpd: q.lgpdConsentimento })
      .toEqual({ cidade: "Imperatriz", renda: "3200.00", tipoRenda: "formal", fgts: "5000.00", lgpd: true });
    expect(c.envios.at(-1)!.texto).toContain("RG ou CNH, Comprovante de renda e Comprovante de residência");

    // 3) Documentos pelo WhatsApp → encaminhado para análise automaticamente.
    await documento("rg-ana.pdf");
    await documento("holerite-outubro.pdf");
    await documento("conta de luz - comprovante de residencia.pdf");
    expect(await c.prisma.centralVendasLead.findMany({ select: { statusDocumental: true, statusAnalise: true } })).toEqual([{ statusDocumental: "completo", statusAnalise: "em_analise" }]);
    expect(await c.prisma.tarefaCrm.findMany({ select: { responsavelId: true } })).toEqual([{ responsavelId: U.ana }]);
    expect(c.envios.at(-1)!.texto).toContain("encaminhado para análise");

    // 4) Única ação humana: a analista registra a decisão; a mensagem sai sozinha.
    como(U.ana, "colaborador", ["leads"]);
    // Não é a operadora do lead, mas como analista vê o que aguarda decisão e decide.
    expect((await ok(acoes.atendimentosCentralVendas({}))).map(a => ({ leadId: a.leadId, podeDecidir: a.podeDecidir }))).toEqual([{ leadId, podeDecidir: true }]);
    await ok(acoes.registrarDecisaoCentralVendas({ leadId, decisao: "aprovado" }));
    expect(c.envios.at(-1)!.texto).toContain("resultado positivo");
    expect((await c.prisma.lead.findUnique({ where: { id: leadId } }))?.etapaOperacional).toBe("aprovado_follow_up");

    // 5) Nada duplicado, nada para fora da lista de teste.
    expect(c.envios.every(e => e.numero === "5599988887777" || e.numero === "99988887777")).toBe(true);
    expect(await c.prisma.centralVendasFila.count({ where: { status: { not: "concluido" } } })).toBe(0);
    expect(c.envios.map(e => e.texto.slice(0, 25))).toEqual([
      "Olá! Sou a assistente do ", "Obrigada! Qual é o seu no", "Perfeito, Ana! Vou te man", "Ana, para seguirmos, envi",
      "Ana, recebemos todos os d", "Ana, sua análise foi conc",
    ]);

    // 6) Visível no painel e na auditoria.
    como(U.admin, "admin");
    const painel = await ok(acoes.painelCentralVendas({}));
    expect(painel.indicadores).toMatchObject({ recebidos: 1, qualificados: 1, documentacaoCompleta: 1, enviadosAnalise: 1, aprovados: 1, taxaConversao: 100, origens: [{ origem: "whatsapp", total: 1 }] });
    expect(painel.indicadores.tempoPrimeiraRespostaMin).toBe(0);
    const { eventos } = await ok(acoes.auditoriaCentralVendas(leadId));
    expect(eventos.map(e => e.tipo).reverse()).toEqual(expect.arrayContaining([
      "lead_criado", "atribuido", "ia_respondeu", "qualificado", "documentos_solicitados", "documento_recebido", "encaminhado_analise", "analise_aprovado", "mensagem_enviada",
    ]));
    // Auditoria sem dados pessoais (telefone, renda, nome).
    expect(JSON.stringify(eventos)).not.toMatch(/99988887777|3200|Ana Souza/);
    // Os documentos ficaram no checklist de documentos do CRM do lead.
    expect((await c.prisma.documentoCliente.findMany({ where: { leadId, arquivoId: { not: null } }, select: { tipo: true } })).map(d => d.tipo).sort()).toEqual(["address_proof", "income_proof_formal", "rg"]);
  });
});
