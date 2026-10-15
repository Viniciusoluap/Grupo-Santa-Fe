import { beforeEach, describe, expect, it, vi } from "vitest";

// EPIC-020 Lote 3 (item 32): toda obra com corretor no CRM aparece em
// Comissões, derivada da obra — sem registro duplicado e sem % inventado.
const prisma = { obra: { findMany: vi.fn() }, comissao: { findMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma }));

const obra = (o: Record<string, unknown> = {}) => ({
  id: "o1", nome: "Obra", clienteNome: "Cliente", vgv: null, comissaoPercentual: null,
  leadVinculado: { nome: "Cliente CRM", corretor: { id: "c1", nome: "Corretor", regraComissao: null } },
  movimentos: [], ...o,
});

beforeEach(() => vi.clearAllMocks());

describe("listarComissoesDeObras", () => {
  it("obras antigas sem VGV/percentual aparecem como dados incompletos (sem valor inventado)", async () => {
    prisma.obra.findMany.mockResolvedValue([obra()]);
    prisma.comissao.findMany.mockResolvedValue([]);
    const { listarComissoesDeObras } = await import("@/lib/comissoes/obras");
    const [r] = await listarComissoesDeObras();
    expect(r.calculo.status).toBe("dados_incompletos");
    expect(r.calculo.valorCentavos).toBeNull();
    expect(r.calculo.pendencias).toHaveLength(2);
  });

  it("calcula VGV × % e soma pagamentos de categoria comissão", async () => {
    // Pedido de 15/10: o VGV vem do Valor Aprovado do lead (o da obra é ignorado).
    prisma.obra.findMany.mockResolvedValue([obra({ vgv: "1.00", comissaoPercentual: "5.0000", movimentos: [{ valor: "5000.00" }],
      leadVinculado: { nome: "Cliente CRM", valorAprovado: "230000.00", corretor: { id: "c1", nome: "Corretor", regraComissao: null } } })]);
    prisma.comissao.findMany.mockResolvedValue([]);
    const { listarComissoesDeObras } = await import("@/lib/comissoes/obras");
    const [r] = await listarComissoesDeObras();
    expect(r.calculo).toMatchObject({ valorCentavos: 1_150_000, pagoCentavos: 500_000, saldoCentavos: 650_000, status: "parcial" });
    expect(r.vgv).toBe("230000.00");
  });

  it("filtra pelo corretor quando pedido (visão do corretor)", async () => {
    prisma.obra.findMany.mockResolvedValue([]);
    prisma.comissao.findMany.mockResolvedValue([]);
    const { listarComissoesDeObras } = await import("@/lib/comissoes/obras");
    await listarComissoesDeObras("c9");
    expect(prisma.obra.findMany.mock.calls[0][0].where).toEqual({ leadVinculado: { corretorId: "c9" } });
  });

  it("comissão manual da mesma obra é preservada e divergências sinalizadas", async () => {
    prisma.obra.findMany.mockResolvedValue([obra({ vgv: "230000.00", leadVinculado: { nome: "X", valorAprovado: "230000.00", corretor: { id: "c1", nome: "C", regraComissao: { percentual: "5.0000" } } } })]);
    prisma.comissao.findMany.mockResolvedValue([{ id: "m1", negocioId: "o1", corretorId: "c2", valor: 1000, percentual: 6, status: "pendente" }]);
    const { listarComissoesDeObras } = await import("@/lib/comissoes/obras");
    const [r] = await listarComissoesDeObras();
    expect(r.registrosManuais).toHaveLength(1);
    expect(r.alertas.join(" ")).toContain("outro corretor");
    expect(r.alertas.join(" ")).toContain("valor diferente");
  });
});
