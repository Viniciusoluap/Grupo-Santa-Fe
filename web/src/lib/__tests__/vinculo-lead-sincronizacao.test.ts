import { beforeEach, describe, expect, it, vi } from "vitest";

type Registro = { id: string; leadId: string; servicoLeadId: string | null; tipo?: string; [key: string]: unknown };
type Demanda = { id: string; leadId: string; modulo: string; servico: string; requestKey: string };
type Estado = { demandas: Demanda[]; registros: Record<string, Registro[]>; checklist: { financiamentoId: string }[] };
const controle = vi.hoisted(() => ({ falhaChecklist: false, conflitos: 0, chamadas: [] as unknown[], locks: [] as string[], estado: { demandas: [], registros: {}, checklist: [] } as Estado, fila: Promise.resolve() }));
const lead = { id: "L1", nome: " Maria ", telefone: " 11999990000 ", email: " maria@example.test ", servico: JSON.stringify(["Financiamento MCMV", "Obra e reforma"]) };

function clienteTx(estado: Estado) {
  const relacoes = (demanda: Demanda) => ({ ...demanda, ...Object.fromEntries(Object.entries(estado.registros).map(([modulo, rows]) => [modulo, rows.find((r) => r.servicoLeadId === demanda.id) ?? null])) });
  const tx = {
    $queryRaw: async (_sql: unknown, id: string) => { controle.locks.push(id); return [{ id }]; },
    lead: { findUniqueOrThrow: async () => lead },
    servicoLead: {
      findFirst: async ({ where }: { where: { leadId: string; servico: string } }) => { const d = estado.demandas.find((d) => d.leadId === where.leadId && d.servico === where.servico); return d ? relacoes(d) : null; },
      create: async ({ data }: { data: Omit<Demanda, "id"> }) => { const d = { ...data, id: `d${estado.demandas.length + 1}` }; estado.demandas.push(d); return relacoes(d); },
      upsert: async ({ where, create }: { where: { requestKey: string }; create: Omit<Demanda, "id"> }) => { const d = estado.demandas.find((d) => d.requestKey === where.requestKey); if (d) return relacoes(d); const novo = { ...create, id: `d${estado.demandas.length + 1}` }; estado.demandas.push(novo); return relacoes(novo); },
    },
    checklistItem: { createMany: async ({ data }: { data: { financiamentoId: string }[] }) => { if (controle.falhaChecklist) throw new Error("Checklist indisponível"); estado.checklist.push(...data); return { count: data.length }; } },
  };
  for (const modulo of ["financiamento", "obra", "projeto", "regularizacao", "avaliacao"]) Object.assign(tx, {
    [modulo]: {
      findMany: async ({ where }: { where: { leadId: string; servicoLeadId?: null; checklist?: unknown } }) => estado.registros[modulo].filter((r) => r.leadId === where.leadId && (where.checklist ? !estado.checklist.some((c) => c.financiamentoId === r.id) : r.servicoLeadId === null)),
      create: async ({ data }: { data: Omit<Registro, "id"> }) => { const novo = { ...data, id: `${modulo}${estado.registros[modulo].length + 1}` } as Registro; estado.registros[modulo].push(novo); return novo; },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Registro> }) => { const r = estado.registros[modulo].find((r) => r.id === where.id)!; Object.assign(r, data); return r; },
    },
  });
  return tx;
}

// A trava de módulo do colaborador tem teste próprio (colaborador-modulos.test.ts).
vi.mock("@/lib/crm/modulo-do-servico", () => ({ exigirModuloDoServico: async () => {} }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (callback: (tx: ReturnType<typeof clienteTx>) => Promise<unknown>, options: unknown) => {
  controle.chamadas.push(options);
  if (controle.conflitos > 0) { controle.conflitos--; throw Object.assign(new Error("Serialization conflict"), { code: "P2034" }); }
  const anterior = controle.fila;
  let liberar!: () => void;
  controle.fila = new Promise<void>((resolve) => { liberar = resolve; });
  await anterior;
  const staged = structuredClone(controle.estado);
  try { const result = await callback(clienteTx(staged)); controle.estado = staged; return result; } finally { liberar(); }
} } }));

beforeEach(() => {
  controle.estado = { demandas: [], registros: Object.fromEntries(["financiamento", "obra", "projeto", "regularizacao", "avaliacao"].map((m) => [m, []])), checklist: [] };
  controle.falhaChecklist = false;
  controle.conflitos = 0;
  controle.chamadas = [];
  controle.locks = [];
  controle.fila = Promise.resolve();
  lead.servico = JSON.stringify(["Financiamento MCMV", "Obra e reforma"]);
});

