// Paridade 17/11, bloco 1 — EPIC-023 S-A (correção 2) da Prospecta: a tela "Corretores" foi unificada em
// "Usuários e acesso"; o cadastro de corretores fica só com o admin (decisão do dono em 15/11).
// Cenários portados de Prospecta/server/admin-permissions.test.ts, operacional.test.ts e colaborador-modulos.test.ts
// (commit 204ac53), mais os próprios do Santa Fé (corretor sem conta, link de acesso, migração).
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sessao: { user: { id: "admin-1", role: "admin", permissoes: undefined as string[] | undefined } } as { user: { id: string; role: string; permissoes?: string[] } },
  corretor: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  usuario: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  regra: { deleteMany: vi.fn(), upsert: vi.fn() },
  updateMany: vi.fn(),
  transacao: vi.fn(),
  email: vi.fn(async () => true),
  redirect: vi.fn((p: string) => { throw new Error(`REDIRECT:${p}`); }),
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => m.sessao) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/email", () => ({ sendEmail: m.email }));
vi.mock("@/lib/drive-organizacao", () => ({ lixeiraDaPasta: vi.fn() }));
vi.mock("@/lib/db", () => {
  const tx = {
    usuario: m.usuario, corretor: m.corretor, regraComissaoCorretor: m.regra,
    lead: { updateMany: m.updateMany, findUnique: vi.fn() }, visita: { updateMany: m.updateMany }, comissao: { updateMany: m.updateMany },
    financiamento: { updateMany: m.updateMany }, imovel: { updateMany: m.updateMany }, perfilEngenheiro: { create: vi.fn() },
  };
  return { prisma: { ...tx, $transaction: async (arg: unknown) => { m.transacao(arg); return typeof arg === "function" ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as unknown[]); } } };
});

import { criarUsuario, enviarLinkAcesso, salvarDadosCorretor } from "@/lib/actions/usuarios";
import { excluirCorretor } from "@/lib/actions/corretores";
import { IDS_MODULOS_PAINEL, MODULOS_PAINEL } from "@/lib/auth/modulos-lista";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { lerConvite, lerObservacoesCorretor } from "@/lib/usuarios/corretor-cadastro";
import { casaBusca, filtrarItens } from "@/lib/usuarios/filtro";
import CorretoresRedireciona from "@/app/admin/corretores/[[...rota]]/page";

function form(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}
const colaboradorComTudo = () => { m.sessao = { user: { id: "colab-1", role: "colaborador", permissoes: [...IDS_MODULOS_PAINEL, "corretores"] } }; };

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao = { user: { id: "admin-1", role: "admin" } };
  m.usuario.findUnique.mockResolvedValue(null);
  m.usuario.findFirst.mockResolvedValue(null);
  m.usuario.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "u-novo", ...data }));
  m.corretor.findUnique.mockResolvedValue(null);
  m.corretor.findFirst.mockResolvedValue(null);
});

describe("Corretores deixou de ser módulo (EPIC-023, decisão do dono em 15/11)", () => {
  it("não está mais entre os módulos do painel nem no menu de permissões", () => {
    expect(IDS_MODULOS_PAINEL).not.toContain("corretores");
    expect(MODULOS_PAINEL.map((x) => x.rota)).not.toContain("/admin/corretores");
  });

  it("colaborador com todos os módulos (e 'corretores' antigo gravado) não edita, não exclui nem cria corretor", async () => {
    colaboradorComTudo();
    await expect(salvarDadosCorretor(form({ id: "c1", nome: "A", email: "a@x", telefone: "1", creci: "1" }))).rejects.toThrow("Não autorizado.");
    await expect(excluirCorretor("c1")).rejects.toThrow("Não autorizado.");
    await expect(criarUsuario(form({ nome: "C", email: "c@x", papel: "corretor", creci: "1", telefone: "1" }))).rejects.toThrow("Não autorizado.");
    expect(m.corretor.update).not.toHaveBeenCalled();
    expect(m.corretor.delete).not.toHaveBeenCalled();
    // As comissões continuam no módulo próprio.
    expect(podeAcessarModulo({ perfil: "colaborador", ativo: true, permissoes: ["comissoes"] }, "comissoes")).toBe(true);
  });

  it("rotas antigas de Corretores caem em Usuários e acesso filtrado em Corretor", () => {
    expect(() => CorretoresRedireciona()).toThrow("REDIRECT:/admin/configuracoes?perfil=corretor");
  });
});

