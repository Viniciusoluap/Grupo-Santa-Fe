import { beforeEach, describe, expect, it, vi } from "vitest";

// Uma falha operacional não pode mais deixar um cadastro parcial nem produzir
// resposta de sucesso. O contrato das actions é executar lead, vínculos e
// histórico na mesma transação; rollback real é coberto pelo harness do banco.
class Redirect extends Error {
  constructor(public url: string) { super(`NEXT_REDIRECT ${url}`); }
}

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), usuario: vi.fn(), transaction: vi.fn(),
  findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), leadCreate: vi.fn(), leadUpdate: vi.fn(),
  updateMany: vi.fn(), interacao: vi.fn(), sincronizar: vi.fn(), propagar: vi.fn(), bloquear: vi.fn(),
  notificar: vi.fn(), redirect: vi.fn(), revalidate: vi.fn(),
  // Estes acessos globais não devem participar da escrita de create/edit.
  globalCreate: vi.fn(), globalUpdate: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/notificacoes", () => ({ notificarAdmins: mocks.notificar }));
vi.mock("@/lib/actions/agenda", () => ({ criarVisita: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  usuario: { findUnique: mocks.usuario },
  lead: { create: mocks.globalCreate, update: mocks.globalUpdate },
} }));
vi.mock("@/lib/crm/vinculo-lead", () => ({
  transacaoCRM: mocks.transaction,
  bloquearLead: mocks.bloquear,
  sincronizarServicosDoLead: mocks.sincronizar,
  propagarDadosClienteDoLead: mocks.propagar,
  resolverResponsavelId: vi.fn(async (id: string | null) => id || null),
  adicionarOperacaoDoLead: vi.fn(),
}));
import { criarLead, editarLead } from "../actions/leads";

const atualizadoEm = new Date("2026-10-11T10:00:00.000Z");
const existente = {
  id: "L1", nome: "Maria", telefone: "1", email: null,
  servico: '["Avaliação de imóvel"]', status: "contato", etapaOperacional: "em_atendimento",
  atualizadoEm, arquivadoEm: null, excluidoEm: null, corretorId: null,
};
const tx = {
  lead: { findUnique: mocks.findUnique, findUniqueOrThrow: mocks.findUniqueOrThrow, create: mocks.leadCreate, update: mocks.leadUpdate, updateMany: mocks.updateMany },
  interacao: { create: mocks.interacao },
};
function form(campos: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(campos)) for (const item of [value].flat()) fd.append(key, item);
  return fd;
}
function criarForm() {
  return form({ nome: "Maria", telefone: "1", servicos: ["Avaliação de imóvel"], requestKey: "request-crm-000001" });
}
function editarForm(overrides: Record<string, string | string[]> = {}) {
  return form({ id: "L1", nome: "Maria atualizada", telefone: "2", servicos: ["Avaliação de imóvel", "Projeto de engenharia"], atualizadoEm: atualizadoEm.toISOString(), etapaAnterior: "em_atendimento", etapaOperacional: "projetos_vistorias", ...overrides });
}
async function urlDoRedirect(promise: Promise<unknown>) {
  try { await promise; } catch (error) { if (error instanceof Redirect) return error.url; throw error; }
  throw new Error("Esperava redirecionamento.");
}
function semFalsoSucesso() {
  expect(mocks.redirect).not.toHaveBeenCalled();
  expect(mocks.notificar).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
}
function semEscritaGlobal() {
  expect(mocks.globalCreate).not.toHaveBeenCalled();
  expect(mocks.globalUpdate).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
  mocks.usuario.mockResolvedValue({ id: "u1", nome: "Equipe Santa Fé", papel: "admin", ativo: true, corretor: null });
  mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
  mocks.findUnique.mockResolvedValue(null);
  mocks.findUniqueOrThrow.mockResolvedValue(existente);
  mocks.leadCreate.mockResolvedValue({ ...existente, etapaOperacional: "novo_lead" });
  mocks.leadUpdate.mockResolvedValue({ id: "L1", nome: "Maria atualizada", telefone: "2", email: null });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.interacao.mockResolvedValue({});
  mocks.sincronizar.mockResolvedValue({ criados: 1, falhas: [] });
  mocks.propagar.mockResolvedValue(undefined);
  mocks.notificar.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation((url: string) => { throw new Redirect(url); });
});

