// Paridade 17/11 bloco 4 — termo de consentimento (gêmeo de Prospecta/server/consentimento.test.ts). PostgreSQL isolado em
// memória (PGlite) com o Prisma real: as tabelas vêm do prisma/schema.prisma e a "consentimentos" é recriada pela
// migração 20261117400000 (aplicada duas vezes: idempotência; gatilho e CHECKs valem nos testes).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148", sessao: null as null | { user: { id: string; role: string } } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Map([["user-agent", harness.ua]]) }));
vi.mock("@/lib/db", () => ({ get prisma() { return harness.prisma; } }));
vi.mock("@/auth", () => ({ auth: async () => harness.sessao }));

import { definirSenhaPrimeiroAcesso } from "@/lib/actions/primeiro-acesso";
import { aceitarTermoNoLogin, registrarRetiradaPeloAdmin, retirarMeuConsentimento } from "@/lib/actions/consentimento";
import { aceitesDoUsuario, INICIO_DO_TERMO, MENSAGEM_FALHA_AO_VERIFICAR, pedirAceiteNoLogin, resumoDoTermoParaAdmin, situacaoDosRegistros, situacaoNoLink, situacaoNoLogin } from "@/lib/consentimento";
import { MENSAGEM_SEM_ACEITE, MENSAGEM_SEM_CONSENTIMENTO_ATIVO, MENSAGEM_VERSAO_ERRADA, VERSAO_DO_TERMO } from "@/lib/termo-consentimento";

const MIGRACAO = "prisma/migrations/20261117400000_consentimentos/migration.sql";
const sql = () => readFileSync(MIGRACAO, "utf8");

function ddlBase(): string {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const cache = join(tmpdir(), `sf-consentimento-ddl-${createHash("sha1").update(schema).digest("hex").slice(0, 12)}.sql`);
  if (existsSync(cache)) return readFileSync(cache, "utf8");
  const require = createRequire(import.meta.url);
  const ddl = execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
    encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://teste@127.0.0.1:1/isolado" }, maxBuffer: 10 * 1024 * 1024,
  });
  writeFileSync(cache, ddl);
  return ddl;
}

let pg: PGlite;
let socket: PGLiteSocketServer;
let pool: Pool;
beforeAll(async () => {
  pg = await PGlite.create();
  await pg.exec(ddlBase());
  await pg.exec(`DROP TABLE "consentimentos"`);
  await pg.exec(sql());
  await pg.exec(sql()); // idempotente
  socket = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 0 });
  await socket.start();
  pool = new Pool({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1 });
  harness.prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
}, 120_000);
afterAll(async () => { await harness.prisma?.$disconnect(); await pool?.end(); await socket?.stop(); await pg?.close(); });

const futuro = () => new Date(Date.now() + 6 * 24 * 3600 * 1000);
const linhas = async () => (await pg.query<Record<string, unknown>>(`SELECT * FROM consentimentos ORDER BY id`)).rows;
const como = (id: string, role: string) => { harness.sessao = { user: { id, role } }; };

async function conta(id: string, opcoes: { criadoEm?: Date; token?: string | null; papel?: string } = {}) {
  await harness.prisma.usuario.create({ data: {
    id, nome: `Nome ${id}`, email: `${id}@teste.invalid`, senha: "placeholder", papel: opcoes.papel ?? "colaborador",
    criadoEm: opcoes.criadoEm ?? new Date("2026-11-20T12:00:00Z"),
    tokenPrimeiroAcesso: opcoes.token === undefined ? `tok-${id}` : opcoes.token, tokenPrimeiroAcessoExpira: opcoes.token === null ? null : futuro(),
  } });
  return id;
}

beforeEach(async () => {
  harness.sessao = null;
  harness.ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148";
  delete process.env.CONSENTIMENTO_PEDIR_NO_LOGIN;
  // A tabela é só de inclusão: para zerar entre os testes, recriamos pela migração.
  await pg.exec(`DROP TABLE "consentimentos"; TRUNCATE "usuarios" CASCADE;`);
  await pg.exec(sql());
});

