// Lote 23/10, etapa 6: "Duplicar lead" — novo ID, dados e documentos (mesmo arquivo),
// sem serviços/processos/solicitações/histórico, atômico e com origem registrada (banco real).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("duplicar lead (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let dup: typeof import("@/lib/crm/lead-duplicar-db").duplicarLeadNoBanco;
  const leads: string[] = [];
  const arquivos: string[] = [];
  let ator: { id: string; nome: string };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ duplicarLeadNoBanco: dup } = await import("@/lib/crm/lead-duplicar-db"));
    const u = await prisma.usuario.create({ data: { nome: "Ana Dup", email: `dup-${Date.now()}@teste.local`, senha: "x", papel: "admin" } });
    ator = { id: u.id, nome: u.nome };
  });
  afterAll(async () => {
    const todos = await prisma.lead.findMany({ where: { OR: [{ id: { in: leads } }, { duplicadoDeId: { in: leads } }] }, select: { id: true } });
    const ids = todos.map((l) => l.id);
    await prisma.documentoCliente.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.interacao.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.financiamento.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { duplicadoDeId: null } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    await prisma.arquivo.deleteMany({ where: { id: { in: arquivos } } });
    await prisma.usuario.deleteMany({ where: { id: ator.id } });
    await prisma.$disconnect();
  });

  it("copia dados e documentos, não copia serviços/solicitações/senha e registra origem", async () => {
    const o = await prisma.lead.create({ data: { nome: "Maria Dup", telefone: "9", email: "m@x", cpf: "111", servico: '["Financiamento MCMV"]', status: "negociacao", etapaOperacional: "em_execucao", senhaAcesso: "hash", notas: "obs", temperatura: "quente" } });
    leads.push(o.id);
    await prisma.financiamento.create({ data: { leadId: o.id, clienteNome: "Maria", clienteTel: "9", tipo: "mcmv" } });
    const arq = await prisma.arquivo.create({ data: { nome: "rg.pdf", mime: "application/pdf", tamanho: 4, dados: Buffer.from("%PDF") } });
    arquivos.push(arq.id);
    await prisma.documentoCliente.createMany({ data: [
      { leadId: o.id, tipo: "rg", arquivoId: arq.id, enviadoEm: new Date(), solicitadoEm: new Date(), emailSolicitadoEm: new Date(), visivelCliente: false },
      { leadId: o.id, tipo: "cpf", solicitadoEm: new Date() },
    ] });

    const r = await prisma.$transaction((tx) => dup(tx, o.id, ator));
    expect(r.documentos).toBe(1);
    expect(r.id).not.toBe(o.id);
    const n = await prisma.lead.findUniqueOrThrow({ where: { id: r.id }, include: { financiamentos: true, servicosOperacionais: true, interacoes: true } });
    expect(n).toMatchObject({ nome: "Maria Dup", telefone: "9", cpf: "111", notas: "obs", temperatura: "quente", servico: "[]", status: "novo", etapaOperacional: null, senhaAcesso: null, duplicadoDeId: o.id, duplicadoPorId: ator.id });
    expect(n.financiamentos).toHaveLength(0);
    expect(n.servicosOperacionais).toHaveLength(0);
    expect(n.interacoes.map((i) => i.descricao)).toEqual([expect.stringContaining(`duplicação do lead nº ${o.id}`)]);
    const docs = await prisma.documentoCliente.findMany({ where: { leadId: r.id }, orderBy: { tipo: "asc" } });
    expect(docs).toHaveLength(2);
    const rg = docs.find((d) => d.tipo === "rg")!;
    expect(rg).toMatchObject({ arquivoId: arq.id, visivelCliente: false, solicitadoEm: null, emailSolicitadoEm: null });
    expect(rg.copiadoDeId).toBeTruthy();
    expect(docs.find((d) => d.tipo === "cpf")).toMatchObject({ arquivoId: null, solicitadoEm: null });
    expect(await prisma.interacao.count({ where: { leadId: o.id, descricao: { contains: "Lead duplicado" } } })).toBe(1);

    // Trocar/remover o documento no lead novo não mexe no original nem no arquivo.
    await prisma.documentoCliente.update({ where: { id: rg.id }, data: { arquivoId: null } });
    expect((await prisma.documentoCliente.findFirstOrThrow({ where: { leadId: o.id, tipo: "rg" } })).arquivoId).toBe(arq.id);
    expect(await prisma.arquivo.count({ where: { id: arq.id } })).toBe(1);
  });

  it("atômico: falha no meio não deixa lead parcial", async () => {
    const o = await prisma.lead.create({ data: { nome: "Atomico", telefone: "1", servico: "[]" } });
    leads.push(o.id);
    const antes = await prisma.lead.count();
    await expect(prisma.$transaction(async (tx) => { await dup(tx, o.id, ator); throw new Error("falha simulada"); })).rejects.toThrow("falha simulada");
    expect(await prisma.lead.count()).toBe(antes);
  });

  it("lead excluído não é duplicado", async () => {
    const o = await prisma.lead.create({ data: { nome: "Excluido", telefone: "1", servico: "[]", excluidoEm: new Date() } });
    leads.push(o.id);
    await expect(prisma.$transaction((tx) => dup(tx, o.id, ator))).rejects.toThrow("Lead não encontrado ou excluído.");
  });
});
