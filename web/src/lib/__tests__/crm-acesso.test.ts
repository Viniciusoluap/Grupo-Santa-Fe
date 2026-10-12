import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: { usuario: { findUnique: mocks.usuario } } }));
import { obterAtorCrm, escopoLeadsDoAtor, autorizarLeadDoAtor, exigirAtorInterno, type AtorCrm } from "../crm/acesso-lead";
const broker: AtorCrm = { id: "u1", nome: "Corretor", papel: "corretor", corretorId: "c1" };
beforeEach(() => vi.clearAllMocks());
describe("acesso CRM", () => {
  it("recusa sessão ausente, cliente, conta desativada ou corretor sem vínculo ativo", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(obterAtorCrm()).rejects.toThrow("Não autorizado");
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    for (const user of [{ ativo: true, papel: "cliente" }, { ativo: false, papel: "admin" }, { ativo: true, papel: "corretor", corretor: null }, { ativo: true, papel: "corretor", corretor: { id: "c1", ativo: false } }]) {
      mocks.usuario.mockResolvedValue(user); await expect(obterAtorCrm()).rejects.toThrow();
    }
  });
  it("usa papel e vínculo atuais do banco, desconsiderando papel informado no token", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "admin", corretorId: "other" } });
    mocks.usuario.mockResolvedValue({ id: "u1", nome: "Corretor", ativo: true, papel: "corretor", corretor: { id: "c1", ativo: true } });
    expect(await obterAtorCrm()).toEqual(broker);
  });
  it("limita corretor aos próprios leads e impede fallback sem vínculo", () => {
    expect(escopoLeadsDoAtor(broker)).toEqual({ corretorId: "c1" });
    expect(() => escopoLeadsDoAtor({ ...broker, corretorId: null })).toThrow();
    expect(() => autorizarLeadDoAtor(broker, { corretorId: "c2" })).toThrow();
    expect(() => autorizarLeadDoAtor(broker, { corretorId: "c1" })).not.toThrow();
    expect(() => exigirAtorInterno(broker)).toThrow();
    expect(escopoLeadsDoAtor({ ...broker, papel: "colaborador" })).toEqual({});
  });
});
