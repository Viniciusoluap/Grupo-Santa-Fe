import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ clientes: [] as Record<string, unknown>[], leads: [] as Record<string, unknown>[] }));
vi.mock("@/lib/auth/modulos", () => ({ exigirModuloAcao: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => {
  const tx = { $queryRaw: vi.fn(), bpoCliente: {
    findMany: async () => state.clientes,
    update: async ({ where, data }: { where: { id: string }; data: object }) => { const cliente = state.clientes.find((c) => c.id === where.id)!; Object.assign(cliente, data); return cliente; },
    create: async ({ data }: { data: object }) => ({ id: `bpo-${state.clientes.length}`, ...data }),
  } };
  return { prisma: { lead: { findMany: async () => state.leads }, $transaction: async (f: (t: typeof tx) => unknown) => f(tx) } };
});
import { importarClientesCrmBpo } from "@/lib/actions/bpo";

describe("sincronização cadastral CRM/BPO", () => {
  beforeEach(() => { state.clientes = []; state.leads = [{ id: "lead-1", nome: "Ana Atualizada", cpf: "12345678900", email: "ana@exemplo.com", telefone: "999999999" }]; });
  it("reutiliza avulso pelo documento e atualiza cadastro preservando financeiro e vínculos", async () => {
    state.clientes = [{ id: "bpo-1", leadId: null, cpf: "123.456.789-00", razaoSocial: "Ana Antiga", email: null, telefone: "1", honorarios: 850, diaVencimento: 15, observacoes: "Contrato original" }];
    expect(await importarClientesCrmBpo()).toMatchObject({ criadas: 0, atualizadas: 1, conflitos: 0 });
    expect(state.clientes[0]).toMatchObject({ id: "bpo-1", leadId: "lead-1", razaoSocial: "Ana Atualizada", honorarios: 850, diaVencimento: 15, observacoes: "Contrato original" });
    expect(await importarClientesCrmBpo()).toMatchObject({ criadas: 0, atualizadas: 0, inalteradas: 1 });
  });
  it("informa conflito em vez de duplicar ou sequestrar documento de outro lead", async () => {
    state.clientes = [{ id: "bpo-1", leadId: "outro-lead", cpf: "12345678900" }];
    expect(await importarClientesCrmBpo()).toMatchObject({ criadas: 0, atualizadas: 0, conflitos: 1 });
    expect(state.clientes).toHaveLength(1);
    expect(state.clientes[0].leadId).toBe("outro-lead");
  });
});