describe("migração 20261117400000_consentimentos", () => {
  it("é idempotente, liga o RLS e a tabela é só de inclusão (UPDATE, DELETE e TRUNCATE recusados)", async () => {
    await pg.exec(sql());
    expect((await pg.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'consentimentos'`)).rows).toEqual([{ relrowsecurity: true }]);
    await pg.exec(`INSERT INTO consentimentos ("usuarioId", "versaoTermo", canal) VALUES ('u', 'v', 'login')`);
    await expect(pg.exec(`UPDATE consentimentos SET "versaoTermo" = 'x'`)).rejects.toThrow(/CONSENTIMENTO_SO_INCLUSAO/);
    await expect(pg.exec(`DELETE FROM consentimentos`)).rejects.toThrow(/CONSENTIMENTO_SO_INCLUSAO/);
    await expect(pg.exec(`TRUNCATE consentimentos`)).rejects.toThrow(/CONSENTIMENTO_SO_INCLUSAO/);
    await expect(pg.exec(`INSERT INTO consentimentos ("usuarioId", "versaoTermo", canal) VALUES ('u', 'v', 'qualquer')`)).rejects.toThrow();
    await expect(pg.exec(`INSERT INTO consentimentos ("usuarioId", "versaoTermo", canal, tipo) VALUES ('u', 'v', 'admin', 'revogacao')`)).rejects.toThrow();
    await expect(pg.exec(`INSERT INTO consentimentos ("usuarioId", "versaoTermo", canal, tipo, "registradoPor") VALUES ('u', 'v', 'login', 'revogacao', 'a')`)).rejects.toThrow();
    const colunas = (await pg.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'consentimentos' ORDER BY 1`)).rows.map(r => r.column_name);
    expect(colunas).toEqual(["aparelho", "canal", "comSenha", "id", "registradoEm", "registradoPor", "tipo", "usuarioId", "versaoTermo"]);
  });
});

describe("primeiro acesso: o servidor exige o aceite", () => {
  it("sem a caixa a senha NÃO é gravada; versão errada recusada; com o aceite, senha e aceite juntos e o link não serve de novo", async () => {
    await conta("ana");
    expect(situacaoNoLink(await aceitesDoUsuario("ana"))).toBe("obrigatorio");
    expect(await definirSenhaPrimeiroAcesso("tok-ana", "senha-forte-1")).toEqual({ error: MENSAGEM_SEM_ACEITE });
    expect(await definirSenhaPrimeiroAcesso("tok-ana", "senha-forte-1", true, "velha")).toEqual({ error: MENSAGEM_VERSAO_ERRADA });
    expect((await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "ana" } })).senha).toBe("placeholder");
    expect(await linhas()).toEqual([]);
    expect(await definirSenhaPrimeiroAcesso("tok-ana", "senha-forte-1", true, VERSAO_DO_TERMO)).toEqual({ success: true });
    const u = await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "ana" } });
    expect(u.senha).not.toBe("placeholder");
    expect(u.tokenPrimeiroAcesso).toBeNull();
    expect(await linhas()).toMatchObject([{ usuarioId: "ana", versaoTermo: VERSAO_DO_TERMO, canal: "definir_senha", aparelho: "celular", comSenha: true, tipo: "aceite", registradoPor: null }]);
    expect(await definirSenhaPrimeiroAcesso("tok-ana", "outra-senha-2", true, VERSAO_DO_TERMO)).toEqual({ error: "Link inválido ou já utilizado" });
    expect(await linhas()).toHaveLength(1);
  });

  it("falha ao gravar o aceite desfaz a senha (mesma transação)", async () => {
    await conta("bia");
    await pg.exec(`ALTER TABLE consentimentos ADD CONSTRAINT falha_forcada CHECK ("usuarioId" <> 'bia')`);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await definirSenhaPrimeiroAcesso("tok-bia", "senha-forte-1", true, VERSAO_DO_TERMO)).toEqual({ error: MENSAGEM_FALHA_AO_VERIFICAR });
    erro.mockRestore();
    const u = await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "bia" } });
    expect(u).toMatchObject({ senha: "placeholder", tokenPrimeiroAcesso: "tok-bia" });
  });

  it("quem já aceitou a versão vigente não vê a caixa; versão anterior: caixa opcional", async () => {
    await conta("caio");
    await pg.exec(`INSERT INTO consentimentos ("usuarioId", "versaoTermo", canal) VALUES ('caio', '${VERSAO_DO_TERMO}', 'login')`);
    expect(situacaoNoLink(await aceitesDoUsuario("caio"))).toBe("aceito");
    expect(await definirSenhaPrimeiroAcesso("tok-caio", "senha-forte-1")).toEqual({ success: true });
    expect(await linhas()).toHaveLength(1);
    await conta("dani");
    await pg.exec(`INSERT INTO consentimentos ("usuarioId", "versaoTermo", canal) VALUES ('dani', '2020-01-01.1', 'login')`);
    expect(situacaoNoLink(await aceitesDoUsuario("dani"))).toBe("opcional");
    expect(await definirSenhaPrimeiroAcesso("tok-dani", "senha-forte-1")).toEqual({ success: true });
  });

  it("falha do banco ao ler os aceites (ex.: migração não aplicada): 'não foi possível verificar' e a senha não muda", async () => {
    await conta("edu");
    // (o PGlite em socket derruba a conexão num erro de tabela inexistente; a falha é simulada no Prisma)
    const espiao = vi.spyOn(harness.prisma.consentimento, "findMany").mockRejectedValueOnce(new Error('relation "consentimentos" does not exist'));
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await definirSenhaPrimeiroAcesso("tok-edu", "senha-forte-1", true, VERSAO_DO_TERMO)).toEqual({ error: MENSAGEM_FALHA_AO_VERIFICAR });
    } finally { erro.mockRestore(); espiao.mockRestore(); }
    expect((await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "edu" } })).senha).toBe("placeholder");
  });
});

