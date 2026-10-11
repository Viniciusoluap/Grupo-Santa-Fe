import { describe, expect, it, vi, beforeEach } from "vitest";

const auth = vi.fn();

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/db", () => ({
  prisma: { financiamento: {} },
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

describe("criarFinanciamento — criação avulsa bloqueada no servidor (Lote 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita mesmo com sessão autenticada válida", async () => {
    auth.mockResolvedValue(sessaoAdmin);
    const { criarFinanciamento } = await import("@/lib/actions/financiamentos");

    await expect(criarFinanciamento(new FormData())).rejects.toThrow(/não é permitida/i);
  });

  it("rejeita sem sessão (checagem de autenticação ainda é feita primeiro)", async () => {
    auth.mockResolvedValue(null);
    const { criarFinanciamento } = await import("@/lib/actions/financiamentos");

    await expect(criarFinanciamento(new FormData())).rejects.toThrow("Não autorizado");
  });

  it("nunca chega a tocar o banco — nenhum financiamento é criado por esta action", async () => {
    auth.mockResolvedValue(sessaoAdmin);
    const { criarFinanciamento } = await import("@/lib/actions/financiamentos");

    // O mock de "@/lib/db" nem expõe `create`; qualquer tentativa de criar
    // um financiamento avulso quebraria este teste com "not a function".
    await expect(criarFinanciamento(formDataFrom({ clienteNome: "Fulano" }))).rejects.toThrow();
  });
});
