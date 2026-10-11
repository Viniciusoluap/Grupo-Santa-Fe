import { beforeEach, describe, expect, it, vi } from "vitest";

// Achado 3 (Codex, PR #156): a comissão precisa gravar o ID real do negócio,
// não só o rótulo, para que a edição recalcule sobre o registro certo.

class Redirect extends Error {}
const comissaoCreate = vi.fn();
const comissaoUpdate = vi.fn();

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1", role: "admin" } })) }));
vi.mock("@/lib/auth/rbac", () => ({ requireActionRole: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Redirect();
  },
}));
vi.mock("@/lib/db", () => ({ prisma: { comissao: { create: comissaoCreate, update: comissaoUpdate } } }));

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

const base = {
  beneficiario: "empresa",
  imovel: "Casa Jardim [Comissão de Venda]",
  valor: "18000",
  percentual: "6",
  vencimento: "2026-12-01",
};

beforeEach(() => vi.clearAllMocks());

describe("criarComissao / editarComissao gravam o ID do negócio", () => {
  it("cria com negocioId", async () => {
    const { criarComissao } = await import("@/lib/actions/comissoes");
    await expect(criarComissao(form({ ...base, tipoNegocio: "venda", negocioId: "imovel-2" }))).rejects.toBeInstanceOf(Redirect);
    expect(comissaoCreate.mock.calls[0][0].data).toMatchObject({ negocioId: "imovel-2", imovel: base.imovel });
  });

  it("edita com negocioId", async () => {
    const { editarComissao } = await import("@/lib/actions/comissoes");
    await expect(editarComissao(form({ ...base, id: "c1", tipoNegocio: "venda", negocioId: "imovel-2" }))).rejects.toBeInstanceOf(Redirect);
    expect(comissaoUpdate.mock.calls[0][0]).toMatchObject({ where: { id: "c1" }, data: { negocioId: "imovel-2" } });
  });

  it("'extra' e registro antigo sem negócio gravam null", async () => {
    const { criarComissao } = await import("@/lib/actions/comissoes");
    await expect(criarComissao(form({ ...base, tipoNegocio: "extra", imovel: "Bônus", negocioId: "x" }))).rejects.toBeInstanceOf(Redirect);
    await expect(criarComissao(form({ ...base, tipoNegocio: "venda", negocioId: "" }))).rejects.toBeInstanceOf(Redirect);
    expect(comissaoCreate.mock.calls[0][0].data.negocioId).toBeNull();
    expect(comissaoCreate.mock.calls[1][0].data.negocioId).toBeNull();
  });
});
