import { beforeEach, describe, expect, it, vi } from "vitest";

// EPIC-020 Lote 2 — mesmas regras da API `obraFinanceiro` da Prospecta:
// somente admin, sem campos calculados aceitos, investidores ≤ 100%,
// empreiteiro precisa ter o papel, erros do banco traduzidos.

const auth = vi.fn();
const prisma = {
  usuario: { findUnique: vi.fn() },
  obra: { update: vi.fn(), findUnique: vi.fn() },
  investidor: { count: vi.fn() },
  obraInvestidor: { deleteMany: vi.fn(), createMany: vi.fn() },
  obraMovimento: { create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = { user: { id: "u1", role: "admin" } };
const valoresBase = {
  obraId: "o1", vgv: "158000.00", financiamento: "120000.00", fgts: "10000.00", subsidio: "6234.00",
  custoTerreno: "20000", comissao: "5000", orcamentoPrevisto: "90000", taxaMensalPct: "1.5", parcelas: 12,
  empreiteiroId: null, percentualEmpreiteiro: null, escritorioCef: " Agência 1 ",
};

describe("obra-financeiro — permissões", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([null, { user: { id: "c", role: "colaborador" } }, { user: { id: "e", role: "empreiteiro" } }, { user: { id: "k", role: "corretor" } }])(
    "bloqueia quem não é admin (%o)",
    async (sessao) => {
      auth.mockResolvedValue(sessao);
      const a = await import("@/lib/actions/obra-financeiro");
      await expect(a.salvarValoresObra(valoresBase)).rejects.toThrow("Não autorizado");
      await expect(a.adicionarMovimentoObra({ obraId: "o1", natureza: "entrada", descricao: "Sinal", valor: "10", data: "2026-10-01" })).rejects.toThrow("Não autorizado");
      await expect(a.cancelarMovimentoObra("m1", "motivo")).rejects.toThrow("Não autorizado");
      expect(prisma.obra.update).not.toHaveBeenCalled();
      expect(prisma.obraMovimento.create).not.toHaveBeenCalled();
    },
  );
});

describe("salvarValoresObra", () => {
  beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue(admin); prisma.obra.findUnique.mockResolvedValue({ comissaoPercentual: null, leadVinculado: null }); });

  it("grava só as entradas, com ausente = null (não zero)", async () => {
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    const r = await salvarValoresObra({ ...valoresBase, fgts: null, subsidio: "" });
    expect(r).toEqual({ ok: true });
    const data = prisma.obra.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ vgv: "158000.00", fgts: null, subsidio: null, escritorioCef: "Agência 1", empreiteiroId: null, percentualEmpreiteiro: null });
    expect(Object.keys(data)).not.toContain("lucroEstimado");
  });

  it("rejeita valor monetário com mais de 2 casas", async () => {
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    const r = await salvarValoresObra({ ...valoresBase, vgv: "10.123" });
    expect(r).toEqual({ ok: false, erro: "Valor monetário inválido em VGV." });
  });

  it("exige usuário com papel empreiteiro ativo", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ papel: "colaborador", ativo: true });
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    const r = await salvarValoresObra({ ...valoresBase, empreiteiroId: "u9", percentualEmpreiteiro: "30" });
    expect(r).toEqual({ ok: false, erro: "Selecione um empreiteiro cadastrado e ativo." });
    expect(prisma.obra.update).not.toHaveBeenCalled();
  });

  it("rejeita percentual do empreiteiro acima de 100%", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ papel: "empreiteiro", ativo: true });
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    const r = await salvarValoresObra({ ...valoresBase, empreiteiroId: "u9", percentualEmpreiteiro: "100.5" });
    expect(r.ok).toBe(false);
  });
});