describe("login: conta criada já com senha pelo admin aceita no primeiro login", () => {
  it("conta nova (desde 17/11) sem aceite: pede, exige caixa e versão, grava canal 'login' e para de pedir", async () => {
    await conta("fabi", { token: null });
    expect(pedirAceiteNoLogin()).toBe(false);
    const u = await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "fabi" } });
    expect(await situacaoNoLogin(u)).toEqual({ pedir: true, versao: VERSAO_DO_TERMO });
    como("fabi", "colaborador");
    harness.ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    expect(await aceitarTermoNoLogin(false, VERSAO_DO_TERMO)).toEqual({ error: MENSAGEM_SEM_ACEITE });
    expect(await aceitarTermoNoLogin(true, "2020-01-01.1")).toEqual({ error: MENSAGEM_VERSAO_ERRADA });
    expect(await aceitarTermoNoLogin(true, VERSAO_DO_TERMO)).toEqual({ ok: true, jaAceito: false });
    expect(await aceitarTermoNoLogin(true, VERSAO_DO_TERMO)).toEqual({ ok: true, jaAceito: true });
    expect(await situacaoNoLogin(u)).toMatchObject({ pedir: false });
    expect(await linhas()).toMatchObject([{ usuarioId: "fabi", canal: "login", aparelho: "computador", comSenha: false }]);
  });

  it("conta antiga não é perguntada com a opção desligada; ligada (CONSENTIMENTO_PEDIR_NO_LOGIN=1), pede uma vez", async () => {
    await conta("gil", { token: null, criadoEm: new Date("2025-03-01T00:00:00Z") });
    const u = await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "gil" } });
    expect(await situacaoNoLogin(u)).toMatchObject({ pedir: false });
    como("gil", "corretor");
    expect(await aceitarTermoNoLogin(true, VERSAO_DO_TERMO)).toEqual({ error: "O pedido de aceite no login está desligado." });
    process.env.CONSENTIMENTO_PEDIR_NO_LOGIN = "1";
    expect(await situacaoNoLogin(u)).toMatchObject({ pedir: true });
    expect(await aceitarTermoNoLogin(true, VERSAO_DO_TERMO)).toEqual({ ok: true, jaAceito: false });
    expect(await situacaoNoLogin(u)).toMatchObject({ pedir: false });
  });

  it("borda do início do termo (17/11 00:00 UTC)", async () => {
    await conta("h1", { token: null, criadoEm: INICIO_DO_TERMO });
    await conta("h2", { token: null, criadoEm: new Date(INICIO_DO_TERMO.getTime() - 1000) });
    expect(await situacaoNoLogin(await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "h1" } }))).toMatchObject({ pedir: true });
    expect(await situacaoNoLogin(await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "h2" } }))).toMatchObject({ pedir: false });
  });

  it("sem login: aceitar e retirar são recusados", async () => {
    expect(await aceitarTermoNoLogin(true, VERSAO_DO_TERMO)).toEqual({ error: "Entre no sistema para continuar." });
    expect(await retirarMeuConsentimento(true)).toEqual({ error: "Entre no sistema para continuar." });
  });
});

