import { beforeEach, describe, expect, it, vi } from "vitest";
import { ITENS_FINANCEIROS_PADRAO, planejarValoresPadrao, VALORES_PREVISTOS_PADRAO } from "../financeiro/regularizacao";
const state = vi.hoisted(() => ({
  sessao: { user: { id: "admin-teste", role: "admin" } } as { user: { id: string; role: string } } | null,
  itens: [] as { id: string; chavePadrao: string | null; nome: string; grupo: string; previsto: string }[],
  lock: vi.fn(), update: vi.fn(), create: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => state.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: state.transaction } }));
import { gerarValoresPadraoRegularizacao } from "../actions/regularizacao";
beforeEach(() => {
  vi.clearAllMocks(); state.sessao = { user: { id: "admin-teste", role: "admin" } }; state.itens = [];
  state.lock.mockResolvedValue([{ id: "processo-teste" }]);
  state.update.mockImplementation(async ({ where, data }) => Object.assign(state.itens.find((i) => i.id === where.id)!, data));
  state.create.mockImplementation(async ({ data }) => { const item = { ...data, id: `item-${state.itens.length}` }; state.itens.push(item); return item; });
  state.transaction.mockImplementation(async (fn) => fn({ $queryRaw: state.lock, regularizacaoItemFinanceiro: { findMany: async () => state.itens, update: state.update, create: state.create } }));
});
describe("valores previstos padrão", () => {
  it("inclui todos os 17 valores exatos, em seus grupos", () => {
    const plano = planejarValoresPadrao([]);
    expect(plano.map((i) => i.previsto)).toEqual(["2500.00", "2000.00", "100.00", "300.00", "2000.00", "102.00", "400.00", "600.00", "750.00", "2000.00", "700.00", "700.00", "2000.00", "0.00", "700.00", "2000.00", "2000.00"]);
    expect(plano.filter((i) => i.grupo === "casa_pronta")).toHaveLength(3);
  });
  it("reutiliza ID canônico renomeado e legado por nome/grupo, preservando personalizados", () => {
    const plano = planejarValoresPadrao([
      { id: "existente", chavePadrao: "projetos", nome: "Editado", grupo: "durante_obra", previsto: "2500" },
      { id: "legado", chavePadrao: null, nome: "AGUA", grupo: "durante_obra", previsto: "0" },
      { id: "extra", chavePadrao: null, nome: "Avulso", grupo: "durante_obra", previsto: "100" },
    ]);
    expect(plano.find((i) => i.chave === "projetos")?.id).toBe("existente");
    expect(plano.find((i) => i.chave === "agua")?.id).toBe("legado");
    expect(plano.some((i) => i.id === "extra")).toBe(false);
  });
  it("recusa ambiguidade em vez de duplicar", () => {
    expect(() => planejarValoresPadrao([
      { id: "a", chavePadrao: "pci", nome: "PCI", grupo: "durante_obra", previsto: "0" },
      { id: "b", chavePadrao: null, nome: "PCI", grupo: "durante_obra", previsto: "0" },
    ])).toThrow("duplicados");
  });
  it("verifica permissão antes da transação", async () => {
    state.sessao = null;
    expect(await gerarValoresPadraoRegularizacao("processo-teste")).toHaveProperty("erroAcao");
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("serializa por processo, é idempotente e atualiza apenas previstos/chaves", async () => {
    expect(await gerarValoresPadraoRegularizacao("processo-teste")).toEqual({ requerConfirmacao: false });
    expect(state.lock).toHaveBeenCalled(); expect(state.create).toHaveBeenCalledTimes(17); state.create.mockClear();
    expect(await gerarValoresPadraoRegularizacao("processo-teste")).toEqual({ requerConfirmacao: false });
    expect(state.create).not.toHaveBeenCalled(); expect(state.itens).toHaveLength(17);
    expect(state.update.mock.calls.every(([arg]) => Object.keys(arg.data).every((key) => ["previsto", "chavePadrao"].includes(key)))).toBe(true);
  });
  it("não escreve antes da confirmação e preserva IDs após confirmar", async () => {
    state.itens = ITENS_FINANCEIROS_PADRAO.map((i) => ({ id: i.chave, chavePadrao: i.chave, nome: i.nome, grupo: i.grupo, previsto: VALORES_PREVISTOS_PADRAO[i.chave] }));
    state.itens[0].previsto = "99.00";
    expect(await gerarValoresPadraoRegularizacao("processo-teste")).toEqual({ requerConfirmacao: true });
    expect(state.update).not.toHaveBeenCalled(); expect(state.create).not.toHaveBeenCalled();
    expect(await gerarValoresPadraoRegularizacao("processo-teste", true)).toEqual({ requerConfirmacao: false });
    expect(state.itens[0]).toMatchObject({ id: "projetos", previsto: "2500.00" });
  });
  it("recusa processo inexistente sem alterações", async () => {
    state.lock.mockResolvedValue([]);
    expect(await gerarValoresPadraoRegularizacao("ausente")).toEqual({ erroAcao: "Regularização não encontrada." });
    expect(state.create).not.toHaveBeenCalled();
  });
});