describe("criarLead — persistência atômica", () => {
  it("salva VGV simulado no cadastro e ignora financiamento aprovado enviado indevidamente", async () => {
    const fd = criarForm();
    fd.set("orcamento", "230000.75");
    fd.set("valorAprovado", "180000");
    expect(await urlDoRedirect(criarLead(fd))).toBe("/admin/leads");
    expect(mocks.leadCreate.mock.calls[0][0].data.orcamento).toBe(230000.75);
    expect(mocks.leadCreate.mock.calls[0][0].data).not.toHaveProperty("valorAprovado");
  });

  it("propaga falha na operação, sem notificação, revalidação ou redirect de sucesso", async () => {
    mocks.sincronizar.mockRejectedValue(new Error("Falha ao criar avaliação"));
    await expect(criarLead(criarForm())).rejects.toThrow("Falha ao criar avaliação");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.leadCreate).toHaveBeenCalledTimes(1);
    expect(mocks.sincronizar).toHaveBeenCalledWith("L1", tx);
    expect(mocks.interacao).not.toHaveBeenCalled();
    semFalsoSucesso(); semEscritaGlobal();
  });

  it("salva NOVO LEAD, serviços e histórico no mesmo contexto transacional antes do sucesso", async () => {
    expect(await urlDoRedirect(criarLead(criarForm()))).toBe("/admin/leads");
    expect(mocks.leadCreate.mock.calls[0][0].data).toMatchObject({ etapaOperacional: "novo_lead", creationRequestKey: "u1:request-crm-000001", servico: '["Avaliação de imóvel"]' });
    expect(mocks.sincronizar).toHaveBeenCalledWith("L1", tx);
    expect(mocks.interacao.mock.calls[0][0].data).toMatchObject({ leadId: "L1", criadoPor: "Equipe Santa Fé" });
    expect(mocks.notificar).toHaveBeenCalledTimes(1);
    expect(mocks.sincronizar.mock.invocationCallOrder[0]).toBeLessThan(mocks.notificar.mock.invocationCallOrder[0]);
    semEscritaGlobal();
  });

  it("reenvio da mesma requestKey reutiliza lead anterior sem criar cadastro, serviços ou histórico duplicados", async () => {
    mocks.findUnique.mockResolvedValue({ ...existente, creationRequestKey: "u1:request-crm-000001" });
    expect(await urlDoRedirect(criarLead(criarForm()))).toBe("/admin/leads");
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { creationRequestKey: "u1:request-crm-000001" } });
    expect(mocks.leadCreate).not.toHaveBeenCalled();
    expect(mocks.sincronizar).not.toHaveBeenCalled();
    expect(mocks.interacao).not.toHaveBeenCalled();
    semEscritaGlobal();
  });
});

describe("editarLead — persistência atômica", () => {
  it("falha de serviço interrompe a mesma transação da etapa e dos dados do cliente, sem falso sucesso", async () => {
    mocks.sincronizar.mockRejectedValue(new Error("Falha ao criar projeto"));
    await expect(editarLead(editarForm())).rejects.toThrow("Falha ao criar projeto");
    expect(mocks.bloquear).toHaveBeenCalledWith(tx, "L1");
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({ etapaOperacional: "projetos_vistorias" });
    expect(mocks.propagar).toHaveBeenCalledWith({ id: "L1", nome: "Maria atualizada", telefone: "2", email: null }, tx);
    expect(mocks.sincronizar).toHaveBeenCalledWith("L1", tx);
    semFalsoSucesso(); semEscritaGlobal();
  });

  it("sucesso salva dados e serviços na mesma transação e mantém status comercial", async () => {
    expect(await urlDoRedirect(editarLead(editarForm()))).toBe("/admin/leads/L1");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany.mock.calls[0][0].where).toMatchObject({ status: "contato", etapaOperacional: "em_atendimento", atualizadoEm });
    expect(mocks.leadUpdate.mock.calls[0][0].data).toMatchObject({ nome: "Maria atualizada", telefone: "2", servico: '["Avaliação de imóvel","Projeto de engenharia"]' });
    expect(mocks.leadUpdate.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(mocks.interacao.mock.calls[0][0].data.descricao).toContain("EM ATENDIMENTO → PROJETOS E VISTORIAS");
    expect(mocks.propagar.mock.calls[0][1]).toBe(tx);
    expect(mocks.sincronizar).toHaveBeenCalledWith("L1", tx);
    semEscritaGlobal();
  });

  it("conflito de snapshot recusa todas as escritas, propagação e criação de serviço", async () => {
    await expect(editarLead(editarForm({ atualizadoEm: "2026-10-11T09:00:00.000Z" }))).rejects.toThrow("atualizado");
    expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.leadUpdate).not.toHaveBeenCalled();
    expect(mocks.interacao).not.toHaveBeenCalled(); expect(mocks.propagar).not.toHaveBeenCalled(); expect(mocks.sincronizar).not.toHaveBeenCalled();
    semFalsoSucesso(); semEscritaGlobal();
  });
});
