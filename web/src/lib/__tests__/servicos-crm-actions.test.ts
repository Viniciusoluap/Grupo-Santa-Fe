import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usuario: { id: "admin1", nome: "Admin", papel: "admin", corretorId: null },
  fin: { id: "F1", leadId: "L1", servicoLeadId: "D1", tipo: "mcmv", status: "aguardando_configuracao" },
  demanda: { id: "D1", leadId: "L1", servico: "Financiamento MCMV", modulo: "financiamento" },
  servicos: '["Financiamento MCMV","Obra e reforma"]',
  outraDemanda: false,
  acessivel: true,
  atualizarFin: vi.fn(), atualizarFinMany: vi.fn(), atualizarDemanda: vi.fn(), atualizarLead: vi.fn(), historico: vi.fn(), lock: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "admin1", role: "admin" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));
vi.mock("@/lib/crm/acesso-lead", () => ({ obterAtorCrm: async () => mocks.usuario }));
vi.mock("@/lib/crm/acesso-financiamento", () => ({ escopoFinanciamentosDoAtor: () => ({}), financiamentoDoAtor: async () => mocks.fin }));
vi.mock("@/lib/financeiro/vgv-lead", () => ({ sincronizarVgvDoLead: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/crm/vinculo-lead", () => ({
  bloquearLead: (...args: unknown[]) => mocks.lock(...args),
  clienteParaRegistro: async () => ({ clienteNome: "Maria", clienteTel: "11999990000", clienteEmail: null }),
  transacaoCRM: async (cb: (tx: unknown) => Promise<unknown>) => cb({
    financiamento: { findFirst: async () => mocks.acessivel ? mocks.fin : null, update: mocks.atualizarFin, updateMany: mocks.atualizarFinMany },
    servicoLead: { findUniqueOrThrow: async () => mocks.demanda, update: mocks.atualizarDemanda, findFirst: async () => mocks.outraDemanda ? { id: "D2" } : null },
    lead: { findUniqueOrThrow: async () => ({ id: "L1", servico: mocks.servicos }), update: mocks.atualizarLead },
    interacao: { create: mocks.historico },
  }),
}));

function dados(tipo = "sbpe") {
  const form = new FormData();
  for (const [key, value] of Object.entries({ id: "F1", tipo, imovel: "Casa", banco: "caixa", valorImovel: "250000", valorFinanciado: "200000", entrada: "50000", taxa: "8", prazo: "360" })) form.set(key, value);
  return form;
}
beforeEach(() => { vi.clearAllMocks(); mocks.outraDemanda = false; mocks.acessivel = true; });

describe("ações operacionais mantêm origem e identidade do CRM", () => {
  it("os cinco módulos bloqueiam criação independente", async () => {
    const [obras, financiamentos, projetos, regs, regDocs, avaliacoes] = await Promise.all([import("@/lib/actions/obras"), import("@/lib/actions/financiamentos"), import("@/lib/actions/projetos"), import("@/lib/actions/regularizacoes"), import("@/lib/actions/regularizacao"), import("@/lib/actions/avaliacoes")]);
    expect(obras).not.toHaveProperty("criarObra");
    // As actions legadas seguem exportadas para rejeitar chamadas de formulários antigos.
    await expect(financiamentos.criarFinanciamento(new FormData())).rejects.toThrow(/não é permitida/i);
    await expect(avaliacoes.criarAvaliacao(new FormData())).rejects.toThrow(/não é permitida/i);
    expect(projetos).not.toHaveProperty("criarProjeto");
    expect(regs).not.toHaveProperty("criarRegularizacao");
    expect(regDocs).not.toHaveProperty("criarRegularizacao");
  });

  it("troca a modalidade preservando IDs e sincroniza o interesse e o histórico", async () => {
    const { editarFinanciamento } = await import("@/lib/actions/financiamentos");
    await expect(editarFinanciamento(dados())).rejects.toThrow("REDIRECT");
    expect(mocks.lock).toHaveBeenCalledWith(expect.anything(), "L1");
    expect(mocks.atualizarFin).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "F1" }, data: expect.objectContaining({ tipo: "sbpe", status: "pre_analise", clienteNome: "Maria" }) }));
    expect(mocks.atualizarLead).toHaveBeenCalledWith({ where: { id: "L1" }, data: { orcamento: 250000, valorAprovado: 200000 } });
    expect(mocks.atualizarFinMany).toHaveBeenCalledWith({ where: { leadId: "L1" }, data: { valorImovel: 250000, valorFinanciado: 200000 } });
    expect(mocks.atualizarDemanda).toHaveBeenCalledWith({ where: { id: "D1" }, data: { servico: "Financiamento Convencional" } });
    const update = mocks.atualizarLead.mock.calls.find(([call]) => call.data.servico)?.[0];
    expect(JSON.parse(update.data.servico)).toEqual(["Obra e reforma", "Financiamento Convencional"]);
    expect(mocks.historico).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadId: "L1", criadoPor: "Admin" }) }));
  });

  it("preserva o interesse original quando há outra operação daquela modalidade", async () => {
    mocks.outraDemanda = true;
    const { editarFinanciamento } = await import("@/lib/actions/financiamentos");
    await expect(editarFinanciamento(dados())).rejects.toThrow("REDIRECT");
    expect(JSON.parse(mocks.atualizarLead.mock.calls.find(([call]) => call.data.servico)?.[0].data.servico)).toEqual(["Financiamento MCMV", "Obra e reforma", "Financiamento Convencional"]);
  });

  it("recusa substituir o lead pela edição do módulo", async () => {
    const { editarFinanciamento } = await import("@/lib/actions/financiamentos");
    const form = dados(); form.set("leadId", "L2");
    await expect(editarFinanciamento(form)).rejects.toThrow("vínculo");
    expect(mocks.atualizarFin).not.toHaveBeenCalled();
  });

  it("recusa operação fora do escopo do ator e configuração numérica ausente", async () => {
    const { editarFinanciamento } = await import("@/lib/actions/financiamentos");
    mocks.acessivel = false;
    await expect(editarFinanciamento(dados())).rejects.toThrow("acesso não autorizado");
    mocks.acessivel = true;
    const form = dados(); form.delete("valorImovel");
    await expect(editarFinanciamento(form)).rejects.toThrow("valorImovel");
    expect(mocks.atualizarFin).not.toHaveBeenCalled();
  });
});
