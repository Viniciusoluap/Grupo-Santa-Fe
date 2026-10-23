// Lote 23/10, etapa 4: "Concluir" no CRM conclui o registro do módulo pelo ID,
// conferindo o lead, sem apagar dados e sem reabrir cancelados (banco real).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("CRM — concluir serviço conclui o módulo (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let concluir: typeof import("@/lib/crm/conclusao-servico-db").concluirRegistroDoLead;
  const leads: string[] = [];
  let leadA = "";
  let leadB = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ concluirRegistroDoLead: concluir } = await import("@/lib/crm/conclusao-servico-db"));
    const mk = async (nome: string) => (await prisma.lead.create({ data: { nome, telefone: "0", origem: "teste", servico: "[]" } })).id;
    leadA = await mk("Lead Conclusão A"); leadB = await mk("Lead Conclusão B");
    leads.push(leadA, leadB);
  });
  afterAll(async () => {
    await prisma.financiamento.deleteMany({ where: { leadId: { in: leads } } });
    await prisma.lead.deleteMany({ where: { id: { in: leads } } });
    await prisma.$disconnect();
  });

  it("financiamento: vai para Concluído (liberado) mantendo valores e dados", async () => {
    const f = await prisma.financiamento.create({ data: { leadId: leadA, clienteNome: "A", clienteTel: "0", tipo: "mcmv", status: "contrato", valorImovel: 200000, protocolo: "histórico" } });
    expect(await concluir(prisma, leadA, "financiamento", f.id)).toEqual({ estado: "concluido", modulo: "financiamento", registroId: f.id });
    const depois = await prisma.financiamento.findUniqueOrThrow({ where: { id: f.id } });
    expect(depois).toMatchObject({ status: "liberado", valorImovel: 200000, protocolo: "histórico", clienteNome: "A" });
    expect(await concluir(prisma, leadA, "financiamento", f.id)).toMatchObject({ estado: "ja_concluido" });
  });

  it("não conclui registro de outro lead nem reabre cancelado", async () => {
    const r = await prisma.financiamento.create({ data: { leadId: leadA, clienteNome: "A", clienteTel: "0", tipo: "sbpe", status: "contrato" } });
    expect(await concluir(prisma, leadB, "financiamento", r.id)).toEqual({ estado: "sem_registro", modulo: "financiamento" });
    expect((await prisma.financiamento.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("contrato");
    const c = await prisma.financiamento.create({ data: { leadId: leadA, clienteNome: "A", clienteTel: "0", tipo: "sbpe", status: "cancelado" } });
    expect(await concluir(prisma, leadA, "financiamento", c.id)).toMatchObject({ estado: "cancelado" });
    expect((await prisma.financiamento.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("cancelado");
    expect(await concluir(prisma, leadA, "financiamento", r.id)).toMatchObject({ estado: "concluido" });
    expect((await prisma.financiamento.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("liberado");
  });

  it("módulo desconhecido não é tocado", async () => {
    expect(await concluir(prisma, leadA, "comissao", "x")).toEqual({ estado: "sem_modulo", modulo: "comissao" });
  });
});
