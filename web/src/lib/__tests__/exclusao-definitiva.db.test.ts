// Item 03 — teste de integração com Postgres real (rode com TEST_DATABASE_URL).
// Confere que Excluir remove de verdade, preserva o lead e respeita a guarda financeira.
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

  it("obra com movimento financeiro: recusa e explica; nada é apagado", async () => {
    const obra = await prisma.obra.create({ data: { nome: "Obra Y", clienteNome: "C", clienteTel: "1" } });
    await prisma.obraMovimento.create({ data: { obraId: obra.id, natureza: "entrada", descricao: "Entrada do cliente", valor: "100.00", data: new Date(), origem: "manual" } });
    await expect(excluir("obra", obra.id)).rejects.toThrow(/1 movimento financeiro.*Cancelar/);
    expect(await prisma.obra.findUnique({ where: { id: obra.id } })).not.toBeNull();
  });

  it("regularização sem recebimentos: some com etapas e itens financeiros semeados", async () => {
    const reg = await prisma.regularizacao.create({ data: { nome: "Reg X", clienteNome: "C", clienteTel: "1" } });
    expect(await prisma.regularizacaoItemFinanceiro.count({ where: { regularizacaoId: reg.id } })).toBe(17);
    expect(await excluir("regularizacao", reg.id)).toEqual({ excluido: true });
    expect(await prisma.regularizacaoItemFinanceiro.count({ where: { regularizacaoId: reg.id } })).toBe(0);
  });

  it("financiamento com comissão: recusa; sem comissão: exclui com checklist", async () => {
    const fin = await prisma.financiamento.create({ data: { clienteNome: "C", clienteTel: "1", tipo: "mcmv" } });
    const com = await prisma.comissao.create({ data: { imovel: "F", valor: 10, vencimento: new Date(), tipoNegocio: "financiamento", negocioId: fin.id } });
    await expect(excluir("financiamento", fin.id)).rejects.toThrow(/1 comissão/);
    await prisma.comissao.delete({ where: { id: com.id } });
    expect(await excluir("financiamento", fin.id)).toEqual({ excluido: true });
  });

  it("comissão paga não é excluída; pendente é", async () => {
    const paga = await prisma.comissao.create({ data: { imovel: "A", valor: 10, vencimento: new Date(), status: "paga" } });
    await expect(excluir("comissao", paga.id)).rejects.toThrow(/pagamento já efetuado/);
    await prisma.comissao.delete({ where: { id: paga.id } });
    const pendente = await prisma.comissao.create({ data: { imovel: "B", valor: 10, vencimento: new Date() } });
    expect(await excluir("comissao", pendente.id)).toEqual({ excluido: true });
  });

});
