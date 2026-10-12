import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "contrato-1" })),
  update: vi.fn(async () => ({ id: "contrato-1" })),
  delete: vi.fn(async () => ({ id: "contrato-1" })),
  revalidate: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { role: "admin" } })) }));
vi.mock("@/lib/auth/rbac", () => ({ requireActionRole: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { contrato: mocks } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import AdminPage from "@/app/admin/page";
import { criarContrato, editarContrato, excluirContrato } from "@/lib/actions/contratos";

const src = resolve(__dirname, "../..");
const removedDirectories = [
  "app/admin/gestao", "app/admin/relatorios", "app/admin/feeds",
  "app/admin/agregador", "app/admin/contabilidade", "app/admin/contratos",
  "app/api/admin/relatorios", "app/api/admin/prospeccao", "app/api/feed",
  "app/api/dashboard/meta", "app/(site)/mercado",
];

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(file);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}

describe("remoção dos módulos independentes", () => {
  it("não deixa páginas ou endpoints nas rotas retiradas", () => {
    const remaining = removedDirectories.flatMap((directory) => sourceFiles(join(src, directory)));
    expect(remaining).toEqual([]);
  });

  it("não deixa navegação, fetch ou imports dos módulos retirados no runtime", () => {
    const obsolete = /["'`](?:\/admin\/(?:gestao|relatorios|feeds|agregador|contabilidade|contratos)(?:[/"'?`])|\/api\/feed\/|\/api\/admin\/(?:relatorios|prospeccao)|\/api\/dashboard\/meta|\/mercado["'?`]|@\/lib\/(?:actions\/(?:agregador|contabilidade)|(?:data|types)\/agregador))/;
    expect(sourceFiles(src).filter((file) => obsolete.test(readFileSync(file, "utf8")))).toEqual([]);
  });

  it("abre o CRM ao entrar no painel", () => {
    expect(() => AdminPage()).toThrow("REDIRECT:/admin/leads");
  });
});

describe("contratos preservados no Jurídico", () => {
  beforeEach(() => vi.clearAllMocks());

  function form() {
    const data = new FormData();
    data.set("id", "contrato-1");
    data.set("tipo", "prestacao_servicos");
    data.set("parteA", "Cliente");
    data.set("parteB", "Grupo Santa Fé");
    data.set("valor", "2500");
    return data;
  }

  it("cria o contrato e volta para uma página existente do Jurídico", async () => {
    await expect(criarContrato(form())).rejects.toThrow("REDIRECT:/admin/juridico");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ parteA: "Cliente", parteB: "Grupo Santa Fé", valor: 2500 }),
    }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin/juridico");
  });

  it("mantém edição e exclusão com atualização da página do Jurídico", async () => {
    await editarContrato(form());
    await excluirContrato("contrato-1");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "contrato-1" } }));
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "contrato-1" } });
    expect(mocks.revalidate).toHaveBeenCalledTimes(2);
    expect(mocks.revalidate).toHaveBeenLastCalledWith("/admin/juridico");
  });
});