describe("retirada do consentimento (registro real)", () => {
  async function aceitou(id: string, papel = "colaborador") {
    await conta(id, { papel });
    await definirSenhaPrimeiroAcesso(`tok-${id}`, "senha-forte-1", true, VERSAO_DO_TERMO);
  }

  it("admin registra: linha nova (revogacao, quem registrou); consulta mostra 'retirado'; login volta a pedir e o aceite novo funciona", async () => {
    await aceitou("ivo");
    await conta("adm", { token: null, papel: "admin" });
    como("adm", "admin");
    expect(await registrarRetiradaPeloAdmin("ivo")).toEqual({ ok: true });
    expect(await linhas()).toMatchObject([
      { usuarioId: "ivo", tipo: "aceite", canal: "definir_senha" },
      { usuarioId: "ivo", tipo: "revogacao", canal: "admin", registradoPor: "adm", versaoTermo: VERSAO_DO_TERMO },
    ]);
    expect(await registrarRetiradaPeloAdmin("ivo")).toEqual({ error: MENSAGEM_SEM_CONSENTIMENTO_ATIVO });
    expect(await registrarRetiradaPeloAdmin("nao-existe")).toEqual({ error: "Usuário não encontrado." });
    const r = await resumoDoTermoParaAdmin();
    expect(r.usuarios.find(u => u.id === "ivo")).toMatchObject({ retirado: true, retiradoPorNome: "Nome adm", retiradoPeloTitular: false, aceitouVersaoAtual: false });
    expect(r.porPapel.find(p => p.papel === "colaborador")).toMatchObject({ usuarios: 1, retirados: 1, aceitaramVersaoAtual: 0 });
    // conta ANTIGA ou nova: quem retirou volta a ver o termo
    const ivo = await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "ivo" } });
    expect(await situacaoNoLogin(ivo)).toEqual({ pedir: true, versao: VERSAO_DO_TERMO });
    como("ivo", "colaborador");
    expect(await aceitarTermoNoLogin(true, VERSAO_DO_TERMO)).toEqual({ ok: true, jaAceito: false });
    expect(await situacaoNoLogin(ivo)).toMatchObject({ pedir: false });
    expect((await linhas()).map(l => l.tipo)).toEqual(["aceite", "revogacao", "aceite"]);
    await expect(pg.exec(`DELETE FROM consentimentos WHERE tipo = 'revogacao'`)).rejects.toThrow(/CONSENTIMENTO_SO_INCLUSAO/);
  });

  it("só admin ativo registra a retirada de outra pessoa", async () => {
    await aceitou("jo");
    for (const papel of ["colaborador", "corretor", "cliente", "empreiteiro"]) {
      como("x", papel);
      expect(await registrarRetiradaPeloAdmin("jo")).toEqual({ error: "Não autorizado." });
    }
    harness.sessao = null;
    expect(await registrarRetiradaPeloAdmin("jo")).toEqual({ error: "Não autorizado." });
    expect((await linhas()).filter(l => l.tipo === "revogacao")).toEqual([]);
  });

  it("o próprio usuário retira (canal 'conta'); precisa confirmar e ter consentimento ativo; conta antiga também volta a ver o termo", async () => {
    await conta("lia", { token: null, criadoEm: new Date("2025-01-01T00:00:00Z"), papel: "cliente" });
    await pg.exec(`INSERT INTO consentimentos ("usuarioId", "versaoTermo", canal) VALUES ('lia', '${VERSAO_DO_TERMO}', 'login')`);
    como("lia", "cliente");
    harness.ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)";
    expect(await retirarMeuConsentimento(false)).toEqual({ error: "Confirme a retirada." });
    expect(await retirarMeuConsentimento(true)).toEqual({ ok: true });
    expect((await linhas())[1]).toMatchObject({ tipo: "revogacao", canal: "conta", registradoPor: "lia", aparelho: "tablet" });
    expect(await retirarMeuConsentimento(true)).toEqual({ error: MENSAGEM_SEM_CONSENTIMENTO_ATIVO });
    expect(await situacaoNoLogin(await harness.prisma.usuario.findUniqueOrThrow({ where: { id: "lia" } }))).toMatchObject({ pedir: true });
    expect((await resumoDoTermoParaAdmin()).usuarios.find(u => u.id === "lia")).toMatchObject({ retirado: true, retiradoPeloTitular: true });
  });

  it("excluir a conta continua possível e a prova permanece", async () => {
    await aceitou("mel");
    await harness.prisma.usuario.delete({ where: { id: "mel" } });
    expect(await linhas()).toMatchObject([{ usuarioId: "mel" }]);
  });

  it("regra pura: só contam os aceites depois da última retirada", () => {
    const e = (tipo: string, versao: string, em: string, id: number) => ({ tipo, versao, em: new Date(em), id });
    expect(situacaoDosRegistros([])).toEqual({ atual: false, algum: false, retirado: false });
    expect(situacaoDosRegistros([e("revogacao", "v", "2026-11-17T02:00:00Z", 2), e("aceite", VERSAO_DO_TERMO, "2026-11-17T01:00:00Z", 1)])).toEqual({ atual: false, algum: false, retirado: true });
    expect(situacaoDosRegistros([e("aceite", "x", "2026-11-17T01:00:00Z", 1), e("revogacao", "x", "2026-11-17T02:00:00Z", 2), e("aceite", VERSAO_DO_TERMO, "2026-11-17T03:00:00Z", 3)]))
      .toEqual({ atual: true, algum: true, retirado: false });
  });
});
