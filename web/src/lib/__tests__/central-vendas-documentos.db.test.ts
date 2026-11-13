// Central de Vendas (paridade com a Prospecta, 13/11; gêmeo de Prospecta/server/central-vendas-documentos.test.ts) —
// etapa 6: checklist editável, lista de pendentes, classificação das mídias (só metadados), lembretes D+N e o
// encaminhamento automático para análise, exatamente uma vez. O documento entra no checklist do CRM.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", async () => { const { harness } = await import("./fixtures/central-vendas-harness"); return { get prisma() { return harness.prisma; } }; });
vi.mock("@/lib/whatsapp/midia", async () => ({ baixarEGuardarMidia: (await import("./fixtures/central-vendas-mocks")).baixarEGuardarMidiaSimulada }));
process.env.AUTH_SECRET ||= "segredo-de-teste";
delete process.env.ANTHROPIC_API_KEY;

import { aviso, criarBanco, montarCenario, NUMERO_TESTE, U, type Banco, type Cenario } from "./fixtures/central-vendas";
import { definirDependencias } from "@/lib/central-vendas/base";
import { agendarLembretes, verificarDocumentacao } from "@/lib/central-vendas/documentos";
import { processarFila } from "@/lib/central-vendas/envio";
import { processarEventoEvolution } from "@/lib/whatsapp/webhook-evolution";
import { classificarPorNome } from "@/lib/central-vendas/regras";

let b: Banco;
let c: Cenario;
let seq = 0;
beforeAll(async () => { b = await criarBanco(); }, 60_000);
afterAll(async () => { definirDependencias(); await b?.fechar(); });
const cliente = async (texto: string) => { c.avancar(0.01); return processarEventoEvolution(aviso(`T${++seq}`, NUMERO_TESTE, texto)); };
const arquivo = (nome: string, legenda = "", id = `D${++seq}`) => processarEventoEvolution(aviso(id, NUMERO_TESTE, "", {
  message: { documentMessage: { fileName: nome, mimetype: "application/pdf", fileLength: 1200, caption: legenda } },
}));
const ITENS = [
  { chave: "rg", nome: "RG ou CNH", tipo: "rg", obrigatorio: true },
  { chave: "renda", nome: "Comprovante de renda", tipo: "income_proof_formal", obrigatorio: true },
  { chave: "residencia", nome: "Comprovante de residência", tipo: "address_proof", obrigatorio: true },
  { chave: "certidao", nome: "Certidão de casamento", tipo: "birth_marriage_certificate", obrigatorio: false },
];
const QUALIFICADO = { lgpdConsentimento: true, nome: "Ana Souza", cidade: "Imperatriz", renda: 3200, tipoRenda: "formal", fgts: 0, estadoCivil: "solteiro", composicaoRenda: false, produto: "teste" };

async function qualificar(config = {}) {
  c = await montarCenario(b, { config });
  await c.prisma.centralVendasChecklist.create({ data: { slug: "mcmv", nome: "MCMV", documentos: JSON.stringify(ITENS) } });
  await c.prisma.centralVendasProduto.create({ data: { slug: "teste", nome: "Residencial Teste", checklistId: 1 } });
  c.ia("Olá! Posso usar seus dados (LGPD)?");
  await cliente("Olá [ref:teste]");
  c.ia("Perfeito, Ana! Já tenho tudo.", QUALIFICADO);
  await cliente("Sim. Ana Souza, Imperatriz, 3200 de carteira assinada, sem FGTS, solteira, sem composição, quero o Residencial Teste");
}
const cv = async () => {
  const r = (await c.prisma.centralVendasLead.findFirst())!;
  return { statusDocumental: r.statusDocumental, statusAnalise: r.statusAnalise, qualificado: Boolean(r.qualificadoEm) };
};

describe("classificação por metadados", () => {
  it("usa nome do item, chave e sinônimos (nunca o conteúdo do arquivo)", () => {
    expect(classificarPorNome("holerite_outubro.pdf", ITENS)).toEqual({ chave: "renda", confianca: 0.8 });
    expect(classificarPorNome("Comprovante de residência - conta de luz.jpg", ITENS)).toEqual({ chave: "residencia", confianca: 0.9 });
    expect(classificarPorNome("cnh-digital.pdf", ITENS)).toEqual({ chave: "rg", confianca: 0.8 });
    expect(classificarPorNome("IMG_2033.jpg", ITENS)).toBeNull();
  });
});

