// Lote 4: conta "API do Banco Inter (beta)" sincronizada com o banco real (TEST_DATABASE_URL).
// Gêmeo da Prospecta: server/banco-inter-sync.test.ts. O Inter é simulado (nenhuma chamada real).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "usuario-teste", role: "admin" } }) }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const MARCA = "TESTE-INTER-LOTE4";
const CRED = {
  clientId: "cid", clientSecret: "csec",
  certificado: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
  chave: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----",
};
const resp = (corpo: unknown, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => corpo });

describe.skipIf(!url)("Banco Inter (beta) — sincronização (banco real, Inter simulado)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let bancos: typeof import("@/lib/bancos");
  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    bancos = await import("@/lib/bancos");
  });
  const limpar = async () => {
    const contas = await prisma.contaBancaria.findMany({ where: { banco: { startsWith: MARCA } }, select: { id: true } });
    const tx = await prisma.transacaoBancaria.findMany({ where: { contaId: { in: contas.map((c) => c.id) } }, select: { id: true } });
    await prisma.bpoLancamento.deleteMany({ where: { transacaoId: { in: tx.map((t) => t.id) } } });
    await prisma.contaBancaria.deleteMany({ where: { id: { in: contas.map((c) => c.id) } } });
  };
  beforeEach(limpar);
  afterEach(() => { delete process.env.BANCO_INTER_API; });
  afterAll(async () => { await limpar(); await prisma.$disconnect(); });

  const criar = () => prisma.contaBancaria.create({ data: {
    banco: `${MARCA} Inter`, conta: "Inter", provedor: "inter", credencialEncrypted: `plain:${JSON.stringify(CRED)}`, dataInicial: new Date("2026-10-01T00:00:00Z"),
  } });

  it("desligado por padrão: não chama o Inter", async () => {
    const conta = await criar();
    const fetchInter = vi.fn();
    const r = await bancos.sincronizarConta(conta.id, fetch, fetchInter);
    expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/desligado/) });
    expect(fetchInter).not.toHaveBeenCalled();
  });

  it("ligado: lê extrato e saldo, grava sem duplicar e recriptografa a credencial", async () => {
    process.env.BANCO_INTER_API = "1";
    const conta = await criar();
    const f = vi.fn((u: string) => {
      if (u.includes("/oauth/v2/token")) return resp({ access_token: "tok" });
      if (u.includes("/saldo")) return resp({ disponivel: 987.65 });
      return resp({ totalPaginas: 1, transacoes: [
        { idTransacao: `${conta.id}-1`, dataTransacao: "2026-10-05", tipoOperacao: "C", tipoTransacao: "PIX", valor: "150.50", titulo: "Pix recebido", detalhes: { nomePagador: "Ana" } },
        { idTransacao: `${conta.id}-2`, dataTransacao: "2026-09-20", tipoOperacao: "D", valor: "10", titulo: "Antes da data inicial" },
      ] });
    });
    const r1 = await bancos.sincronizarConta(conta.id, fetch, () => f as never);
    expect(r1).toMatchObject({ ok: true, novos: 1, saldo: 987.65 });
    const r2 = await bancos.sincronizarConta(conta.id, fetch, () => f as never);
    expect(r2).toMatchObject({ ok: true, novos: 0 });
    const tx = await prisma.transacaoBancaria.findMany({ where: { contaId: conta.id } });
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({ externalId: `inter:${conta.id}-1`, valor: 150.5, tipo: "credito" });
    const depois = await prisma.contaBancaria.findUniqueOrThrow({ where: { id: conta.id } });
    expect(depois.saldoAtual).toBe(987.65);
    expect(depois.credencialEncrypted?.startsWith("plain:")).toBe(false);
  });

  it("recusa do Inter vira erro legível na conta", async () => {
    process.env.BANCO_INTER_API = "1";
    const conta = await criar();
    const r = await bancos.sincronizarConta(conta.id, fetch, () => (() => resp({ title: "Unauthorized" }, 401)) as never);
    expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/O Inter recusou o acesso \(HTTP 401\)/) });
    expect((await prisma.contaBancaria.findUniqueOrThrow({ where: { id: conta.id } })).ultimoErro).toMatch(/HTTP 401/);
  });
});
