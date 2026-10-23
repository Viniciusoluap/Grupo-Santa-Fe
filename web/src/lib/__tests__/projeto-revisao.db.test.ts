// Lote 23/10, etapa 2C: "Solicitar revisão" de projeto — pedido salvo com autor e
// estado, avisos honestos por canal e histórico preservado (banco real).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const email = vi.hoisted(() => ({ ok: true, chamadas: [] as { to: string; subject: string }[] }));
vi.mock("@/lib/email", () => ({ sendEmail: async (d: { to: string; subject: string }) => { email.chamadas.push(d); return email.ok; } }));
type U = { id: string; nome: string; perfil: string; ativo: boolean; permissoes: string[]; corretorId: string | null };
const sessao = vi.hoisted(() => ({ u: null as U | null }));
vi.mock("@/lib/auth/modulos", () => ({
  exigirModuloAcao: async () => { if (!sessao.u) throw new Error("Não autorizado."); return sessao.u; },
  exigirModuloPagina: async () => sessao.u,
  usuarioAtual: async () => sessao.u,
}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("projetos — solicitar revisão (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let solicitar: typeof import("@/lib/actions/projetos").solicitarRevisaoProjeto;
  const usuarios: string[] = [];
  const projetos: string[] = [];
  let engenheiroId = "";
  let engenheiroSemEmailId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ solicitarRevisaoProjeto: solicitar } = await import("@/lib/actions/projetos"));
    const sufixo = Date.now();
    const mk = async (papel: string, nome: string, mail: string) => { const u = await prisma.usuario.create({ data: { nome, email: mail, senha: "x", papel } }); usuarios.push(u.id); return u; };
    const admin = await mk("admin", "Ana Admin", `adm-rev-${sufixo}@teste.local`);
    engenheiroId = (await mk("colaborador", "Eng. Carla", `eng-rev-${sufixo}@teste.local`)).id;
    engenheiroSemEmailId = (await mk("colaborador", "Eng. Sem Email", `sem-${sufixo}@teste.local`)).id;
    sessao.u = { id: admin.id, nome: admin.nome, perfil: "admin", ativo: true, permissoes: [], corretorId: null };
  });
  beforeEach(() => { email.ok = true; email.chamadas = []; });
  afterAll(async () => {
    await prisma.projeto.deleteMany({ where: { id: { in: projetos } } });
    await prisma.notificacao.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    await prisma.$disconnect();
  });
  const novoProjeto = async (engId: string | null) => {
    const p = await prisma.projeto.create({ data: { nome: "Casa Revisão", clienteNome: "João", clienteTel: "0", engenheiroId: engId, engenheiro: engId ? "Eng" : null } });
    projetos.push(p.id);
    return p.id;
  };

  it("salva com autor e avisa o colaborador no sistema e por e-mail", async () => {
    const id = await novoProjeto(engenheiroId);
    const r = await solicitar(id, "  Ajustar planta baixa  ");
    expect(r).toMatchObject({ notificacao: "enviado", email: "enviado", mensagem: { tipo: "ok" } });
    const salvo = await prisma.projetoRevisao.findFirstOrThrow({ where: { projetoId: id } });
    expect(salvo).toMatchObject({ texto: "Ajustar planta baixa", status: "pendente", solicitadoPorNome: "Ana Admin", colaboradorId: engenheiroId, situacaoNotificacao: "enviado", situacaoEmail: "enviado", entregas: "[]" });
    expect(await prisma.notificacao.count({ where: { usuarioId: engenheiroId, link: `/admin/projetos/${id}` } })).toBe(1);
    expect(email.chamadas[0].subject).toContain("Revisão solicitada");
  });

  it("sem colaborador: salva e avisa que ninguém foi notificado", async () => {
    const id = await novoProjeto(null);
    const r = await solicitar(id, "Trocar fachada");
    expect(r).toMatchObject({ notificacao: "sem_destinatario", email: "sem_destinatario", mensagem: { tipo: "aviso" } });
    expect(email.chamadas).toHaveLength(0);
    expect(await prisma.projetoRevisao.count({ where: { projetoId: id, situacaoNotificacao: "sem_destinatario" } })).toBe(1);
  });

  it("falha no e-mail fica registrada como falhou, nunca enviado", async () => {
    const id = await novoProjeto(engenheiroSemEmailId);
    email.ok = false;
    const r = await solicitar(id, "Detalhe da escada");
    expect(r).toMatchObject({ notificacao: "enviado", email: "falhou", mensagem: { tipo: "aviso" } });
  });

  it("rejeita pedido vazio sem gravar e preserva histórico de pedidos", async () => {
    const id = await novoProjeto(engenheiroId);
    expect(await solicitar(id, "   ")).toMatchObject({ erroAcao: "Descreva a modificação solicitada." });
    await solicitar(id, "Primeira");
    await solicitar(id, "Segunda");
    expect(await prisma.projetoRevisao.count({ where: { projetoId: id } })).toBe(2);
  });
});
