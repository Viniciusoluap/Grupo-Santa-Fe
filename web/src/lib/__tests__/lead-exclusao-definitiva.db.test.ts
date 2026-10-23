// Pedido de 23/10 (H3): exclusão definitiva de lead arquivado, com banco real.
// Mesma regra em Prospecta/server/lead-exclusao-definitiva.test.ts.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mensagemBloqueioExclusao, resumoVinculosLead } from "@/lib/crm/lead-exclusao-definitiva";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => null }));
const ator = vi.hoisted(() => ({ papel: "admin" as "admin" | "colaborador" }));
vi.mock("@/lib/crm/acesso-lead", async (original) => ({
  ...await original<typeof import("@/lib/crm/acesso-lead")>(),
  obterAtorCrm: async () => ({ id: "teste", nome: "Teste", papel: ator.papel, corretorId: null }),
}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe("resumo dos vínculos (mesmas frases da Prospecta)", () => {
  const SEM = { obras: 0, financiamentos: 0, regularizacoes: 0, projetos: 0, avaliacoes: 0, contratos: 0, documentos: 0, contas: 0 };
  it("singular/plural e null sem vínculos", () => {
    expect(mensagemBloqueioExclusao(SEM)).toBeNull();
    expect(resumoVinculosLead({ ...SEM, obras: 1, documentos: 2, financiamentos: 1 })).toBe("1 obra, 1 financiamento e 2 documentos");
  });
});

describe.skipIf(!url)("exclusão definitiva de lead arquivado (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let acoes: typeof import("@/lib/actions/leads");
  const criados: string[] = [];
  const novoLead = async (dados: { arquivadoEm?: Date | null; excluidoEm?: Date | null } = {}) => {
    const l = await prisma.lead.create({ data: { nome: "Lead H3", telefone: "62999990000", servico: "construcao", ...dados } });
    criados.push(l.id);
    return l.id;
  };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    acoes = await import("@/lib/actions/leads");
  });
  afterAll(async () => {
    await prisma.obra.deleteMany({ where: { leadId: { in: criados } } });
    await prisma.lead.deleteMany({ where: { id: { in: criados } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("colaborador não pode; lead ativo é recusado", async () => {
    const arquivado = await novoLead({ arquivadoEm: new Date() });
    ator.papel = "colaborador";
    expect(await acoes.excluirLeadDefinitivamente(arquivado)).toMatchObject({ ok: false, erro: expect.stringContaining("administrador") });
    ator.papel = "admin";
    const ativo = await novoLead();
    expect(await acoes.excluirLeadDefinitivamente(ativo)).toMatchObject({ ok: false, erro: expect.stringContaining("arquivados") });
    expect(await prisma.lead.count({ where: { id: { in: [arquivado, ativo] } } })).toBe(2);
  });

  it("com obra vinculada avisa e preserva", async () => {
    const id = await novoLead({ arquivadoEm: new Date() });
    await prisma.obra.create({ data: { nome: "Obra H3", clienteNome: "C", clienteTel: "1", leadId: id } });
    expect(await acoes.consultarExclusaoDefinitivaLead(id)).toEqual({ bloqueio: expect.stringContaining("1 obra") });
    expect(await acoes.excluirLeadDefinitivamente(id)).toMatchObject({ ok: false, erro: expect.stringContaining("1 obra") });
    expect(await prisma.lead.findUnique({ where: { id } })).not.toBeNull();
  });

  it("arquivado sem vínculos: apaga lead, histórico e tarefas", async () => {
    const id = await novoLead({ excluidoEm: new Date() });
    await prisma.interacao.create({ data: { leadId: id, tipo: "nota", descricao: "x", criadoPor: "t" } });
    await prisma.tarefaCrm.create({ data: { leadId: id, titulo: "Ligar" } });
    expect(await acoes.consultarExclusaoDefinitivaLead(id)).toEqual({ bloqueio: null });
    expect(await acoes.excluirLeadDefinitivamente(id)).toEqual({ ok: true });
    expect(await prisma.lead.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.interacao.count({ where: { leadId: id } })).toBe(0);
    expect(await prisma.tarefaCrm.count({ where: { leadId: id } })).toBe(0);
  });
});
