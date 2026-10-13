// Itens 05/06 — cadastro dos cinco perfis com Postgres real (rode com TEST_DATABASE_URL).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "admin-teste", role: "admin" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => false }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("cadastro dos cinco perfis (item 05)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let a: typeof import("@/lib/actions/usuarios");
  const sufixo = Math.random().toString(36).slice(2, 8);
  const email = (n: string) => `${n}-${sufixo}@teste.local`;
  let leadId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    a = await import("@/lib/actions/usuarios");
    leadId = (await prisma.lead.create({ data: { nome: "Cliente Real", telefone: "1", servico: "construcao", email: email("lead") } })).id;
  });
  afterAll(async () => {
    const usuarios = await prisma.usuario.findMany({ where: { email: { endsWith: `${sufixo}@teste.local` } }, select: { id: true } });
    await prisma.corretor.deleteMany({ where: { usuarioId: { in: usuarios.map((u) => u.id) } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios.map((u) => u.id) } } });
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  function form(campos: Record<string, string | string[]>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) fd.append(k, x);
    return fd;
  }

  it("colaborador: só módulos conhecidos ficam gravados; sem senha gera link de primeiro acesso", async () => {
    const r = await a.criarUsuario(form({ nome: "Colab", email: email("colab"), papel: "colaborador", permissoes: ["obras", "leads", "inexistente"] }));
    expect(r).toMatchObject({ success: true, emailEnviado: false });
    expect((r as { link: string }).link).toMatch(/\/definir-senha\/[0-9a-f]{64}$/);
    const u = await prisma.usuario.findUniqueOrThrow({ where: { email: email("colab") } });
    expect(JSON.parse(u.permissoes)).toEqual(["obras", "leads"]);
    expect(u.tokenPrimeiroAcesso).toHaveLength(64);
  });
  it("corretor: exige CRECI e cria o cadastro de corretor ligado à conta", async () => {
    expect(await a.criarUsuario(form({ nome: "Cor", email: email("cor"), papel: "corretor" }))).toEqual({ error: "Corretor exige CRECI e telefone." });
    await a.criarUsuario(form({ nome: "Cor", email: email("cor"), papel: "corretor", creci: "123-F", telefone: "11999", senha: "senhaforte1" }));
    const u = await prisma.usuario.findUniqueOrThrow({ where: { email: email("cor") }, include: { corretor: true } });
    expect(u.corretor).toMatchObject({ creci: "123-F", email: email("cor") });
    expect(u.permissoes).toBe("[]");
  });
  it("cliente: ligado ao lead por ID, um lead só tem uma conta", async () => {
    expect(await a.criarUsuario(form({ nome: "Cli", email: email("cli"), papel: "cliente" }))).toMatchObject({ error: expect.stringContaining("cliente do CRM") });
    await a.criarUsuario(form({ nome: "Cli", email: email("cli"), papel: "cliente", leadId }));
    expect((await prisma.usuario.findUniqueOrThrow({ where: { email: email("cli") } })).leadId).toBe(leadId);
    expect(await a.criarUsuario(form({ nome: "Cli2", email: email("cli2"), papel: "cliente", leadId }))).toEqual({ error: "Este cliente do CRM já tem uma conta de acesso." });
  });
  it("empreiteiro e admin são criados; perfil inválido e e-mail repetido recusados", async () => {
    await a.criarUsuario(form({ nome: "Emp", email: email("emp"), papel: "empreiteiro" }));
    await a.criarUsuario(form({ nome: "Adm", email: email("adm"), papel: "admin", senha: "senhaforte1" }));
    expect(await prisma.usuario.count({ where: { email: { in: [email("emp"), email("adm")] } } })).toBe(2);
    expect(await a.criarUsuario(form({ nome: "X", email: email("x"), papel: "dono" }))).toEqual({ error: "Perfil inválido." });
    expect(await a.criarUsuario(form({ nome: "X", email: email("emp"), papel: "admin" }))).toEqual({ error: "E-mail já cadastrado." });
  });
  it("troca de perfil encerra a sessão antiga e limpa permissões fora do colaborador", async () => {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { email: email("colab") } });
    expect(await a.alterarPerfilUsuario(antes.id, "empreiteiro")).toEqual({ success: true });
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: antes.id } });
    expect(depois).toMatchObject({ papel: "empreiteiro", permissoes: "[]", sessionVersion: antes.sessionVersion + 1 });
  });
});
