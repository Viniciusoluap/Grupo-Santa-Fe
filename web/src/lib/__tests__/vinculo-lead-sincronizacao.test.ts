import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco falso com semântica mínima de transação: writes feitos dentro de
// `$transaction` só "comitam" se o callback terminar sem erro. Writes fora da
// transação comitam na hora — é assim que o bug original deixava um
// financiamento sem checklist.
type Fin = { id: string; leadId: string; tipo: string };
const db = {
  financiamentos: [] as Fin[],
  checklist: [] as { financiamentoId: string }[],
  avaliacoes: [] as { numero: string }[],
};
const falhar = { checklist: false };
let seq = 0;

function writers(destino: typeof db) {
  return {
    financiamento: {
      create: vi.fn(async ({ data }: { data: Omit<Fin, "id"> }) => {
        const fin = { ...data, id: `fin${++seq}` };
        destino.financiamentos.push(fin);
        return fin;
      }),
    },
    checklistItem: {
      createMany: vi.fn(async ({ data }: { data: { financiamentoId: string }[] }) => {
        if (falhar.checklist) throw new Error("falha simulada no checklist");
        destino.checklist.push(...data);
        return { count: data.length };
      }),
    },
  };
}

const leadFindUnique = vi.fn();
const financiamentoFindMany = vi.fn();
const avaliacaoCreate = vi.fn();
const direto = writers(db);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: (...a: unknown[]) => leadFindUnique(...a) },
    financiamento: {
      create: (...a: Parameters<typeof direto.financiamento.create>) => direto.financiamento.create(...a),
      findMany: (...a: unknown[]) => financiamentoFindMany(...a),
    },
    checklistItem: {
      createMany: (...a: Parameters<typeof direto.checklistItem.createMany>) => direto.checklistItem.createMany(...a),
    },
    avaliacao: { create: (...a: unknown[]) => avaliacaoCreate(...a) },
    $transaction: async (cb: (tx: ReturnType<typeof writers>) => Promise<unknown>) => {
      const staged = { financiamentos: [], checklist: [], avaliacoes: [] } as typeof db;
      const r = await cb(writers(staged)); // erro → nada é comitado
      db.financiamentos.push(...staged.financiamentos);
      db.checklist.push(...staged.checklist);
      return r;
    },
  },
}));

function leadCom(servicos: string[], financiamentos: { tipo: string }[] = []) {
  return {
    id: "L1",
    nome: "Maria",
    telefone: "11999990000",
    email: null,
    servico: JSON.stringify(servicos),
    financiamentos,
    _count: { obras: 0, projetos: 0, regularizacoes: 0, avaliacoes: 0 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.financiamentos.length = 0;
  db.checklist.length = 0;
  db.avaliacoes.length = 0;
  falhar.checklist = false;
  financiamentoFindMany.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Achado 1 — financiamento nunca nasce sem checklist", () => {
  it("se o checklist falha, o financiamento também não é gravado (transação) e a falha é reportada", async () => {
    leadFindUnique.mockResolvedValue(leadCom(["Financiamento MCMV"]));
    falhar.checklist = true;

    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    const r = await sincronizarServicosDoLead("L1");

    expect(db.financiamentos).toHaveLength(0); // sem financiamento órfão
    expect(r).toEqual({ criados: 0, falhas: ["financiamento"] });
  });

  it("caminho feliz: financiamento + 15 itens de checklist", async () => {
    leadFindUnique.mockResolvedValue(leadCom(["Financiamento MCMV"]));
    const { sincronizarServicosDoLead, CHECKLIST_FINANCIAMENTO_PADRAO } = await import("@/lib/crm/vinculo-lead");
    const r = await sincronizarServicosDoLead("L1");

    expect(r).toEqual({ criados: 1, falhas: [] });
    expect(db.financiamentos).toHaveLength(1);
    expect(db.checklist).toHaveLength(CHECKLIST_FINANCIAMENTO_PADRAO.length);
    expect(db.checklist.every((c) => c.financiamentoId === db.financiamentos[0].id)).toBe(true);
  });

  it("repara financiamento já existente que ficou sem checklist (órfão de antes da correção)", async () => {
    // O serviço já consta como "presente" (há financiamento MCMV), então nada é
    // criado — mas o checklist ausente precisa ser preenchido.
    leadFindUnique.mockResolvedValue(leadCom(["Financiamento MCMV"], [{ tipo: "mcmv" }]));
    financiamentoFindMany.mockResolvedValue([{ id: "orfao" }]);

    const { sincronizarServicosDoLead, CHECKLIST_FINANCIAMENTO_PADRAO } = await import("@/lib/crm/vinculo-lead");
    const r = await sincronizarServicosDoLead("L1");

    expect(financiamentoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "L1", checklist: { none: {} } } }),
    );
    expect(db.checklist).toHaveLength(CHECKLIST_FINANCIAMENTO_PADRAO.length);
    expect(db.checklist.every((c) => c.financiamentoId === "orfao")).toBe(true);
    expect(r).toEqual({ criados: 0, falhas: [] });
  });
});

describe("Achado 2 — falha na sincronização não é engolida", () => {
  it("erro ao criar a avaliação volta em `falhas` (antes só ia para o console)", async () => {
    leadFindUnique.mockResolvedValue(leadCom(["Avaliação de imóvel"]));
    avaliacaoCreate.mockRejectedValue(new Error("banco fora"));

    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    const r = await sincronizarServicosDoLead("L1");

    expect(r).toEqual({ criados: 0, falhas: ["avaliacao"] });
  });

  it("colisão no número da avaliação (P2002) sorteia outro número em vez de perder o registro", async () => {
    leadFindUnique.mockResolvedValue(leadCom(["Avaliação de imóvel"]));
    avaliacaoCreate
      .mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }))
      .mockResolvedValueOnce({ id: "a1" });

    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    const r = await sincronizarServicosDoLead("L1");

    expect(avaliacaoCreate).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ criados: 1, falhas: [] });
  });

  it("colisões persistentes desistem após 5 tentativas e reportam a falha", async () => {
    leadFindUnique.mockResolvedValue(leadCom(["Avaliação de imóvel"]));
    avaliacaoCreate.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }));

    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    const r = await sincronizarServicosDoLead("L1");

    expect(avaliacaoCreate).toHaveBeenCalledTimes(5);
    expect(r.falhas).toEqual(["avaliacao"]);
  });

  it("falha num serviço não impede os outros", async () => {
    leadFindUnique.mockResolvedValue(leadCom(["Avaliação de imóvel", "Financiamento Convencional"]));
    avaliacaoCreate.mockRejectedValue(new Error("banco fora"));

    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    const r = await sincronizarServicosDoLead("L1");

    expect(r).toEqual({ criados: 1, falhas: ["avaliacao"] });
    expect(db.financiamentos).toHaveLength(1);
  });
});
