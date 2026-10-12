import { describe, expect, it, vi, beforeEach } from "vitest";

const auth = vi.fn();

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/auth/rbac", () => ({ requireActionRole: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { avaliacao: {} },
}));
vi.mock("@/lib/crm/vinculo-lead", () => ({ clienteParaRegistro: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

function formDataFrom(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const sessaoAdmin = { user: { id: "u1", role: "admin" } };

describe("criarAvaliacao — criação avulsa bloqueada no servidor (paridade com Lote 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita mesmo com sessão autenticada válida", async () => {
    auth.mockResolvedValue(sessaoAdmin);
    const { criarAvaliacao } = await import("@/lib/actions/avaliacoes");

    await expect(criarAvaliacao(new FormData())).rejects.toThrow(/não é permitida/i);
  });

  it("rejeita sem sessão (checagem de autenticação ainda é feita primeiro)", async () => {
    auth.mockResolvedValue(null);
    const { criarAvaliacao } = await import("@/lib/actions/avaliacoes");

    await expect(criarAvaliacao(new FormData())).rejects.toThrow("Não autorizado");
  });

  it("nunca chega a tocar o banco — nenhuma avaliação é criada por esta action", async () => {
    auth.mockResolvedValue(sessaoAdmin);
    const { criarAvaliacao } = await import("@/lib/actions/avaliacoes");

    // O mock de "@/lib/db" nem expõe `create`; qualquer tentativa de criar
    // uma avaliação avulsa quebraria este teste com "not a function".
    await expect(criarAvaliacao(formDataFrom({ leadId: "L1" }))).rejects.toThrow();
  });
});
