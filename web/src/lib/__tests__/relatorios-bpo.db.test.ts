// Lote 03 (14 e 18): consultas dos Relatórios do BPO com o banco real (TEST_DATABASE_URL).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const MARCA = "TESTE-RELATORIOS-LOTE3";

describe.skipIf(!url)("Lote 03 — indicadores dos Relatórios (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let dados: typeof import("@/lib/financeiro/relatorios-bpo-dados");
  const periodo = { de: "2026-01-01", ate: "2026-12-31" };

  const limpar = async () => {
    await prisma.obraMovimento.deleteMany({ where: { descricao: MARCA } });
    await prisma.obra.deleteMany({ where: { nome: { startsWith: MARCA } } });
    await prisma.comissao.deleteMany({ where: { imovel: MARCA } });
    await prisma.lead.deleteMany({ where: { nome: { startsWith: MARCA } } });
    await prisma.corretor.deleteMany({ where: { email: "relatorios-lote3@teste.local" } });
  };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    dados = await import("@/lib/financeiro/relatorios-bpo-dados");
    await limpar();
  });
  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  it("VGV de Obras, Números de Obra, Funil e Ranking refletem obra, lead e comissão paga", async () => {
    const antes = await dados.carregarIndicadoresRelatorios(periodo);
    const corretor = await prisma.corretor.create({ data: { nome: `${MARCA} Corretor`, email: "relatorios-lote3@teste.local", telefone: "0", creci: "0" } });
    const lead = await prisma.lead.create({
      data: { nome: `${MARCA} Lead`, telefone: "0", servico: "[]", etapaOperacional: "medicoes", orcamento: 300000, corretorId: corretor.id, criadoEm: new Date("2026-05-01T12:00:00Z") },
    });
    await prisma.lead.create({ data: { nome: `${MARCA} Excluído`, telefone: "0", servico: "[]", excluidoEm: new Date(), criadoEm: new Date("2026-05-01T12:00:00Z") } });
    const obra = await prisma.obra.create({
      data: {
        nome: `${MARCA} Obra`, clienteNome: "x", clienteTel: "0", leadId: lead.id, status: "em_andamento",
        dataInicio: new Date("2026-03-01T12:00:00Z"), vgv: "1.00", financiamentoCef: "200000.00", fgts: "10000.00", subsidio: "40000.00",
      },
    });
    await prisma.obra.create({ data: { nome: `${MARCA} Cancelada`, clienteNome: "x", clienteTel: "0", status: "cancelada", vgv: "999999.00", dataInicio: new Date("2026-03-01T12:00:00Z") } });
    await prisma.obraMovimento.create({ data: { obraId: obra.id, natureza: "pagamento", categoria: "comissao", descricao: MARCA, valor: "987654.32", data: new Date("2026-04-10"), origem: "manual" } });
    // Comissão cadastrada da mesma obra: não pode somar de novo.
    await prisma.comissao.create({ data: { corretorId: corretor.id, imovel: MARCA, tipoNegocio: "obra", negocioId: obra.id, valor: 987654.32, status: "paga", vencimento: new Date("2026-04-10"), pagamentoEm: new Date("2026-04-10T12:00:00Z") } });

    const depois = await dados.carregarIndicadoresRelatorios(periodo);
    expect(depois.vgvObras.vgvTotal - antes.vgvObras.vgvTotal).toBeCloseTo(300000, 2);
    expect(depois.vgvObras.obrasElegiveis - antes.vgvObras.obrasElegiveis).toBe(1);
    expect(depois.vgvObras.entradaTotal - antes.vgvObras.entradaTotal).toBeCloseTo(50000, 2);
    const medicoes = (r: typeof antes) => r.funilLeads.etapas.find((e) => e.key === "medicoes")!.n;
    expect(medicoes(depois) - medicoes(antes)).toBe(1);
    expect(depois.funilLeads.total - antes.funilLeads.total).toBe(1);
    expect(depois.corretorRanking[0]).toEqual({ nome: `${MARCA} Corretor`, totalPago: 987654.32, pagamentos: 1 });
  });
});
