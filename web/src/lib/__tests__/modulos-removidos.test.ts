import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "contrato-1" })),
  findUniqueOrThrow: vi.fn(async () => ({ tipo: "prestacao_servicos" })),
  opcoesContrato: vi.fn(),
  update: vi.fn(async () => ({ id: "contrato-1" })),
  delete: vi.fn(async () => ({ id: "contrato-1" })),
  revalidate: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { role: "admin" } })) }));
vi.mock("@/lib/auth/rbac", () => ({ requireActionRole: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { contrato: mocks } }));
vi.mock("@/lib/contratos/dados", () => ({ opcoesModelosContrato: mocks.opcoesContrato }));
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

  it("abre o CRM ao entrar no painel (admin: primeiro módulo liberado)", async () => {
    await expect(AdminPage()).rejects.toThrow("REDIRECT:/admin/leads");
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

  it("cria o novo contrato no Jurídico com a obra e as partes vinculadas", async () => {
    mocks.opcoesContrato.mockResolvedValue({
      obras: [{
        id: "obra-1", leadId: "lead-1", imovelId: "imovel-1", cliente: "Cliente",
        cpfCliente: "123.456.789-09", enderecoImovel: "Rua A, 30", foro: "Canaã dos Carajás/PA",
        area: "78", matricula: "547", cartorio: "Registro de Imóveis", prazo: "6",
        valorExecucao: "135000.00", corretorId: "",
      }],
      empreiteiros: [{ id: "empreiteiro-1", nome: "Empreiteiro", documento: "987.654.321-00", endereco: "Rua B, 20" }],
      corretores: [],
    });
    const dados = new FormData();
    dados.set("tipo", "execucao_obra");
    dados.set("obraId", "obra-1");
    dados.set("empreiteiroId", "empreiteiro-1");
    dados.set("empresaNome", "Grupo Santa Fé");
    dados.set("empresaDocumento", "41.865.900/0001-89");
    dados.set("empresaEndereco", "Rua C, 10");
    dados.set("dataAssinatura", "2026-11-09");
    await expect(criarContrato(dados)).resolves.toEqual({ ok: true, id: "contrato-1" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        parteA: "Grupo Santa Fé", parteB: "Empreiteiro", valor: 135000,
        obraId: "obra-1", leadId: "lead-1", imovelId: "imovel-1", empreiteiroId: "empreiteiro-1",
      }),
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
