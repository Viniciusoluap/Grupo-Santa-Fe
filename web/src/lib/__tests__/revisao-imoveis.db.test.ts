// Pedido de 18/10 (itens 3 e 8): revisão dos imóveis do corretor igual à Prospecta.
// Cadastro e edição do corretor ficam pendentes e fora do site; recusado aparece por
// 3 dias; recusado excluído pela equipe vira aviso só com o título.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
type U = { id: string; nome: string; perfil: string; ativo: boolean; permissoes: string[]; corretorId: string | null };
const sessao = vi.hoisted(() => ({ u: null as U | null }));
vi.mock("@/lib/auth/modulos", () => ({
  exigirModuloAcao: async () => {
    if (!sessao.u) throw new Error("Não autorizado.");
    return sessao.u;
  },
  usuarioAtual: async () => sessao.u,
}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("revisão de imóveis do corretor (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let salvar: typeof import("@/lib/imoveis/salvar");
  let excluir: typeof import("@/lib/imoveis/excluir").excluirImovelDefinitivo;
  let portal: typeof import("@/lib/corretor/portal");
  let corretor: U;
  let outro: U;
  let admin: U;
  const criados: string[] = [];

  const form = (campos: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ titulo: "Casa Teste Revisão", tipo: "casa", preco: "350000", cidade: "Canaã dos Carajás", imagens: "[]", ...campos })) f.set(k, v);
    return f;
  };
  const doCorretor = async (usuarioId: string) => prisma.imovel.findFirstOrThrow({ where: { cadastradoPorId: usuarioId }, orderBy: { criadoEm: "desc" } });

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    salvar = await import("@/lib/imoveis/salvar");
    ({ excluirImovelDefinitivo: excluir } = await import("@/lib/imoveis/excluir"));
    portal = await import("@/lib/corretor/portal");
    const sufixo = Date.now();
    const mk = async (papel: string, nome: string) => {
      const u = await prisma.usuario.create({ data: { nome, email: `${nome}-${sufixo}@teste.local`, senha: "x", papel } });
      criados.push(u.id);
      return u;
    };
    const uc = await mk("corretor", "corretor-rev");
    const c = await prisma.corretor.create({ data: { nome: "Corretor Rev", email: `c-rev-${sufixo}@teste.local`, telefone: "0", creci: "1", usuarioId: uc.id } });
    corretor = { id: uc.id, nome: uc.nome, perfil: "corretor", ativo: true, permissoes: [], corretorId: c.id };
    const uo = await mk("corretor", "outro-rev");
    outro = { id: uo.id, nome: uo.nome, perfil: "corretor", ativo: true, permissoes: [], corretorId: null };
    const ua = await mk("admin", "admin-rev");
    admin = { id: ua.id, nome: ua.nome, perfil: "admin", ativo: true, permissoes: [], corretorId: null };
  });
  afterAll(async () => {
    await prisma.imovel.deleteMany({ where: { cadastradoPorId: { in: criados } } });
    await prisma.corretor.deleteMany({ where: { usuarioId: { in: criados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: criados } } });
    await prisma.$disconnect();
  });

  it("cadastro do corretor entra pendente, fora do site, como cadastro dele", async () => {
    sessao.u = corretor;
    await salvar.criarImovelCore(form({ publicadoSite: "on", revisaoStatus: "aprovado" }));
    const i = await doCorretor(corretor.id);
    expect(i).toMatchObject({ revisaoStatus: "pendente", publicadoSite: false, corretorId: corretor.corretorId, revisadoEm: null });
  });

  it("equipe aprova; edição do corretor volta para revisão e sai do site", async () => {
    const i = await doCorretor(corretor.id);
    sessao.u = admin;
    await salvar.editarImovelCore(form({ id: i.id, status: "venda", revisaoStatus: "aprovado", publicadoSite: "on" }));
    const aprovado = await prisma.imovel.findUniqueOrThrow({ where: { id: i.id } });
    expect(aprovado).toMatchObject({ revisaoStatus: "aprovado", publicadoSite: true });
    expect(aprovado.revisadoEm).not.toBeNull();

    sessao.u = corretor;
    await salvar.editarImovelCore(form({ id: i.id, titulo: "Casa Teste Revisão 2" }));
    expect(await prisma.imovel.findUniqueOrThrow({ where: { id: i.id } })).toMatchObject({
      titulo: "Casa Teste Revisão 2", revisaoStatus: "pendente", publicadoSite: false, revisadoEm: null, status: "venda",
    });
  });

  it("outro corretor não edita nem vê o pendente de quem cadastrou", async () => {
    const i = await doCorretor(corretor.id);
    sessao.u = outro;
    await expect(salvar.editarImovelCore(form({ id: i.id }))).rejects.toThrow(/seus cadastros/);
    expect((await portal.imoveisDoPortal(outro.id)).some((x) => x.id === i.id)).toBe(false);
  });

  it("recusado aparece por 3 dias; excluído pela equipe vira aviso só com o título", async () => {
    const i = await doCorretor(corretor.id);
    sessao.u = admin;
    await salvar.editarImovelCore(form({ id: i.id, titulo: "Casa Teste Revisão 2", status: "venda", revisaoStatus: "recusado" }));
    const lista = await portal.imoveisDoPortal(corretor.id);
    expect(lista.find((x) => x.id === i.id)).toMatchObject({ revisaoStatus: "recusado", meuCadastro: true, excluido: false });
    const depois = new Date(Date.now() + 4 * 24 * 3600 * 1000);
    expect((await portal.imoveisDoPortal(corretor.id, depois)).some((x) => x.id === i.id)).toBe(false);

    await excluir(i.id);
    const avisos = (await portal.imoveisDoPortal(corretor.id)).filter((x) => x.excluido);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ titulo: "Casa Teste Revisão 2", revisaoStatus: "recusado", preco: 0, cidade: "", bairro: "" });
    expect((await portal.imoveisDoPortal(corretor.id, depois)).some((x) => x.excluido)).toBe(false);
  });

  it("excluído sem recusa some na hora; o corretor que exclui o próprio não gera aviso", async () => {
    sessao.u = corretor;
    await salvar.criarImovelCore(form({ titulo: "Lote Some" }));
    const a = await doCorretor(corretor.id);
    await excluir(a.id);
    await salvar.criarImovelCore(form({ titulo: "Lote Recusado Próprio" }));
    const b = await doCorretor(corretor.id);
    await prisma.imovel.update({ where: { id: b.id }, data: { revisaoStatus: "recusado", revisadoEm: new Date() } });
    await excluir(b.id, { avisarCorretor: false });
    const lista = await portal.imoveisDoPortal(corretor.id);
    expect(lista.some((x) => x.titulo === "Lote Some" || x.titulo === "Lote Recusado Próprio")).toBe(false);
  });
});