describe("fluxo de documentos", () => {
  beforeEach(() => qualificar());

  it("qualificação completa → envia a lista de pendentes do checklist do produto", async () => {
    expect(await cv()).toMatchObject({ qualificado: true, statusDocumental: "aguardando_documentos" });
    expect(c.envios.at(-1)!.texto).toBe("Ana, para seguirmos, envie por aqui foto ou PDF destes documentos: RG ou CNH, Comprovante de renda e Comprovante de residência.");
    expect((await c.prisma.lead.findFirst())?.temperatura).toBe("morno");
    expect(await c.prisma.centralVendasLead.findFirst({ select: { renda: true, tipoRenda: true, estadoCivil: true, composicaoRenda: true } }))
      .toMatchObject({ tipoRenda: "formal", estadoCivil: "solteiro", composicaoRenda: false });
  });

  it("classifica cada mídia, vincula ao checklist do CRM, marca 'a conferir' sem parar e encaminha uma única vez", async () => {
    await arquivo("RG-frente.pdf");
    expect(await cv()).toMatchObject({ statusDocumental: "parcial" });
    await arquivo("holerite.pdf");
    // Sem pista no nome: a IA classifica só pelos metadados, com baixa confiança → "a conferir", conta mesmo assim.
    c.respostasIA.push(JSON.stringify({ chave: "residencia", confianca: 0.4 }));
    await arquivo("IMG_2033.pdf", "", "ULTIMO");
    expect(c.chamadasIA.at(-1)!.mensagens[0].content).toBe("Arquivo: IMG_2033.pdf; tipo: application/pdf; legenda: (sem legenda)");
    const docs = await c.prisma.documentoCliente.findMany({ where: { arquivoId: { not: null } }, orderBy: { enviadoEm: "asc" }, select: { tipo: true, arquivoId: true } });
    expect(docs.map(d => d.tipo).sort()).toEqual(["address_proof", "income_proof_formal", "rg"]);
    expect(await c.prisma.arquivo.count()).toBe(3);
    expect(await c.prisma.documentoClienteVersao.count()).toBe(3);
    expect(await c.prisma.centralVendasDocumento.findMany({ orderBy: { id: "asc" }, select: { chave: true, aConferir: true } })).toEqual([
      { chave: "rg", aConferir: false }, { chave: "renda", aConferir: false }, { chave: "residencia", aConferir: true },
    ]);
    expect(await cv()).toMatchObject({ statusDocumental: "completo", statusAnalise: "em_analise" });
    // Repetições: aviso repetido do último arquivo, nova verificação e outro arquivo depois → nada se repete.
    await arquivo("IMG_2033.pdf", "", "ULTIMO");
    await verificarDocumentacao((await c.lead())!);
    await arquivo("certidao-casamento.pdf");
    expect(await c.prisma.tarefaCrm.findMany({ select: { titulo: true, responsavelId: true, leadId: true } })).toEqual([
      { titulo: "Análise — Ana Souza", responsavelId: U.ana, leadId: await c.lead() },
    ]);
    expect(c.envios.filter(e => e.texto.includes("encaminhado para análise"))).toHaveLength(1);
    expect(await c.prisma.centralVendasEvento.count({ where: { tipo: "encaminhado_analise" } })).toBe(1);
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "para análise" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.ana }]);
  });

  it("documento excluído pela equipe deixa de contar", async () => {
    await arquivo("RG-frente.pdf");
    const d = (await c.prisma.centralVendasDocumento.findFirst())!;
    await c.prisma.documentoClienteVersao.deleteMany({ where: { arquivoId: d.arquivoId } });
    await c.prisma.documentoCliente.updateMany({ where: { arquivoId: d.arquivoId }, data: { arquivoId: null } });
    await c.prisma.arquivo.delete({ where: { id: d.arquivoId } });
    await arquivo("holerite.pdf");
    await arquivo("comprovante de residencia.pdf");
    expect(await cv()).toMatchObject({ statusDocumental: "parcial", statusAnalise: "nao_enviado" });
  });

  it("lembretes D+1, D+3 e D+7 pelo cron, um de cada, com os pendentes atuais", async () => {
    await arquivo("RG-frente.pdf");
    expect(await agendarLembretes()).toBe(0);
    c.avancar(24 * 60);
    expect(await agendarLembretes()).toBe(1);
    expect(await agendarLembretes()).toBe(0);
    await processarFila();
    expect(c.envios.at(-1)!.texto).toBe("Olá, Ana! Ainda faltam estes documentos para seguirmos: Comprovante de renda e Comprovante de residência. Pode enviar por aqui mesmo.");
    c.avancar(2 * 24 * 60);
    expect(await agendarLembretes()).toBe(1);
    c.avancar(4 * 24 * 60);
    expect(await agendarLembretes()).toBe(1);
    c.avancar(30 * 24 * 60);
    expect(await agendarLembretes()).toBe(0);
  });
});

describe("sem checklist ou com a automação desligada", () => {
  it("sem checklist: registra e avisa o operador, sem inventar documentos", async () => {
    c = await montarCenario(b);
    await c.prisma.centralVendasProduto.create({ data: { slug: "teste", nome: "Residencial Teste" } });
    c.ia("Olá!");
    await cliente("Olá [ref:teste]");
    c.ia("Obrigada!", QUALIFICADO);
    await cliente("dados");
    expect(await c.prisma.centralVendasEvento.count({ where: { tipo: "sem_checklist" } })).toBe(1);
    expect(await c.prisma.notificacao.findMany({ where: { titulo: { contains: "sem checklist" } }, select: { usuarioId: true } })).toEqual([{ usuarioId: U.olga }]);
    expect(c.envios.some(e => e.texto.includes("documentos"))).toBe(false);
  });

  it("automação de documentos desligada: não envia a lista", async () => {
    await qualificar({ automacoes: { ia: true, documentos: false, lembretes: true, followup: true, reativacao: true } });
    expect(await cv()).toMatchObject({ qualificado: true, statusDocumental: "nao_iniciado" });
  });
});
