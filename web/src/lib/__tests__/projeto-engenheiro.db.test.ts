// Item 07 — integração com Postgres real (rode com TEST_DATABASE_URL).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "admin-teste", role: "admin" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); } }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("Projetos: engenheiro por ID e validação (item 07)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let editarProjeto: typeof import("@/lib/actions/projetos").editarProjeto;
  const ids = { projeto: "", colab: "", inativo: "", corretor: "" };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ editarProjeto } = await import("@/lib/actions/projetos"));
    const sufixo = Math.random().toString(36).slice(2, 8);
    const usuario = (nome: string, papel: string, ativo = true) => prisma.usuario.create({ data: { nome, email: `${nome.replace(/\W/g, "")}-${sufixo}@teste.local`, senha: "x", papel, ativo } });
    ids.colab = (await usuario("Eng Ana", "colaborador")).id;
    ids.inativo = (await usuario("Eng Velho", "colaborador", false)).id;
    ids.corretor = (await usuario("Corretor Zé", "corretor")).id;
    ids.projeto = (await prisma.projeto.create({ data: { nome: "Projeto T", clienteNome: "Cliente", clienteTel: "1", engenheiro: "Fulano (texto antigo)", tipo: "[\"laudo_tecnico\"]" } })).id;
  });
  afterAll(async () => {
    await prisma.projeto.delete({ where: { id: ids.projeto } }).catch(() => undefined);
    await prisma.usuario.deleteMany({ where: { id: { in: [ids.colab, ids.inativo, ids.corretor] } } });
    await prisma.$disconnect();
  });

  function form(extra: Record<string, string | string[]>) {
    const fd = new FormData();
    const base: Record<string, string | string[]> = { id: ids.projeto, nome: "Projeto T", clienteNome: "Cliente", clienteTel: "11999999999", valorProjeto: "1000", tipos: ["laudo_tecnico"], ...extra };
    for (const [k, v] of Object.entries(base)) for (const x of [v].flat()) fd.append(k, x);
    return fd;
  }

  it("sem tipos: mensagem clara, nada é salvo", async () => {
    expect(await editarProjeto(form({ tipos: [], engenheiroId: ids.colab }))).toEqual({ erroAcao: "Selecione os tipos do projeto." });
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: ids.projeto } })).engenheiroId).toBeNull();
  });
  it("recusa inativo e quem não é colaborador", async () => {
    expect(await editarProjeto(form({ engenheiroId: ids.inativo }))).toEqual({ erroAcao: "Escolha um colaborador ativo como engenheiro responsável." });
    expect(await editarProjeto(form({ engenheiroId: ids.corretor }))).toEqual({ erroAcao: "Escolha um colaborador ativo como engenheiro responsável." });
  });
  it("registro anterior em texto é preservado enquanto não se escolhe colaborador", async () => {
    await expect(editarProjeto(form({ engenheiro: "Fulano (texto antigo)" }))).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    const p = await prisma.projeto.findUniqueOrThrow({ where: { id: ids.projeto } });
    expect(p.engenheiro).toBe("Fulano (texto antigo)");
    expect(p.engenheiroId).toBeNull();
    expect(await editarProjeto(form({ engenheiro: "Outro texto livre" }))).toEqual({ erroAcao: "Escolha o engenheiro responsável entre os colaboradores cadastrados." });
  });
  it("colaborador por ID: vincula e atualiza o nome exibido", async () => {
    await expect(editarProjeto(form({ engenheiroId: ids.colab, engenheiroRegistro: "CREA 123" }))).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    const p = await prisma.projeto.findUniqueOrThrow({ where: { id: ids.projeto } });
    expect(p).toMatchObject({ engenheiroId: ids.colab, engenheiro: "Eng Ana", engenheiroRegistro: "CREA 123" });
  });
});
