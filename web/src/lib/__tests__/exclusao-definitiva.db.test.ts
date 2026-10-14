// Item 03 — teste de integração com Postgres real (rode com TEST_DATABASE_URL).
// Confere que Excluir remove de verdade (com os lançamentos, pedido A6) e preserva o lead.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("exclusão definitiva com banco real (item 03)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let excluir: typeof import("@/lib/crm/excluir-servico").excluirServicoDefinitivo;
  let leadId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ excluirServicoDefinitivo: excluir } = await import("@/lib/crm/excluir-servico"));
    leadId = (await prisma.lead.create({ data: { nome: "Teste Exclusão", telefone: "0000", servico: "construcao" } })).id;
  });
  afterAll(async () => {
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  async function servico(modulo: string) {
    return prisma.servicoLead.create({ data: { leadId, modulo, servico: modulo, requestKey: `teste:${modulo}:${Math.random()}` } });
  }

  it("obra sem financeiro: some de vez, com etapas, fotos e vínculo; o lead fica", async () => {
    const s = await servico("obras");
    const obra = await prisma.obra.create({ data: { nome: "Obra X", clienteNome: "C", clienteTel: "1", leadId, servicoLeadId: s.id, etapas: { create: [{ nome: "Fundação" }] } } });
    const arquivo = await prisma.arquivo.create({ data: { nome: "f.jpg", mime: "image/jpeg", tamanho: 1, dados: Buffer.from([1]) } });
    await prisma.obraFoto.create({ data: { obraId: obra.id, arquivoId: arquivo.id, tiradaEm: new Date() } });

    expect(await excluir("obra", obra.id)).toEqual({ excluido: true });
    expect(await prisma.obra.findUnique({ where: { id: obra.id } })).toBeNull();
    expect(await prisma.obraEtapa.count({ where: { obraId: obra.id } })).toBe(0);
    expect(await prisma.arquivo.findUnique({ where: { id: arquivo.id } })).toBeNull();
    expect(await prisma.servicoLead.findUnique({ where: { id: s.id } })).toBeNull();
    expect(await prisma.lead.findUnique({ where: { id: leadId } })).not.toBeNull();
    // idempotente: excluir de novo não é erro
    expect(await excluir("obra", obra.id)).toEqual({ excluido: false });
  });

  it("pedido A6: obra com movimentos (e histórico), comissão e aporte some com tudo", async () => {
    const obra = await prisma.obra.create({ data: { nome: "Obra Y", clienteNome: "C", clienteTel: "1" } });
    const mov = await prisma.obraMovimento.create({ data: { obraId: obra.id, natureza: "entrada", descricao: "Entrada do cliente", valor: "100.00", data: new Date(), origem: "manual" } });
    expect(await prisma.obraMovimentoHistorico.count({ where: { movimentoId: mov.id } })).toBe(1);
    await prisma.comissao.create({ data: { imovel: "Y", valor: 10, vencimento: new Date(), status: "paga", tipoNegocio: "obra", negocioId: obra.id } });
    const inv = await prisma.investidor.create({ data: { nome: "Inv A6" } });
    await prisma.obraInvestidor.create({ data: { obraId: obra.id, investidorId: inv.id, percentual: "10" } });
    expect(await excluir("obra", obra.id)).toEqual({ excluido: true });
    expect(await prisma.obra.findUnique({ where: { id: obra.id } })).toBeNull();
    expect(await prisma.obraMovimento.count({ where: { obraId: obra.id } })).toBe(0);
    expect(await prisma.obraMovimentoHistorico.count({ where: { movimentoId: mov.id } })).toBe(0);
    expect(await prisma.comissao.count({ where: { tipoNegocio: "obra", negocioId: obra.id } })).toBe(0);
    expect(await prisma.obraInvestidor.count({ where: { obraId: obra.id } })).toBe(0);
    await prisma.investidor.delete({ where: { id: inv.id } });
  });

  it("pedido A6: movimento e recebimento podem ser apagados direto no banco (gatilho não bloqueia)", async () => {
    const obra = await prisma.obra.create({ data: { nome: "Obra Z", clienteNome: "C", clienteTel: "1" } });
    const mov = await prisma.obraMovimento.create({ data: { obraId: obra.id, natureza: "entrada", descricao: "x", valor: "5.00", data: new Date(), origem: "manual" } });
    await prisma.obraMovimento.delete({ where: { id: mov.id } });
    expect(await prisma.obraMovimentoHistorico.count({ where: { movimentoId: mov.id } })).toBe(0);
    const reg = await prisma.regularizacao.create({ data: { nome: "Reg R", clienteNome: "C", clienteTel: "1" } });
    const item = await prisma.regularizacaoItemFinanceiro.findFirstOrThrow({ where: { regularizacaoId: reg.id } });
    const rec = await prisma.regularizacaoRecebimento.create({ data: { regularizacaoId: reg.id, itemId: item.id, valor: "7.00", data: new Date(), origem: "manual" } });
    await prisma.regularizacaoRecebimento.delete({ where: { id: rec.id } });
    expect(await prisma.regularizacaoRecebimentoHistorico.count({ where: { recebimentoId: rec.id } })).toBe(0);
    await excluir("obra", obra.id);
    await excluir("regularizacao", reg.id);
  });

  it("regularização sem recebimentos: some com etapas e itens financeiros semeados", async () => {
    const reg = await prisma.regularizacao.create({ data: { nome: "Reg X", clienteNome: "C", clienteTel: "1" } });
    expect(await prisma.regularizacaoItemFinanceiro.count({ where: { regularizacaoId: reg.id } })).toBe(17);
    expect(await excluir("regularizacao", reg.id)).toEqual({ excluido: true });
    expect(await prisma.regularizacaoItemFinanceiro.count({ where: { regularizacaoId: reg.id } })).toBe(0);
  });

  it("financiamento com comissão: some junto com a comissão e o checklist", async () => {
    const fin = await prisma.financiamento.create({ data: { clienteNome: "C", clienteTel: "1", tipo: "mcmv" } });
    await prisma.comissao.create({ data: { imovel: "F", valor: 10, vencimento: new Date(), tipoNegocio: "financiamento", negocioId: fin.id } });
    expect(await excluir("financiamento", fin.id)).toEqual({ excluido: true });
    expect(await prisma.comissao.count({ where: { tipoNegocio: "financiamento", negocioId: fin.id } })).toBe(0);
  });

  it("regularização com recebimento: some com itens e recebimentos", async () => {
    const reg = await prisma.regularizacao.create({ data: { nome: "Reg Q", clienteNome: "C", clienteTel: "1" } });
    const item = await prisma.regularizacaoItemFinanceiro.findFirstOrThrow({ where: { regularizacaoId: reg.id } });
    await prisma.regularizacaoRecebimento.create({ data: { regularizacaoId: reg.id, itemId: item.id, valor: "7.00", data: new Date(), origem: "manual" } });
    expect(await excluir("regularizacao", reg.id)).toEqual({ excluido: true });
    expect(await prisma.regularizacaoRecebimento.count({ where: { regularizacaoId: reg.id } })).toBe(0);
  });

  it("comissão paga também é excluída", async () => {
    const paga = await prisma.comissao.create({ data: { imovel: "A", valor: 10, vencimento: new Date(), status: "paga" } });
    expect(await excluir("comissao", paga.id)).toEqual({ excluido: true });
  });

});
