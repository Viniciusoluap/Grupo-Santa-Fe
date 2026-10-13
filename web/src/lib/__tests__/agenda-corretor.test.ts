import { beforeEach, describe, expect, it, vi } from "vitest";

// Revisão do Codex (Prospecta #111, mesma regra no Santa Fé): o corretor só
// agenda visita para lead da própria carteira.

const mocks = vi.hoisted(() => ({ auth: vi.fn(), lead: vi.fn(), criar: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: mocks.lead }, visita: { create: mocks.criar } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarVisita } from "@/lib/actions/agenda";

const form = (leadId: string) => {
  const f = new FormData();
  f.set("leadId", leadId);
  f.set("agendadaPara", "2026-10-20T10:00");
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe("agenda do corretor", () => {
  it("recusa lead de outro corretor sem gravar nada", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "corretor", corretorId: "c1" } });
    mocks.lead.mockResolvedValue({ nome: "Cliente de outro", telefone: "999", corretorId: "c2", excluidoEm: null });
    await expect(criarVisita(form("l2"))).rejects.toThrow("Lead não encontrado na sua carteira.");
    expect(mocks.criar).not.toHaveBeenCalled();
  });

  it("aceita lead da própria carteira, com nome e telefone do cadastro", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "corretor", corretorId: "c1" } });
    mocks.lead.mockResolvedValue({ nome: "Meu cliente", telefone: "888", corretorId: "c1", excluidoEm: null });
    await criarVisita(form("l1"));
    expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ leadId: "l1", clienteNome: "Meu cliente", clienteTel: "888", corretorId: "c1" }),
    }));
  });

  it("equipe agenda para qualquer lead", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u2", role: "colaborador" } });
    mocks.lead.mockResolvedValue({ nome: "Cliente", telefone: "777", corretorId: "c2", excluidoEm: null });
    await criarVisita(form("l2"));
    expect(mocks.criar).toHaveBeenCalled();
  });
});