describe("cadastro de corretor em Usuários e acesso (só admin)", () => {
  it("cria corretor com comissão padrão e observações; convite por e-mail é o padrão", async () => {
    const r = await criarUsuario(form({ nome: "Cor", email: "Cor@X.com", papel: "corretor", creci: "123-F", telefone: "94999", percentualComissaoPadrao: "2,5", observacoes: "  Parceiro da Caixa  " }));
    expect(r).toMatchObject({ success: true, emailEnviado: true });
    expect(m.usuario.create.mock.calls[0][0].data.tokenPrimeiroAcesso).toHaveLength(64);
    expect(m.corretor.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      email: "cor@x.com", creci: "123-F", usuarioId: "u-novo", observacoes: "Parceiro da Caixa", regraComissao: { create: { percentual: "2.5" } },
    }) });
    expect(m.email).toHaveBeenCalledTimes(1);
  });

  it("cria corretor SEM e-mail de senha: sem link, sem envio, conta criada", async () => {
    const r = await criarUsuario(form({ nome: "Cor", email: "c2@x", papel: "corretor", creci: "1", telefone: "1", enviarConvite: "nao" }));
    expect(r).toEqual({ success: true, convidado: false });
    expect(m.usuario.create.mock.calls[0][0].data).toMatchObject({ papel: "corretor", tokenPrimeiroAcesso: null, tokenPrimeiroAcessoExpira: null });
    expect(m.email).not.toHaveBeenCalled();
    // Sem comissão digitada, nenhuma regra é inventada (vazio = sem regra).
    expect(m.corretor.create.mock.calls[0][0].data).not.toHaveProperty("regraComissao");
  });

  it("só o corretor pode nascer sem convite: para os demais perfis o pedido é ignorado", async () => {
    const r = await criarUsuario(form({ nome: "Colab", email: "co@x", papel: "colaborador", enviarConvite: "nao" }));
    expect(r).toMatchObject({ success: true, link: expect.stringMatching(/\/definir-senha\/[0-9a-f]{64}$/) });
    expect(m.email).toHaveBeenCalledTimes(1);
  });

  it("comissão inválida é recusada antes do banco (mesma regra da Prospecta: 0 a 100, até 4 casas)", async () => {
    expect(await criarUsuario(form({ nome: "Cor", email: "c3@x", papel: "corretor", creci: "1", telefone: "1", percentualComissaoPadrao: "101" }))).toMatchObject({ error: expect.stringContaining("Percentual de comissão inválido") });
    expect(m.usuario.create).not.toHaveBeenCalled();
  });

  it("edita os dados do corretor com conta: comissão, observações e login sincronizado", async () => {
    m.corretor.findUnique.mockResolvedValue({ id: "c1", usuarioId: "u1" });
    const r = await salvarDadosCorretor(form({ id: "c1", nome: " Ana ", email: "ANA@x.com", telefone: "94 9", creci: "9-F", percentualComissaoPadrao: "3", observacoes: "obs", ativo: "true" }));
    expect(r).toEqual({ success: true });
    expect(m.corretor.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { nome: "Ana", email: "ana@x.com", telefone: "94 9", creci: "9-F", ativo: true, observacoes: "obs" } });
    expect(m.regra.upsert).toHaveBeenCalledWith({ where: { corretorId: "c1" }, create: { corretorId: "c1", percentual: "3" }, update: { percentual: "3" } });
    expect(m.usuario.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { nome: "Ana", email: "ana@x.com", telefone: "94 9", creci: "9-F" } });
  });

  it("corretor sem conta: comissão vazia remove a regra; nenhuma conta é tocada", async () => {
    m.corretor.findUnique.mockResolvedValue({ id: "c2", usuarioId: null });
    await salvarDadosCorretor(form({ id: "c2", nome: "Bia", email: "b@x", telefone: "1", creci: "2", percentualComissaoPadrao: "", ativo: "false" }));
    expect(m.regra.deleteMany).toHaveBeenCalledWith({ where: { corretorId: "c2" } });
    expect(m.corretor.update.mock.calls[0][0].data).toMatchObject({ ativo: false, observacoes: "" });
    expect(m.usuario.update).not.toHaveBeenCalled();
  });

  it("e-mail de outra pessoa e campos obrigatórios vazios são recusados", async () => {
    m.corretor.findUnique.mockResolvedValue({ id: "c1", usuarioId: "u1" });
    m.usuario.findFirst.mockResolvedValue({ id: "u-outro" });
    expect(await salvarDadosCorretor(form({ id: "c1", nome: "A", email: "x@x", telefone: "1", creci: "1" }))).toEqual({ error: "E-mail já cadastrado." });
    expect(await salvarDadosCorretor(form({ id: "c1", nome: "A", email: "x@x", telefone: "", creci: "1" }))).toEqual({ error: "Nome, CRECI, telefone e e-mail são obrigatórios." });
    expect(m.corretor.update).not.toHaveBeenCalled();
  });

  it("o link de acesso pode ser enviado depois (corretor cadastrado sem convite)", async () => {
    m.usuario.findUnique.mockResolvedValue({ id: "u1", nome: "Cor", email: "c@x", ativo: true });
    const r = await enviarLinkAcesso("u1");
    expect(r).toMatchObject({ success: true, emailEnviado: true, link: expect.stringMatching(/\/definir-senha\/[0-9a-f]{64}$/) });
    const data = m.usuario.update.mock.calls[0][0].data;
    expect(data.tokenPrimeiroAcesso).toHaveLength(64);
    expect(data.tokenPrimeiroAcessoExpira.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600_000);
    m.usuario.findUnique.mockResolvedValue({ id: "u2", nome: "X", email: "x@x", ativo: false });
    expect(await enviarLinkAcesso("u2")).toEqual({ error: "Ative o usuário antes de enviar o link de acesso." });
    colaboradorComTudo();
    await expect(enviarLinkAcesso("u1")).rejects.toThrow("Não autorizado.");
  });

  it("admin exclui o corretor e os vínculos ficam sem corretor (comissões preservadas)", async () => {
    m.corretor.findUnique.mockResolvedValue({ usuarioId: null });
    await excluirCorretor("c9");
    expect(m.updateMany).toHaveBeenCalledWith({ where: { corretorId: "c9" }, data: { corretorId: null } });
    expect(m.corretor.delete).toHaveBeenCalledWith({ where: { id: "c9" } });
  });
});

