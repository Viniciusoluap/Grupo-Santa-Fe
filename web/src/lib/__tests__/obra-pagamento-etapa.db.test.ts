// Pedido A8 (13/10/2026) — pagamento da obra com as categorias Mão de obra e
// Material e a etapa da obra. Banco real (rode com TEST_DATABASE_URL).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ user: { id: "", role: "admin" } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("pagamento com categoria nova e etapa (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let adicionar: typeof import("@/lib/actions/obra-financeiro").adicionarMovimentoObra;
  let obraId = "";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ adicionarMovimentoObra: adicionar } = await import("@/lib/actions/obra-financeiro"));
    const admin = await prisma.usuario.findFirst({ where: { papel: "admin" }, select: { id: true } });
    sessao.user.id = admin!.id;
    obraId = (await prisma.obra.create({ data: { nome: "Obra A8", clienteNome: "C", clienteTel: "1" } })).id;
  });
  afterAll(async () => { await prisma.$disconnect(); });

  const base = () => ({ obraId, natureza: "pagamento" as const, descricao: "Pedreiro", valor: "1500.00", data: "2026-10-13" });

  it("grava Mão de obra com etapa e Material sem etapa", async () => {
    expect(await adicionar({ ...base(), categoria: "mao_de_obra", etapa: "paredes" })).toEqual({ ok: true });
    expect(await adicionar({ ...base(), descricao: "Cimento", categoria: "material" })).toEqual({ ok: true });
    const movs = await prisma.obraMovimento.findMany({ where: { obraId }, orderBy: { criadoEm: "asc" }, select: { categoria: true, etapa: true } });
    expect(movs).toEqual([{ categoria: "mao_de_obra", etapa: "paredes" }, { categoria: "material", etapa: null }]);
  });

  it("recusa etapa inválida, etapa em recebimento e mantém as categorias antigas", async () => {
    expect(await adicionar({ ...base(), categoria: "material", etapa: "xyz" })).toMatchObject({ ok: false, erro: "Etapa inválida." });
    expect(await adicionar({ ...base(), natureza: "entrada", etapa: "pisos" })).toMatchObject({ ok: false });
    expect(await adicionar({ ...base(), categoria: "fornecedor" })).toEqual({ ok: true });
    await expect(prisma.$executeRawUnsafe(`INSERT INTO obra_movimentos (id, "obraId", natureza, categoria, etapa, descricao, valor, data, origem) VALUES ('x-a8', '${obraId}', 'pagamento', 'material', 'xyz', 'x', 1, CURRENT_DATE, 'manual')`)).rejects.toThrow(/etapa_check/);
  });
});
