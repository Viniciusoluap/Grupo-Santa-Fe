import { describe, expect, it, vi } from "vitest";

const { findUnique, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/db", () => ({ prisma: { obra: { findUnique }, usuario: { findMany } } }));
import { carregarProgressoObra } from "@/lib/obras/progresso-dados";

describe("janela do histórico de medições", () => {
  it("exibe 100 registros sem cobrar novamente o progresso anterior à janela", async () => {
    const historico = Array.from({ length: 101 }, (_, index) => ({
      id: String(index), progresso: index / 2, somaIncidencia: 100, itens: [],
      criadoEm: new Date(2026, 0, 1, 0, 0, index),
      criadoPorId: null, solicitadaPorId: null, recebidaPorId: null,
      solicitadaEm: null, recebidaEm: null, editadaEm: null,
    })).reverse();
    findUnique.mockResolvedValue({
      progresso: 50, financiamentoCef: "200000", fgts: "0", subsidio: "0",
      custoTerreno: "0", progressoItens: [], progressoHistorico: historico,
    });
    const dados = await carregarProgressoObra("obra-teste");
    expect(findUnique.mock.calls[0][0].select.progressoHistorico.take).toBe(101);
    expect(dados?.historico).toHaveLength(100);
    expect(dados?.historico.at(-1)).toMatchObject({
      id: "1", estimativa: { percentualDaMedicao: 0.5, valorCentavos: 100_000 },
    });
  });
});
