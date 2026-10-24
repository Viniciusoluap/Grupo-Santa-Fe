// Pedido de 24/10: "Documentos anteriores" com botão de excluir de vez (banco real).
// Gêmeo de Prospecta/server/lead-documento-exclusao.test.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => true }));
const drive = vi.hoisted(() => ({ lixeira: [] as string[], falha: false }));
vi.mock("@/lib/incorporacao/registro-drive", () => ({
  enviarParaLixeira: async (id: string) => { if (drive.falha) throw new Error("sem acesso"); drive.lixeira.push(id); },
}));
type U = { id: string; nome: string; perfil: string; ativo: boolean; permissoes: string[]; corretorId: string | null };
const sessao = vi.hoisted(() => ({ u: null as U | null }));
vi.mock("@/lib/auth/modulos", () => ({
  exigirModuloAcao: async () => { if (!sessao.u) throw new Error("Não autorizado."); return sessao.u; },
  usuarioAtual: async () => sessao.u,
}));
vi.mock("@/lib/crm/acesso-lead", () => ({
  obterAtorCrm: async () => ({ id: sessao.u!.id, nome: sessao.u!.nome, papel: "admin", corretorId: null }),
  autorizarLeadDoAtor: () => undefined,
}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("excluir documento anterior definitivamente (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let excluir: typeof import("@/lib/documentos-cliente").excluirDocumentoAnterior;
  const leads: string[] = [];
  const sufixo = Date.now();

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ excluirDocumentoAnterior: excluir } = await import("@/lib/documentos-cliente"));
  });
  beforeEach(() => { drive.lixeira = []; drive.falha = false; sessao.u = { id: "adm", nome: "Ana Admin", perfil: "admin", ativo: true, permissoes: [], corretorId: null }; });
  afterAll(async () => {
    await prisma.documentoCliente.deleteMany({ where: { leadId: { in: leads } } });
    await prisma.lead.deleteMany({ where: { id: { in: leads } } });
    await prisma.$disconnect();
  });

  async function docAnterior(tipo: string, driveFileId: string | null) {
    const lead = await prisma.lead.create({ data: { nome: `Doc ${tipo} ${sufixo}`, telefone: "0", servico: "[]" } });
    leads.push(lead.id);
    const arquivo = await prisma.arquivo.create({ data: { nome: "exigencia.pdf", mime: "application/pdf", tamanho: 1, driveFileId } });
    const doc = await prisma.documentoCliente.create({ data: { leadId: lead.id, tipo, arquivoId: arquivo.id, enviadoEm: new Date() } });
    return { lead, arquivo, doc };
  }

  it("apaga registro e arquivo, manda o do Drive para a lixeira e registra na timeline", async () => {
    const { lead, arquivo, doc } = await docAnterior("income_proof_irpf", `drv-${sufixo}`);
    expect(await excluir(doc.id)).toEqual({ aviso: null, leadId: lead.id });
    expect(await prisma.documentoCliente.findUnique({ where: { id: doc.id } })).toBeNull();
    expect(await prisma.arquivo.findUnique({ where: { id: arquivo.id } })).toBeNull();
    expect(drive.lixeira).toEqual([`drv-${sufixo}`]);
    expect(await prisma.interacao.findFirst({ where: { leadId: lead.id, descricao: { contains: "excluído definitivamente" } } })).not.toBeNull();
  });

  it("arquivo usado por outro lead (duplicado) fica; só o registro sai", async () => {
    const { arquivo, doc } = await docAnterior("cnh", null);
    const outro = await prisma.lead.create({ data: { nome: `Dup ${sufixo}`, telefone: "0", servico: "[]" } });
    leads.push(outro.id);
    await prisma.documentoCliente.create({ data: { leadId: outro.id, tipo: "cnh", arquivoId: arquivo.id } });
    await excluir(doc.id);
    expect(await prisma.arquivo.findUnique({ where: { id: arquivo.id } })).not.toBeNull();
  });

  it("falha no Drive não impede a exclusão e devolve aviso", async () => {
    drive.falha = true;
    const { doc } = await docAnterior("cnh", `drv2-${sufixo}`);
    expect((await excluir(doc.id)).aviso).toMatch(/lixeira do Google Drive/);
    expect(await prisma.documentoCliente.findUnique({ where: { id: doc.id } })).toBeNull();
  });

  it("documento da lista atual e cliente não são excluídos por aqui", async () => {
    const lead = await prisma.lead.create({ data: { nome: `Atual ${sufixo}`, telefone: "0", servico: "[]" } });
    leads.push(lead.id);
    const atual = await prisma.documentoCliente.create({ data: { leadId: lead.id, tipo: "rg" } });
    await expect(excluir(atual.id)).rejects.toThrow(/Somente documentos anteriores/);
    const { doc } = await docAnterior("cnh", null);
    sessao.u = { id: "cli", nome: "Cliente", perfil: "cliente", ativo: true, permissoes: [], corretorId: null };
    await expect(excluir(doc.id)).rejects.toThrow();
  });
});