describe("busca e situação da lista", () => {
  const itens = [
    { nome: "Ana", ativo: true, textos: ["Ana Souza", "ana@x.com", "123-F", "94 99999"] },
    { nome: "Bia", ativo: false, textos: ["Bia", "bia@x.com", null, undefined] },
  ];
  it("busca por nome, e-mail, CRECI ou telefone, sem diferenciar maiúsculas", () => {
    expect(casaBusca(itens[0].textos, "SOUZA")).toBe(true);
    expect(casaBusca(itens[0].textos, "123-f")).toBe(true);
    expect(casaBusca(itens[0].textos, "99999")).toBe(true);
    expect(casaBusca(itens[1].textos, "123")).toBe(false);
    expect(casaBusca(itens[1].textos, "   ")).toBe(true);
  });
  it("situação combina com a busca", () => {
    expect(filtrarItens(itens, { busca: "", situacao: "todos" }).map((i) => i.nome)).toEqual(["Ana", "Bia"]);
    expect(filtrarItens(itens, { busca: "", situacao: "ativos" }).map((i) => i.nome)).toEqual(["Ana"]);
    expect(filtrarItens(itens, { busca: "x.com", situacao: "inativos" }).map((i) => i.nome)).toEqual(["Bia"]);
    expect(filtrarItens(itens, { busca: "ana", situacao: "inativos" })).toEqual([]);
  });
  it("observações e convite: limites", () => {
    expect(lerObservacoesCorretor("  a  ")).toBe("a");
    expect(lerObservacoesCorretor(null)).toBe("");
    expect(() => lerObservacoesCorretor("x".repeat(5001))).toThrow(/5000/);
    expect(lerConvite(null)).toBe(true);
    expect(lerConvite("sim")).toBe(true);
    expect(lerConvite("nao")).toBe(false);
  });
});

describe("migração 20261117100000_corretor_observacoes", () => {
  it("é aditiva e idempotente (PGlite)", async () => {
    const pg = new PGlite();
    await pg.exec(`CREATE TABLE corretores (id TEXT PRIMARY KEY, nome TEXT NOT NULL)`);
    await pg.exec(`INSERT INTO corretores (id, nome) VALUES ('c1', 'Ana')`);
    const sql = readFileSync(new URL("../../../prisma/migrations/20261117100000_corretor_observacoes/migration.sql", import.meta.url), "utf8");
    await pg.exec(sql); await pg.exec(sql);
    expect((await pg.query("SELECT id, nome, observacoes FROM corretores")).rows).toEqual([{ id: "c1", nome: "Ana", observacoes: "" }]);
    await expect(pg.exec(`UPDATE corretores SET observacoes = NULL`)).rejects.toThrow();
  }, 30000);
});