describe("definirInvestidoresObra", () => {
  beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue(admin); });

  it("bloqueia soma acima de 100%", async () => {
    const { definirInvestidoresObra } = await import("@/lib/actions/obra-financeiro");
    const r = await definirInvestidoresObra("o1", [{ investidorId: "a", percentual: "60" }, { investidorId: "b", percentual: "40.000001" }]);
    expect(r).toEqual({ ok: false, erro: "A soma das participações dos investidores não pode passar de 100%." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("bloqueia investidor repetido", async () => {
    const { definirInvestidoresObra } = await import("@/lib/actions/obra-financeiro");
    const r = await definirInvestidoresObra("o1", [{ investidorId: "a", percentual: "10" }, { investidorId: "a", percentual: "10" }]);
    expect(r.ok).toBe(false);
  });

  it("aceita exatamente 100% e substitui as participações numa transação", async () => {
    prisma.investidor.count.mockResolvedValue(2);
    const { definirInvestidoresObra } = await import("@/lib/actions/obra-financeiro");
    const r = await definirInvestidoresObra("o1", [{ investidorId: "a", percentual: "60" }, { investidorId: "b", percentual: "40" }]);
    expect(r).toEqual({ ok: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("movimentos", () => {
  beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue(admin); });

  it("pagamento exige categoria e recebimento não aceita categoria", async () => {
    const { adicionarMovimentoObra } = await import("@/lib/actions/obra-financeiro");
    expect((await adicionarMovimentoObra({ obraId: "o1", natureza: "pagamento", descricao: "Cimento", valor: "10", data: "2026-10-01" })).ok).toBe(false);
    expect((await adicionarMovimentoObra({ obraId: "o1", natureza: "entrada", categoria: "outros", descricao: "Sinal", valor: "10", data: "2026-10-01" })).ok).toBe(false);
    expect(prisma.obraMovimento.create).not.toHaveBeenCalled();
  });

  it("rejeita valor zero ou negativo", async () => {
    const { adicionarMovimentoObra } = await import("@/lib/actions/obra-financeiro");
    expect((await adicionarMovimentoObra({ obraId: "o1", natureza: "entrada", descricao: "Sinal", valor: "0", data: "2026-10-01" })).ok).toBe(false);
    expect((await adicionarMovimentoObra({ obraId: "o1", natureza: "entrada", descricao: "Sinal", valor: "-5", data: "2026-10-01" })).ok).toBe(false);
  });

  it("vinculado ao BPO grava origem bpo e traduz alocação excedida", async () => {
    prisma.obraMovimento.create.mockRejectedValue(new Error("BPO_ALOCACAO_EXCEDIDA: disponível R$ 150.00"));
    const { adicionarMovimentoObra } = await import("@/lib/actions/obra-financeiro");
    const r = await adicionarMovimentoObra({ obraId: "o1", natureza: "pagamento", categoria: "fornecedor", descricao: "Areia", valor: "200", data: "2026-10-01", bpoLancamentoId: "b1" });
    expect(prisma.obraMovimento.create.mock.calls[0][0].data).toMatchObject({ origem: "bpo", bpoLancamentoId: "b1", categoria: "fornecedor" });
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("Disponível: R$ 150.00") });
  });

  it("erro desconhecido do banco não é engolido", async () => {
    prisma.obraMovimento.create.mockRejectedValue(new Error("conexão perdida"));
    const { adicionarMovimentoObra } = await import("@/lib/actions/obra-financeiro");
    await expect(adicionarMovimentoObra({ obraId: "o1", natureza: "entrada", descricao: "Sinal", valor: "10", data: "2026-10-01" })).rejects.toThrow("conexão perdida");
  });

  it("cancelar exige motivo e preserva o registro (update, nunca delete)", async () => {
    prisma.obraMovimento.updateMany.mockResolvedValue({ count: 1 });
    const { cancelarMovimentoObra } = await import("@/lib/actions/obra-financeiro");
    expect((await cancelarMovimentoObra("m1", " ")).ok).toBe(false);
    expect(await cancelarMovimentoObra("m1", "Lançado em duplicidade")).toEqual({ ok: true });
    expect(prisma.obraMovimento.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m1", status: "confirmado" }, data: expect.objectContaining({ status: "cancelado" }) }));
  });

  it("reativar traduz alocação excedida do BPO", async () => {
    prisma.obraMovimento.updateMany.mockRejectedValue(new Error("BPO_ALOCACAO_EXCEDIDA"));
    const { reativarMovimentoObra } = await import("@/lib/actions/obra-financeiro");
    const r = await reativarMovimentoObra("m1");
    expect(r.ok).toBe(false);
  });
});

describe("Lote 3 — comissão da obra pelo CRM (item 32)", () => {
  const corretor = (percentual: string | null) => ({ comissaoPercentual: null, leadVinculado: { corretor: { id: "c1", nome: "Corretor", regraComissao: percentual ? { percentual } : null } } });
  const entrada = { ...valoresBase, vgv: "230000.00", comissao: "1" };
  beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue(admin); });

  it("com corretor e % da obra grava o valor calculado (Teste G: 230.000 × 5% = 11.500,00) e ignora o digitado", async () => {
    prisma.obra.findUnique.mockResolvedValue(corretor(null));
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    expect(await salvarValoresObra({ ...entrada, comissaoPercentual: "5" })).toEqual({ ok: true });
    expect(prisma.obra.update.mock.calls[0][0].data).toMatchObject({ comissaoValor: "11500.00", comissaoPercentual: "5" });
  });

  it("sem % da obra usa o padrão do corretor; vírgula é aceita", async () => {
    prisma.obra.findUnique.mockResolvedValue(corretor("4"));
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    await salvarValoresObra({ ...entrada, comissaoPercentual: "" });
    expect(prisma.obra.update.mock.calls[0][0].data).toMatchObject({ comissaoValor: "9200.00", comissaoPercentual: null });
    vi.clearAllMocks(); auth.mockResolvedValue(admin); prisma.obra.findUnique.mockResolvedValue(corretor(null));
    await salvarValoresObra({ ...entrada, comissaoPercentual: "2,5" });
    expect(prisma.obra.update.mock.calls[0][0].data).toMatchObject({ comissaoValor: "5750.00", comissaoPercentual: "2.5" });
  });

  it("sem regra cadastrada não inventa percentual e preserva o valor informado", async () => {
    prisma.obra.findUnique.mockResolvedValue(corretor(null));
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    await salvarValoresObra({ ...entrada, comissaoPercentual: null });
    expect(prisma.obra.update.mock.calls[0][0].data).toMatchObject({ comissaoValor: "1", comissaoPercentual: null });
  });

  it("percentual de comissão inválido é recusado sem gravar", async () => {
    prisma.obra.findUnique.mockResolvedValue(corretor(null));
    const { salvarValoresObra } = await import("@/lib/actions/obra-financeiro");
    for (const p of ["100.01", "5.12345", "-1", "abc"]) {
      expect((await salvarValoresObra({ ...entrada, comissaoPercentual: p })).ok).toBe(false);
    }
    expect(prisma.obra.update).not.toHaveBeenCalled();
  });
});
