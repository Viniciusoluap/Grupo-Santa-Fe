// Paridade 13/11 — EPIC-017 da Prospecta (`shared/lead-snapshot.ts` + `lead-services-router.ts`):
// o lead guarda CPF e endereço, que migram para Avaliação, Obra e Regularização criadas pelo CRM.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { enderecoCompletoDoLead, enderecoDoFormulario, enderecoDoLead, ENDERECO_A_DEFINIR } from "@/lib/crm/servicos-lead";

type Linha = Record<string, unknown>;
const estado = vi.hoisted(() => ({ lead: {} as Record<string, unknown>, tabelas: {} as Record<string, Linha[]>, updates: [] as { modelo: string; where: Linha; data: Linha }[] }));

function casa(linha: Linha, where: Linha): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Linha[]).some((w) => casa(linha, w));
    if (v && typeof v === "object" && "in" in (v as Linha)) return ((v as { in: unknown[] }).in).includes(linha[k]);
    return linha[k] === v;
  });
}

function tx() {
  const t: Record<string, unknown> = {
    $queryRaw: async (_s: unknown, id: string) => [{ id }],
    lead: { findUniqueOrThrow: async () => estado.lead, findUnique: async () => estado.lead },
    servicoLead: {
      findFirst: async () => null,
      create: async ({ data }: { data: Linha }) => ({ ...data, id: "d1", financiamento: null, obra: null, projeto: null, regularizacao: null, avaliacao: null, tarefa: null }),
    },
    checklistItem: { createMany: async () => ({ count: 0 }) },
  };
  for (const modelo of ["financiamento", "obra", "projeto", "regularizacao", "avaliacao"]) t[modelo] = {
    findMany: async () => [],
    create: async ({ data }: { data: Linha }) => { const r = { ...data, id: `${modelo}1` }; (estado.tabelas[modelo] ??= []).push(r); return r; },
    updateMany: async ({ where, data }: { where: Linha; data: Linha }) => {
      estado.updates.push({ modelo, where, data });
      let count = 0;
      for (const r of estado.tabelas[modelo] ?? []) if (casa(r, where)) { Object.assign(r, data); count++; }
      return { count };
    },
  };
  return t;
}

vi.mock("@/lib/crm/modulo-do-servico", () => ({ exigirModuloDoServico: async () => {} }));
vi.mock("@/lib/db", () => ({ prisma: {
  $transaction: async (cb: (t: ReturnType<typeof tx>) => Promise<unknown>) => cb(tx()),
  lead: { findUnique: async () => estado.lead },
} }));

const LEAD = { id: "L1", nome: " Ana ", telefone: "94 99999-0000", email: null, cpf: "12345678901", servico: "[]" };

