import { beforeEach, describe, expect, it, vi } from "vitest";

// Pedido A9: etapa e valores do financiamento editados direto na lista.
// A etapa muda sem exigir a configuração completa e não toca no lead.

const mocks = vi.hoisted(() => ({ doAtor: vi.fn(), update: vi.fn(), updateMany: vi.fn(), updateLead: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/crm/acesso-financiamento", () => ({ financiamentoDoAtor: mocks.doAtor, escopoFinanciamentosDoAtor: vi.fn() }));
vi.mock("@/lib/financeiro/vgv-lead", () => ({ sincronizarVgvDoLead: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { financiamento: { update: mocks.update } } }));
vi.mock("@/lib/crm/vinculo-lead", () => ({
  bloquearLead: mocks.lock,
  transacaoCRM: async (run: (tx: unknown) => Promise<unknown>) => run({
    financiamento: { update: mocks.update, updateMany: mocks.updateMany }, lead: { update: mocks.updateLead },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { alterarStatusFinanciamento, atualizarValoresFinanciamento } from "@/lib/actions/financiamentos";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.doAtor.mockResolvedValue({ id: "f1", status: "aguardando_configuracao", imovel: null, banco: null, leadId: "l1" });
});

describe("etapa do financiamento", () => {
  it("muda mesmo sem configuração completa e só no financiamento", async () => {
    await alterarStatusFinanciamento("f1", "documentacao");
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { status: "documentacao" } });
  });
  it("recusa etapa inexistente ou 'Pendente de configuração'", async () => {
    await expect(alterarStatusFinanciamento("f1", "xyz")).rejects.toThrow("Etapa inválida.");
    await expect(alterarStatusFinanciamento("f1", "aguardando_configuracao")).rejects.toThrow("Etapa inválida.");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("valores do financiamento", () => {
  it("salva total e financiado", async () => {
    expect(await atualizarValoresFinanciamento("f1", 250000, 200000)).toEqual({ ok: true });
    expect(mocks.lock).toHaveBeenCalledWith(expect.anything(), "l1");
    expect(mocks.updateLead).toHaveBeenCalledWith({ where: { id: "l1" }, data: { orcamento: 250000, valorAprovado: 200000 } });
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { leadId: "l1" }, data: { valorImovel: 250000, valorFinanciado: 200000 } });
  });
  it("recusa financiado maior que o total e valor inválido", async () => {
    expect(await atualizarValoresFinanciamento("f1", 100, 200)).toMatchObject({ erroAcao: expect.stringMatching(/não pode superar/) });
    expect(await atualizarValoresFinanciamento("f1", -1, 0)).toMatchObject({ erroAcao: "Valor inválido." });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateLead).not.toHaveBeenCalled();
  });
});
