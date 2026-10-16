import { beforeEach, describe, expect, it, vi } from "vitest";
import { totaisDoEmpreiteiro } from "@/lib/obras/portal-empreiteiro";
import { podeGerenciarFotos, podeVerFotosDaObra } from "@/lib/obras/fotos";

// Portal do Empreiteiro (pedido de 15/10/2026): permissões por obra, somas da aba
// Relatórios e fotos. Mesmo conteúdo em Prospecta/server/portal-empreiteiro.test.ts.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  obra: vi.fn(),
  movimento: vi.fn(),
  foto: vi.fn(),
  criarMovimento: vi.fn(),
  apagarMovimento: vi.fn(),
  transacao: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    obra: { findUnique: mocks.obra, update: vi.fn() },
    obraMovimento: { findUnique: mocks.movimento, create: mocks.criarMovimento, deleteMany: mocks.apagarMovimento },
    obraFoto: { findUnique: mocks.foto, updateMany: vi.fn(async () => ({ count: 1 })) },
    obraProgressoItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    obraProgressoHistorico: { create: vi.fn() },
    $transaction: mocks.transacao,
  },
}));

import { adicionarMovimentoObra, excluirMovimentoObra, salvarValoresObra } from "@/lib/actions/obra-financeiro";
import { atualizarFotoObra, salvarProgressoObra } from "@/lib/actions/obra-progresso";
import { exigirObraOuEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";

const empreiteiro = (id = "e1") => mocks.auth.mockResolvedValue({ user: { id, role: "empreiteiro" } });
const pagamento = { obraId: "o1", natureza: "pagamento" as const, categoria: "material" as const, descricao: "Cimento", valor: "100.00", data: "2026-10-15" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.obra.mockResolvedValue({ id: "o1", empreiteiroId: "e1" });
});

describe("portal do empreiteiro — acesso por obra", () => {
  it("libera a obra vinculada a ele e recusa a de outro empreiteiro", async () => {
    empreiteiro();
    await expect(exigirObraOuEmpreiteiro("o1")).resolves.toBe("e1");
    empreiteiro("e2");
    await expect(exigirObraOuEmpreiteiro("o1")).rejects.toThrow("não está vinculada a você");
  });

  it("lança e exclui pagamentos da obra dele", async () => {
    empreiteiro();
    await expect(adicionarMovimentoObra(pagamento)).resolves.toEqual({ ok: true });
    expect(mocks.criarMovimento).toHaveBeenCalledOnce();
    mocks.movimento.mockResolvedValue({ obraId: "o1", natureza: "pagamento" });
    mocks.apagarMovimento.mockResolvedValue({ count: 1 });
    await expect(excluirMovimentoObra("m1")).resolves.toEqual({ ok: true });
  });

  it("não lança recebimentos, não vincula o BPO e não exclui recebimentos", async () => {
    empreiteiro();
    await expect(adicionarMovimentoObra({ ...pagamento, natureza: "entrada", categoria: undefined })).resolves.toMatchObject({ ok: false });
    await expect(adicionarMovimentoObra({ ...pagamento, bpoLancamentoId: "b1" })).resolves.toMatchObject({ ok: false });
    mocks.movimento.mockResolvedValue({ obraId: "o1", natureza: "recebimento_cef" });
    await expect(excluirMovimentoObra("m1")).resolves.toMatchObject({ ok: false });
    expect(mocks.criarMovimento).not.toHaveBeenCalled();
    expect(mocks.apagarMovimento).not.toHaveBeenCalled();
  });

  it("atualiza progresso e fotos só da obra dele", async () => {
    empreiteiro();
    const itens = SERVICOS_PROGRESSO.map((s) => ({ chave: s.chave, incidencia: "5", execucao: "0" }));
    await expect(salvarProgressoObra("o1", itens)).resolves.toMatchObject({ ok: true });
    mocks.foto.mockResolvedValue({ obraId: "o1" });
    await expect(atualizarFotoObra("f1", "Fundação", true)).resolves.toEqual({ ok: true });
    empreiteiro("e2");
    await expect(salvarProgressoObra("o1", itens)).rejects.toThrow("não está vinculada a você");
    await expect(atualizarFotoObra("f1", null, true)).rejects.toThrow("não está vinculada a você");
  });

  it("Valores da Operação e Custos previstos continuam só da equipe", async () => {
    empreiteiro();
    await expect(salvarValoresObra({
      obraId: "o1", vgv: null, financiamento: null, fgts: null, subsidio: null, custoTerreno: null, comissao: null,
      orcamentoPrevisto: null, taxaMensalPct: null, parcelas: null, empreiteiroId: null, percentualEmpreiteiro: null, escritorioCef: null,
    })).rejects.toThrow(/Sem permissão|Não autorizado/);
  });
});

describe("portal do empreiteiro — aba Relatórios", () => {
  it("soma o lucro dele, o VGV e o valor a receber do banco, contando as obras sem dados", () => {
    const t = totaisDoEmpreiteiro([
      { id: "1", nome: "Casa A", vgvCentavos: 20000000, receberBanco: { ok: true, centavos: 15000000 }, lucroEmpreiteiro: { ok: true, centavos: 1200000 } },
      { id: "2", nome: "Casa B", vgvCentavos: 18000000, receberBanco: { ok: false, motivo: "Informe: Financiamento CEF" }, lucroEmpreiteiro: { ok: true, centavos: 800000 } },
      { id: "3", nome: "Casa C", vgvCentavos: null, receberBanco: { ok: true, centavos: 5000000 }, lucroEmpreiteiro: { ok: false, motivo: "Informe: VGV" } },
    ]);
    expect(t.quantidade).toBe(3);
    expect(t.lucro).toEqual({ centavos: 2000000, pendentes: 1 });
    expect(t.vgv).toEqual({ centavos: 38000000, pendentes: 1 });
    expect(t.receberBanco).toEqual({ centavos: 20000000, pendentes: 1 });
    expect(t.porObra[0]).toEqual({ id: "1", nome: "Casa A", vgv: 200000, receberBanco: 150000, lucro: 12000 });
  });

  it("sem obras, tudo zero", () => {
    expect(totaisDoEmpreiteiro([])).toMatchObject({ quantidade: 0, lucro: { centavos: 0, pendentes: 0 } });
  });
});

describe("portal do empreiteiro — fotos da obra", () => {
  it("o empreiteiro vinculado vê e gerencia; outro empreiteiro não", () => {
    const obra = { usuarioId: null, leadId: null, empreiteiroId: "5" };
    expect(podeVerFotosDaObra({ id: "5", papel: "empreiteiro" }, obra)).toBe(true);
    expect(podeGerenciarFotos({ id: "5", papel: "empreiteiro" }, obra)).toBe(true);
    expect(podeVerFotosDaObra({ id: "6", papel: "empreiteiro" }, obra)).toBe(false);
    expect(podeGerenciarFotos({ id: "6", papel: "empreiteiro" }, obra)).toBe(false);
    expect(podeGerenciarFotos({ id: "5", papel: "empreiteiro" })).toBe(false);
  });
});
