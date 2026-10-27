import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ l: { id: "l1", clienteId: "c1", valor: 1000, valorRecebido: 0, pago: false, version: 1, transacaoId: null as string | null, asaasPaymentId: null as string | null }, baixas: [] as Record<string, unknown>[], historico: [] as unknown[] }));
vi.mock("@/lib/auth/modulos", () => ({ exigirModuloAcao: async () => ({ id: "admin1" }) }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => {
  const tx = {
    bpoLancamento: { findUniqueOrThrow: async () => ({ ...state.l }), updateMany: async ({ where, data }: { where: { version: number }; data: { valorRecebido: number; pago: boolean } }) => { if (where.version !== state.l.version) return { count: 0 }; Object.assign(state.l, data, { version: state.l.version + 1 }); return { count: 1 }; } },
    bpoBaixa: { findUnique: async ({ where }: { where: { requestKey: string } }) => state.baixas.find((b) => b.requestKey === where.requestKey), create: async ({ data }: { data: Record<string, unknown> }) => { state.baixas.push(data); return data; } },
    bpoLancamentoHistorico: { create: async ({ data }: { data: unknown }) => { state.historico.push(data); } },
  };
  return { prisma: { $transaction: async (f: (t: typeof tx) => unknown) => f(tx) } };
});
import { registrarBaixaBpo } from "@/lib/actions/bpo";

describe("ação de baixa auditada", () => {
  beforeEach(() => { Object.assign(state.l, { valorRecebido: 0, pago: false, version: 1, transacaoId: null, asaasPaymentId: null }); state.baixas = []; state.historico = []; });
  const entrada = { id: "l1", version: 1, requestKey: "req1", valor: 300, data: "2026-10-27", motivo: "Entrada do cliente" };
  it("retry não duplica baixa nem histórico e a última parcela quita", async () => {
    await registrarBaixaBpo(entrada);
    expect(state.l).toMatchObject({ valorRecebido: 300, pago: false, version: 2 });
    expect(await registrarBaixaBpo(entrada)).toMatchObject({ repetida: true });
    expect(state.baixas).toHaveLength(1); expect(state.historico).toHaveLength(1);
    await registrarBaixaBpo({ ...entrada, version: 2, requestKey: "req2", valor: 700 });
    expect(state.l).toMatchObject({ valorRecebido: 1000, pago: true, version: 3 });
  });
  it("rejeita estado concorrente e origem externa sem gravar uma baixa", async () => {
    await expect(registrarBaixaBpo({ ...entrada, version: 2 })).rejects.toThrow(/alterado/);
    state.l.asaasPaymentId = "pay1";
    await expect(registrarBaixaBpo(entrada)).rejects.toThrow(/origem/);
    expect(state.baixas).toHaveLength(0); expect(state.historico).toHaveLength(0);
  });
});
