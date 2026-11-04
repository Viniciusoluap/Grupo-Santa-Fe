// Prisma real sobre PostgreSQL isolado em memória: nunca usa DATABASE_URL externa.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ get prisma() { return harness.prisma; } }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "admin-isolado", role: "admin" } }) }));
vi.mock("@/lib/auth/modulos", () => ({
  exigirModuloAcao: async () => ({ id: "admin-isolado", nome: "Teste" }),
  exigirAdminAtivo: async () => ({ id: "admin-isolado", nome: "Teste" }),
}));

describe("Limpeza temporária BPO — Prisma/PostgreSQL isolado", () => {
  let pg: PGlite;
  let socket: PGLiteSocketServer;
  let pool: Pool;
  let lote: typeof import("@/lib/actions/bpo-lote");
  let bpo: typeof import("@/lib/actions/bpo");
  let extrato: typeof import("@/lib/bancos/lancamentos-bpo");
  const data = new Date("2026-10-10T12:00:00Z");
  const novo = (id: string, extra = {}) => harness.prisma.bpoLancamento.create({ data: {
    id, tipo: "recebimento", descricao: id, valor: 100, competencia: "2026-10", vencimento: data, ...extra,
  } });
  async function limpar(ids: string[], aba: "cobrancas" | "despesas" = "cobrancas") {
    const entrada = { aba, modo: "selecionados" as const, ids, limpezaAjustes: true };
    const previa = await lote.previaExclusaoLote(entrada);
    if ("erro" in previa) throw new Error(previa.erro);
    const resultado = await lote.excluirLancamentosEmLote({ ...entrada, previaToken: previa.previaToken, confirmacao: "EXCLUIR" });
    if ("erro" in resultado) throw new Error(resultado.erro);
    return resultado;
  }
  beforeAll(async () => {
    pg = await PGlite.create();
    const require = createRequire(import.meta.url);
    const schema = execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
      encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://teste@127.0.0.1:1/isolado" }, maxBuffer: 5 * 1024 * 1024,
    });
    await pg.exec(schema);
    await pg.exec('ALTER TABLE bpo_lancamentos DROP COLUMN "exclusaoLoteBackupId"');
    const migration = readFileSync("prisma/migrations/20261031010000_bpo_limpeza_ajustes/migration.sql", "utf8");
    await pg.exec(migration);
    await pg.exec(migration); // idempotência da migração completa, inclusive gatilhos.
    socket = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 0 });
    await socket.start();
    pool = new Pool({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1 });
    harness.prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    lote = await import("@/lib/actions/bpo-lote");
    bpo = await import("@/lib/actions/bpo");
    extrato = await import("@/lib/bancos/lancamentos-bpo");
  }, 60000);
  beforeEach(async () => {
    const tabelas = await pg.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    await pg.exec(`TRUNCATE ${tabelas.rows.map((t) => `"${t.tablename}"`).join(",")} CASCADE`);
    await harness.prisma.usuario.create({ data: { id: "admin-isolado", nome: "Teste", email: "isolado@example.invalid", senha: "nao-utilizada", papel: "admin" } });
  });
  afterAll(async () => {
    await harness.prisma?.$disconnect();
    await pool?.end();
    await socket?.stop();
    await pg?.close();
  });

  it("arquiva e restaura 823 despesas em lote preservando IDs, recebimentos e vínculos", async () => {
    const p = harness.prisma;
    const conta = await p.contaBancaria.create({ data: { banco: "Isolado", conta: "1" } });
    const transacao = await p.transacaoBancaria.create({ data: { contaId: conta.id, data, descricao: "Despesa", valor: 100, tipo: "debito" } });
    await p.bpoLancamento.createMany({ data: Array.from({ length: 823 }, (_, i) => ({
      id: `despesa-${i}`, descricao: `Despesa ${i}`, tipo: "despesa", valor: 100, pago: true, pagoEm: data, valorRecebido: 100,
      competencia: "2026-10", vencimento: data, ...(i === 0 ? { transacaoId: transacao.id } : {}), ...(i === 1 ? { asaasPaymentId: "pay-isolado" } : {}),
    })) });
    await p.bpoBaixa.create({ data: { lancamentoId: "despesa-2", valor: 100, data, motivo: "Recebimento existente", requestKey: "baixa-isolada", usuarioId: "admin-isolado" } });
    const obra = await p.obra.create({ data: { nome: "Obra isolada", clienteNome: "Teste", clienteTel: "0", dataInicio: data } });
    const movimento = await p.obraMovimento.create({ data: { obraId: obra.id, natureza: "pagamento", descricao: "Existente", valor: 50, data, origem: "bpo", bpoLancamentoId: "despesa-3" } });
    const entrada = { aba: "despesas" as const, modo: "tudo" as const, limpezaAjustes: true };
    expect(await lote.previaExclusaoLote({ ...entrada, limpezaAjustes: false })).toMatchObject({ protegidos: 823, excluiveis: 0 });
    const previa = await lote.previaExclusaoLote(entrada);
    if ("erro" in previa) throw new Error(previa.erro);
    const resultado = await lote.excluirLancamentosEmLote({ ...entrada, confirmacao: "EXCLUIR", previaToken: previa.previaToken });
    if ("erro" in resultado || !resultado.backupId) throw new Error("Falha no arquivamento");
    expect(resultado).toMatchObject({ excluidos: 823, protegidos: 0 });
    expect(await p.bpoLancamento.count({ where: { exclusaoLoteBackupId: null } })).toBe(0);
    expect(await p.bpoLancamento.count()).toBe(823);
    expect(await p.bpoBaixa.count()).toBe(1);
    expect(await p.obraMovimento.findUnique({ where: { id: movimento.id } })).toMatchObject({ bpoLancamentoId: "despesa-3" });
    expect(await extrato.vincularTransacoesAoBpo()).toMatchObject({ criados: 0 });
    const inicio = performance.now();
    expect(await lote.restaurarExclusaoEmLote({ backupId: resultado.backupId, confirmacao: "RESTAURAR" })).toMatchObject({ restaurados: 823 });
    expect(performance.now() - inicio).toBeLessThan(15000);
    expect(await p.bpoLancamento.count({ where: { exclusaoLoteBackupId: null } })).toBe(823);
    expect(await p.bpoLancamento.findUnique({ where: { id: "despesa-0" } })).toMatchObject({ transacaoId: transacao.id, version: 3 });
    expect(await p.bpoLancamento.findUnique({ where: { id: "despesa-1" } })).toMatchObject({ asaasPaymentId: "pay-isolado" });
    expect(await p.bpoBaixa.count()).toBe(1);
    expect(await p.bpoLancamentoHistorico.count()).toBe(1646);
    expect(await lote.restaurarExclusaoEmLote({ backupId: resultado.backupId, confirmacao: "RESTAURAR" })).toEqual({ erro: expect.stringMatching(/já foi restaurada/) });
  }, 30000);

  it("respeita aba e filtro, rejeita prévia obsoleta e bloqueia mutações de tela antiga", async () => {
    await novo("alvo", { descricao: "Filtro alvo" });
    await novo("outro");
    await novo("despesa", { tipo: "despesa", descricao: "Filtro alvo" });
    const entrada = { aba: "cobrancas" as const, modo: "tudo" as const, filtros: { busca: "Filtro alvo" }, limpezaAjustes: true };
    const previa = await lote.previaExclusaoLote(entrada);
    if ("erro" in previa) throw new Error(previa.erro);
    expect(previa).toMatchObject({ alcancados: 1, excluiveis: 1 });
    await harness.prisma.bpoLancamento.update({ where: { id: "alvo" }, data: { valor: 101 } });
    expect(await lote.excluirLancamentosEmLote({ ...entrada, confirmacao: "EXCLUIR", previaToken: previa.previaToken })).toEqual({ erro: expect.stringMatching(/mudaram/) });
    expect(await harness.prisma.bpoLancamentoExclusaoBackup.count()).toBe(0);
    await limpar(["alvo"]);
    await expect(bpo.pagarLancamento("alvo")).rejects.toThrow(/limpeza de ajustes/);
    await expect(bpo.registrarBaixaBpo({ id: "alvo", version: 1, requestKey: "stale", valor: 10, data: data.toISOString(), motivo: "Teste" })).rejects.toThrow(/limpeza de ajustes/);
    expect(await lote.combinarPagamentos({ ids: ["alvo", "outro"], requestKey: "combinar-stale" })).toEqual({ erro: expect.stringMatching(/não está mais disponível/) });
    expect(await harness.prisma.bpoLancamento.count({ where: { exclusaoLoteBackupId: null } })).toBe(2);
  });

  it("não recria origem estável arquivada nem Asaas tardio e continua importando além de 500 ignorados", async () => {
    const p = harness.prisma;
    const conta = await p.contaBancaria.create({ data: { banco: "Isolado", conta: "1" } });
    await p.bpoLancamento.createMany({ data: Array.from({ length: 501 }, (_, i) => ({ id: `origem-${i}`, descricao: `Origem ${i}`, tipo: "recebimento", valor: 100, pago: true, competencia: "2026-10", vencimento: data, origemTransacaoKey: `origem-estavel-${i}` })) });
    await novo("asaas", { asaasPaymentId: "pay-tardio" });
    await limpar([...Array.from({ length: 501 }, (_, i) => `origem-${i}`), "asaas"]);
    await p.transacaoBancaria.createMany({ data: [
      ...Array.from({ length: 501 }, (_, i) => ({ id: `tx-${i}`, contaId: conta.id, externalId: `origem-estavel-${i}`, descricao: "Reimportada", valor: 100, tipo: "credito", data })),
      { id: "tx-asaas", contaId: conta.id, asaasPaymentId: "pay-tardio", descricao: "Tardia", valor: 100, tipo: "credito", data },
      { id: "tx-nova", contaId: conta.id, externalId: "origem-nova", descricao: "Nova", valor: 100, tipo: "credito", data },
    ] });
    expect(await extrato.vincularTransacoesAoBpo()).toMatchObject({ criados: 1 });
    expect(await extrato.vincularTransacoesAoBpo()).toMatchObject({ criados: 0 });
    expect(await p.bpoLancamento.count()).toBe(503);
    expect(await p.bpoLancamento.count({ where: { exclusaoLoteBackupId: null } })).toBe(1);
  }, 30000);

  it("a limpeza da conta preserva o lançamento de extrato arquivado e seu backup", async () => {
    const { excluirContaBancaria } = await import("@/lib/actions/banco");
    const p = harness.prisma;
    const conta = await p.contaBancaria.create({ data: { banco: "Isolado", conta: "1" } });
    const transacao = await p.transacaoBancaria.create({ data: {
      contaId: conta.id, data, descricao: "Despesa", valor: 100, tipo: "debito", externalId: "extrato-isolado",
    } });
    await novo("extrato-arquivado", {
      tipo: "despesa", origemEfetiva: "extrato", transacaoId: transacao.id, origemTransacaoKey: "extrato-isolado",
    });
    const { backupId } = await limpar(["extrato-arquivado"], "despesas");
    expect(await excluirContaBancaria(conta.id, "EXCLUIR")).toMatchObject({
      success: true, lancamentosRemovidos: 0, lancamentosPreservados: 1,
    });
    expect(await p.bpoLancamento.findUnique({ where: { id: "extrato-arquivado" } })).toMatchObject({
      exclusaoLoteBackupId: backupId, origemTransacaoKey: "extrato-isolado", transacaoId: null,
    });
    expect(await p.bpoLancamentoExclusaoBackup.count()).toBe(1);
  });

  it("baixa a mesma cobrança ao vincular crédito Asaas recebido depois do arquivamento", async () => {
    const p = harness.prisma;
    const conta = await p.contaBancaria.create({ data: { banco: "Asaas isolado", conta: "1" } });
    const vencimento = new Date("2026-08-01T12:00:00Z");
    await novo("cobranca-antiga", {
      asaasPaymentId: "pay-antigo", origemEfetiva: "asaas", vencimento, competencia: "2026-08",
    });
    const { backupId } = await limpar(["cobranca-antiga"]);
    if (!backupId) throw new Error("Falha no arquivamento da cobrança");
    const credito = await p.transacaoBancaria.create({ data: {
      contaId: conta.id, externalId: "asaas:credito-antigo", asaasPaymentId: "pay-antigo",
      data, descricao: "Crédito confirmado", valor: 98.01, tipo: "credito",
    } });
    expect(await extrato.vincularTransacoesAoBpo()).toMatchObject({ criados: 0 });
    expect(await p.bpoLancamento.findUnique({ where: { id: "cobranca-antiga" } })).toMatchObject({
      exclusaoLoteBackupId: backupId, transacaoId: null, pago: false, valor: 100,
    });

    expect(await lote.restaurarExclusaoEmLote({ backupId, confirmacao: "RESTAURAR" })).toMatchObject({ restaurados: 1 });
    expect(await extrato.reprocessarMovimentacoes()).toMatchObject({ criados: 0 });
    expect(await extrato.reprocessarMovimentacoes()).toMatchObject({ criados: 0 });
    expect(await p.bpoLancamento.count()).toBe(1);
    expect(await p.bpoLancamento.findUnique({ where: { id: "cobranca-antiga" } })).toMatchObject({
      asaasPaymentId: "pay-antigo", transacaoId: credito.id, pago: true, pagoEm: data, valor: 98.01,
      vencimento, competencia: "2026-08",
    });
  });

  it("importa separadamente débito Asaas com o ID de uma cobrança arquivada", async () => {
    const p = harness.prisma;
    const conta = await p.contaBancaria.create({ data: { banco: "Asaas isolado", conta: "1" } });
    await novo("cobranca-arquivada", { asaasPaymentId: "pay-com-tarifa" });
    await limpar(["cobranca-arquivada"]);
    const tarifa = await p.transacaoBancaria.create({ data: {
      contaId: conta.id, externalId: "asaas:tarifa", asaasPaymentId: "pay-com-tarifa",
      data, descricao: "Tarifa Asaas", valor: 1.99, tipo: "debito",
    } });
    expect(await extrato.vincularTransacoesAoBpo()).toMatchObject({ criados: 1 });
    expect(await p.bpoLancamento.findUnique({ where: { transacaoId: tarifa.id } })).toMatchObject({
      tipo: "despesa", valor: 1.99, asaasPaymentId: null, exclusaoLoteBackupId: null,
    });
  });

  it("gatilhos preservam vínculo antigo mas rejeitam novo vínculo, reativação e aumento após arquivar", async () => {
    const p = harness.prisma;
    await novo("vinculado", { pago: true, valorRecebido: 100 });
    const obra = await p.obra.create({ data: { nome: "Obra", clienteNome: "Teste", clienteTel: "0", dataInicio: data } });
    const criar = (descricao: string) => p.obraMovimento.create({ data: { obraId: obra.id, natureza: "entrada", descricao, valor: 20, data, origem: "bpo", bpoLancamentoId: "vinculado" } });
    const movimento = await criar("Antigo");
    await limpar(["vinculado"]);
    // Exercita as rejeições diretamente no PostgreSQL. O adaptador de socket encerra
    // a conexão depois de uma exceção do gatilho e atrapalha rejeições em sequência.
    await expect(pg.query(
      'INSERT INTO obra_movimentos (id, "obraId", natureza, descricao, valor, data, origem, "bpoLancamentoId", "atualizadoEm") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)',
      ["novo-vinculo", obra.id, "entrada", "Novo", 20, data, "bpo", "vinculado"],
    )).rejects.toThrow(/limpeza de ajustes/);
    await expect(pg.query("UPDATE obra_movimentos SET valor = 21 WHERE id = $1", [movimento.id])).rejects.toThrow(/limpeza de ajustes/);
    await p.obraMovimento.update({ where: { id: movimento.id }, data: { valor: 19, observacao: "Preservada" } });
    await p.obraMovimento.update({ where: { id: movimento.id }, data: { status: "cancelado" } });
    await expect(pg.query("UPDATE obra_movimentos SET status = 'confirmado' WHERE id = $1", [movimento.id])).rejects.toThrow(/limpeza de ajustes/);
    expect(await p.obraMovimento.findUnique({ where: { id: movimento.id } })).toMatchObject({ bpoLancamentoId: "vinculado", status: "cancelado" });
  });
});
