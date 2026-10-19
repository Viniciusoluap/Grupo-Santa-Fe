import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  estado: { existe: true, alterado: false },
  historico: {
    findUniqueOrThrow: vi.fn().mockResolvedValue({ pciVersao: null }),
    findUnique: vi.fn().mockResolvedValue({ obraId: "obra" }),
    findFirst: vi.fn(),
    delete: vi.fn(async () => { mock.estado.existe = false; }),
    update: vi.fn(async () => { mock.estado.alterado = true; }),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/obras/acesso-empreiteiro", () => ({ exigirObraOuEmpreiteiro: async () => "admin" }));
vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    obraProgressoHistorico: mock.historico,
    obraProgressoItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    obraPci: { findUnique: vi.fn().mockResolvedValue(null) },
    obra: { update: vi.fn(async () => { throw new Error("falha ao restaurar progresso"); }) },
  };
  return { prisma: {
    ...tx,
    $transaction: async (fn: (db: typeof tx) => Promise<unknown>) => {
      const antes = { ...mock.estado };
      try { return await fn(tx); }
      catch (e) { mock.estado = antes; throw e; }
    },
  } };
});
import { editarMedicao, excluirMedicao } from "@/lib/actions/obra-progresso";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";
const itens = SERVICOS_PROGRESSO.map(s => ({ chave: s.chave, incidencia: s.incidenciaPadrao, execucao: "50" }));

beforeEach(() => {
  mock.estado = { existe: true, alterado: false };
  mock.historico.findFirst.mockReset();
});

describe("atomicidade do histórico com o progresso vigente", () => {
  it("reverte a exclusão se a restauração da obra falhar", async () => {
    mock.historico.findFirst.mockResolvedValueOnce({ id: "medicao" }).mockResolvedValueOnce({ itens });
    await expect(excluirMedicao("medicao")).rejects.toThrow("falha ao restaurar progresso");
    expect(mock.estado.existe).toBe(true);
  });
  it("reverte a edição se a atualização da obra falhar", async () => {
    mock.historico.findFirst.mockResolvedValueOnce({ id: "medicao" });
    await expect(editarMedicao("medicao", itens)).rejects.toThrow("falha ao restaurar progresso");
    expect(mock.estado.alterado).toBe(false);
  });
});