describe("endereço do lead (paridade EPIC-017)", () => {
  it("normaliza e monta o endereço completo igual a leadFullAddress", () => {
    expect(enderecoDoLead({ endereco: " Rua A, 10 ", bairro: " Centro ", cidade: " Canaã dos Carajás ", uf: " pa " }))
      .toEqual({ endereco: "Rua A, 10", bairro: "Centro", cidade: "Canaã dos Carajás", uf: "PA" });
    expect(enderecoCompletoDoLead({ endereco: "Rua A, 10", bairro: "Centro", cidade: "Canaã dos Carajás", uf: "PA" })).toBe("Rua A, 10, Centro, Canaã dos Carajás/PA");
    expect(enderecoCompletoDoLead({ cidade: "Parauapebas" })).toBe("Parauapebas");
    expect(enderecoCompletoDoLead({})).toBe("");
  });

  it("lê o formulário com campos opcionais (vazio = null, UF em maiúsculas)", () => {
    const f = new FormData();
    f.set("endereco", "  Rua B  "); f.set("bairro", ""); f.set("cidade", "Canaã"); f.set("uf", "pa");
    expect(enderecoDoFormulario(f)).toEqual({ endereco: "Rua B", bairro: null, cidade: "Canaã", uf: "PA" });
  });

  it("vínculo no CRM cria Avaliação com CPF e endereço do lead; Obra e Regularização com o endereço completo", async () => {
    estado.tabelas = {}; estado.updates = [];
    estado.lead = { ...LEAD, endereco: "Rua A, 10", bairro: "Centro", cidade: "Canaã dos Carajás", uf: "PA", servico: JSON.stringify(["Avaliação de imóvel", "Obra e reforma", "Regularização de imóvel"]) };
    const { SERVICOS_LEAD } = await import("@/lib/crm/servicos-lead");
    const servicos = ["Avalia", "Obra", "Regulariza"].map((p) => SERVICOS_LEAD.find((s) => s.startsWith(p))!);
    expect(servicos.every(Boolean)).toBe(true);
    estado.lead.servico = JSON.stringify(servicos);
    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    await sincronizarServicosDoLead("L1");
    expect(estado.tabelas.avaliacao[0]).toMatchObject({ clienteNome: "Ana", clienteCpf: "12345678901", endereco: "Rua A, 10", bairro: "Centro", cidade: "Canaã dos Carajás", estado: "PA" });
    expect(estado.tabelas.obra[0]).toMatchObject({ endereco: "Rua A, 10, Centro, Canaã dos Carajás/PA" });
    expect(estado.tabelas.regularizacao[0]).toMatchObject({ endereco: "Rua A, 10, Centro, Canaã dos Carajás/PA" });
  });

  it("lead sem endereço mantém a Avaliação pendente ('A definir') e Obra/Regularização sem endereço", async () => {
    estado.tabelas = {}; estado.updates = [];
    const { SERVICOS_LEAD } = await import("@/lib/crm/servicos-lead");
    const servicos = ["Avalia", "Obra", "Regulariza"].map((p) => SERVICOS_LEAD.find((s) => s.startsWith(p))!);
    estado.lead = { ...LEAD, cpf: null, servico: JSON.stringify(servicos) };
    const { sincronizarServicosDoLead } = await import("@/lib/crm/vinculo-lead");
    await sincronizarServicosDoLead("L1");
    expect(estado.tabelas.avaliacao[0]).toMatchObject({ clienteCpf: null, endereco: ENDERECO_A_DEFINIR, bairro: ENDERECO_A_DEFINIR });
    expect(estado.tabelas.avaliacao[0]).not.toHaveProperty("cidade");
    expect(estado.tabelas.obra[0].endereco).toBeNull();
    expect(estado.tabelas.regularizacao[0].endereco).toBeNull();
  });

  it("editar o lead propaga o CPF à Avaliação e preenche só endereços pendentes", async () => {
    estado.updates = [];
    estado.tabelas = {
      avaliacao: [{ id: "a1", leadId: "L1", endereco: ENDERECO_A_DEFINIR, bairro: ENDERECO_A_DEFINIR, cidade: "Canaã dos Carajás", estado: "PA" },
        { id: "a2", leadId: "L1", endereco: "Imóvel avaliado, 5", bairro: "Setor X", cidade: "Canaã dos Carajás", estado: "PA" }],
      obra: [{ id: "o1", leadId: "L1", endereco: null }, { id: "o2", leadId: "L1", endereco: "Lote 7, Qd 3" }],
      regularizacao: [{ id: "r1", leadId: "L1", endereco: "" }],
      financiamento: [], projeto: [],
    };
    const { propagarDadosClienteDoLead } = await import("@/lib/crm/vinculo-lead");
    await propagarDadosClienteDoLead({ ...LEAD, endereco: "Rua Nova, 1", bairro: "Jardim", cidade: "Parauapebas", uf: "PA" });
    const [a1, a2] = estado.tabelas.avaliacao;
    expect(a1).toMatchObject({ clienteCpf: "12345678901", endereco: "Rua Nova, 1", bairro: "Jardim", cidade: "Parauapebas" });
    expect(a2).toMatchObject({ clienteCpf: "12345678901", endereco: "Imóvel avaliado, 5", bairro: "Setor X", cidade: "Canaã dos Carajás" });
    expect(estado.tabelas.obra.map((o) => o.endereco)).toEqual(["Rua Nova, 1, Jardim, Parauapebas/PA", "Lote 7, Qd 3"]);
    expect(estado.tabelas.regularizacao[0].endereco).toBe("Rua Nova, 1, Jardim, Parauapebas/PA");
  });

  it("propagação sem campos de endereço (chamadores antigos) não toca em endereços", async () => {
    estado.updates = [];
    estado.tabelas = { avaliacao: [], obra: [], regularizacao: [], financiamento: [], projeto: [] };
    const { propagarDadosClienteDoLead } = await import("@/lib/crm/vinculo-lead");
    await propagarDadosClienteDoLead(LEAD);
    expect(estado.updates.some((u) => "endereco" in u.data || "bairro" in u.data)).toBe(false);
  });
});

describe("migração 20261113400000_lead_endereco", () => {
  it("é aditiva e idempotente (PGlite)", async () => {
    const pg = new PGlite();
    await pg.exec(`CREATE TABLE leads (id TEXT PRIMARY KEY, nome TEXT NOT NULL, cpf TEXT)`);
    await pg.exec(`INSERT INTO leads (id, nome, cpf) VALUES ('L1', 'Ana', '123')`);
    const sql = readFileSync(new URL("../../../prisma/migrations/20261113400000_lead_endereco/migration.sql", import.meta.url), "utf8");
    await pg.exec(sql); await pg.exec(sql);
    expect((await pg.query("SELECT id, nome, cpf, endereco, bairro, cidade, uf FROM leads")).rows).toEqual([{ id: "L1", nome: "Ana", cpf: "123", endereco: null, bairro: null, cidade: null, uf: null }]);
    await expect(pg.exec(`UPDATE leads SET uf = 'PAR'`)).rejects.toThrow();
  }, 30000); // PGlite demora a iniciar com a suíte inteira em paralelo
});
