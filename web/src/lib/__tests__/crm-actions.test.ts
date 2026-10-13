import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn(), findLead: vi.fn(), updateLead: vi.fn(), updateMany: vi.fn(), interacao: vi.fn(), bloquear: vi.fn(), visita: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/actions/agenda", () => ({ criarVisita: mocks.visita }));
vi.mock("@/lib/notificacoes", () => ({ notificarAdmins: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { usuario: { findUnique: mocks.usuario }, lead: { findUnique: mocks.findLead } } }));
vi.mock("@/lib/crm/vinculo-lead", () => ({
  transacaoCRM: async (fn: (tx: unknown) => Promise<unknown>) => fn({ lead: { findUnique: mocks.findLead, update: mocks.updateLead, updateMany: mocks.updateMany }, interacao: { create: mocks.interacao } }),
  bloquearLead: mocks.bloquear,
  resolverResponsavelId: vi.fn(), propagarDadosClienteDoLead: vi.fn(), sincronizarServicosDoLead: vi.fn(), adicionarOperacaoDoLead: vi.fn(),
}));
import { alterarEtapaLead, excluirLead, adicionarInteracao, agendarVisitaDoLead } from "../actions/leads";
const atualizadoEm = new Date("2026-10-11T10:00:00.000Z");
const lead = { id: "L1", status: "proposta", etapaOperacional: null, atualizadoEm, arquivadoEm: null, excluidoEm: null, corretorId: "c1" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
  // Item 06: o CRM é da equipe interna; colaborador com o módulo "leads" liberado.
  mocks.usuario.mockResolvedValue({ id: "u1", nome: "Maria", papel: "colaborador", ativo: true, permissoes: '["leads"]', corretor: null });
  mocks.findLead.mockResolvedValue(lead); mocks.updateMany.mockResolvedValue({ count: 1 });
});
describe("ações CRM protegidas e auditadas", () => {
  it("move somente o lead próprio e preserva status comercial", async () => {
    await alterarEtapaLead("L1", "medicoes", null, atualizadoEm.toISOString());
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({ etapaOperacional: "medicoes" });
    expect(mocks.interacao.mock.calls[0][0].data.criadoPor).toBe("Maria");
  });
  it("recusa etapa inválida, corretor (sem CRM) e versão desatualizada", async () => {
    await expect(alterarEtapaLead("L1", "ganho", null, atualizadoEm.toISOString())).rejects.toThrow("inválida");
    mocks.usuario.mockResolvedValueOnce({ id: "u1", nome: "Zé", papel: "corretor", ativo: true, permissoes: "[]", corretor: { id: "c1", ativo: true } });
    await expect(alterarEtapaLead("L1", "finalizado", null, atualizadoEm.toISOString())).rejects.toThrow("Sem permissão");
    await expect(alterarEtapaLead("L1", "finalizado", null, "2026-10-11T09:00:00Z")).rejects.toThrow("atualizado por outra pessoa");
    expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.interacao).not.toHaveBeenCalled();
  });
  it("exclusão da equipe interna guarda cadastro e relações sem delete", async () => {
    mocks.usuario.mockResolvedValueOnce({ id: "u1", nome: "Zé", papel: "corretor", ativo: true, permissoes: "[]", corretor: { id: "c1", ativo: true } });
    await expect(excluirLead("L1")).rejects.toThrow("Sem permissão");
    mocks.usuario.mockResolvedValue({ id: "u1", nome: "Maria", papel: "admin", ativo: true, corretor: null });
    await excluirLead("L1");
    expect(mocks.updateLead.mock.calls[0][0]).toEqual({ where: { id: "L1" }, data: { excluidoEm: expect.any(Date) } });
    expect(mocks.interacao.mock.calls[0][0].data.descricao).toContain("preservados");
  });
  it("agendamento recusa lead inativo e delega somente campos autorizados", async () => {
    const form = new FormData(); form.set("leadId", "L1"); form.set("agendadaPara", "2026-10-12T10:00"); form.set("corretorId", "forged"); form.set("clienteNome", "forged");
    mocks.findLead.mockResolvedValue({ ...lead, arquivadoEm: new Date() });
    await expect(agendarVisitaDoLead(form)).rejects.toThrow("lead ativo");
    expect(mocks.visita).not.toHaveBeenCalled();
    mocks.findLead.mockResolvedValue(lead); await agendarVisitaDoLead(form);
    const enviado = mocks.visita.mock.calls[0][0] as FormData;
    expect(enviado.get("leadId")).toBe("L1"); expect(enviado.get("corretorId")).toBeNull(); expect(enviado.get("colaboradorNome")).toBe("Maria"); expect(enviado.has("clienteNome")).toBe(false);
  });
  it("interação identifica ator no servidor e impede escrita em outro lead", async () => {
    const form = new FormData(); form.set("leadId", "L1"); form.set("tipo", "nota"); form.set("descricao", "Ligação realizada"); form.set("criadoPor", "Admin forjado");
    await adicionarInteracao(form);
    expect(mocks.interacao.mock.calls[0][0].data.criadoPor).toBe("Maria");
    mocks.interacao.mockClear();
    mocks.usuario.mockResolvedValueOnce({ id: "u1", nome: "Zé", papel: "corretor", ativo: true, permissoes: "[]", corretor: { id: "c1", ativo: true } });
    await expect(adicionarInteracao(form)).rejects.toThrow("Sem permissão"); expect(mocks.interacao).not.toHaveBeenCalled();
  });
});