describe("CRM materializa demandas com identidade estável em um único commit", () => {
  it("cria operações vinculadas à demanda e checklist, com configuração financeira ausente", async () => {
    const { sincronizarServicosDoLead, CHECKLIST_FINANCIAMENTO_PADRAO } = await import("@/lib/crm/vinculo-lead");
    expect(await sincronizarServicosDoLead("L1")).toEqual({ criados: 2, falhas: [] });
    expect(controle.estado.demandas).toHaveLength(2);
    const fin = controle.estado.registros.financiamento[0];
    expect(fin).toMatchObject({ leadId: "L1", servicoLeadId: controle.estado.demandas[0].id, clienteNome: "Maria", clienteTel: "11999990000", tipo: "mcmv", status: "aguardando_configuracao" });
    expect(fin).not.toHaveProperty("banco");
    expect(fin.valorImovel).toBeNull();
    expect(controle.estado.checklist).toHaveLength(CHECKLIST_FINANCIAMENTO_PADRAO.length);
    expect(controle.chamadas[0]).toMatchObject({ isolationLevel: "Serializable" });
    expect(controle.locks).toContain("L1");
  });

  it("duas sincronizações concorrentes retornam a mesma identidade, sem segunda operação", async () => {
    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    await Promise.all([sincronizarServicosDoLead("L1"), sincronizarServicosDoLead("L1")]);
    expect(controle.estado.registros.financiamento).toHaveLength(1);
    expect(controle.estado.registros.obra).toHaveLength(1);
    expect(controle.estado.demandas).toHaveLength(2);
  });

  it("falha no checklist aborta a demanda e todas as operações", async () => {
    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    controle.falhaChecklist = true;
    await expect(sincronizarServicosDoLead("L1")).rejects.toThrow("Checklist indisponível");
    expect(controle.estado.demandas).toHaveLength(0);
    expect(controle.estado.registros.financiamento).toHaveLength(0);
    expect(controle.estado.registros.obra).toHaveLength(0);
  });

  it("reconcilia apenas registros já vinculados por leadId, preserva IDs e repara checklist", async () => {
    controle.estado.registros.financiamento.push({ id: "antigo", leadId: "L1", servicoLeadId: null, tipo: "mcmv" }, { id: "outro-cliente", leadId: "L2", servicoLeadId: null, tipo: "mcmv" });
    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    await sincronizarServicosDoLead("L1");
    expect(controle.estado.registros.financiamento.map((r) => r.id)).toEqual(["antigo", "outro-cliente"]);
    expect(controle.estado.registros.financiamento[0].servicoLeadId).not.toBeNull();
    expect(controle.estado.registros.financiamento[1].servicoLeadId).toBeNull();
    expect(controle.estado.checklist.every((c) => c.financiamentoId === "antigo")).toBe(true);
  });

  it("adicionar operação permite repetir serviço, enquanto reenvio usa a mesma intenção", async () => {
    const { sincronizarServicosDoLead, transacaoCRM, adicionarOperacaoDoLead } = await import("@/lib/crm/vinculo-lead");
    await sincronizarServicosDoLead("L1");
    for (const key of ["intencao_operacao_01", "intencao_operacao_01", "intencao_operacao_02"]) await transacaoCRM((tx) => adicionarOperacaoDoLead(tx, "L1", "Obra e reforma", key));
    expect(controle.estado.registros.obra).toHaveLength(3);
    expect(new Set(controle.estado.registros.obra.map((r) => r.servicoLeadId)).size).toBe(3);
  });

  it("sincronizar após mudança de modalidade reutiliza a demanda e financiamento existentes", async () => {
    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    await sincronizarServicosDoLead("L1");
    const originalId = controle.estado.registros.financiamento[0].id;
    controle.estado.registros.financiamento[0].tipo = "sbpe";
    controle.estado.demandas[0].servico = "Financiamento Convencional";
    lead.servico = JSON.stringify(["Financiamento Convencional", "Obra e reforma"]);
    expect(await sincronizarServicosDoLead("L1")).toEqual({ criados: 0, falhas: [] });
    expect(controle.estado.registros.financiamento).toHaveLength(1);
    expect(controle.estado.registros.financiamento[0].id).toBe(originalId);
    expect(controle.estado.demandas).toHaveLength(2);
  });

  it("retry P2034 é limitado e outros erros não repetem a operação", async () => {
    const { transacaoCRM } = await import("@/lib/crm/vinculo-lead");
    controle.conflitos = 2;
    await expect(transacaoCRM(async () => "ok")).resolves.toBe("ok");
    expect(controle.chamadas).toHaveLength(3);
    controle.chamadas = [];
    controle.conflitos = 10;
    await expect(transacaoCRM(async () => "ok")).rejects.toMatchObject({ code: "P2034" });
    expect(controle.chamadas).toHaveLength(4);
  });
});
