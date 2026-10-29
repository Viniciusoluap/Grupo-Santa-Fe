// Lote 03 — correções 14 e 18. Mesmos casos em
// Prospecta/server/relatorios-indicadores.test.ts.
import { describe, expect, it } from "vitest";
import {
  ETAPA_SEM_CLASSIFICACAO, chaveData, funilDeLeads, indicadoresDeObras, noPeriodo, numerosDeObra,
  rankingDeCorretores, situacaoImovelCatalogo, situacaoUnidadeIncorporacao, unidadesDisponiveis,
  type ObraRelatorio,
} from "@/lib/financeiro/relatorios-bpo";

const P = { de: "2026-01-01", ate: "2026-12-31" };
const obra = (o: Partial<ObraRelatorio>): ObraRelatorio => ({
  id: 1, status: "in_progress", dataInicio: "2026-03-10", criadoEm: new Date("2025-12-01T12:00:00Z"),
  leadId: null, vgvLead: null, vgv: "200000.00", financiamento: "150000.00", fgts: "10000.00", subsidio: "20000.00", ...o,
});

describe("período", () => {
  it("compara datas como AAAA-MM-DD, inclusive nas pontas", () => {
    expect(chaveData(new Date("2026-12-31T23:00:00Z"))).toBe("2026-12-31");
    expect(chaveData("2026-01-01")).toBe("2026-01-01");
    expect(chaveData(null)).toBeNull();
    expect(noPeriodo("2026-01-01", P)).toBe(true);
    expect(noPeriodo("2026-12-31", P)).toBe(true);
    expect(noPeriodo("2027-01-01", P)).toBe(false);
    expect(noPeriodo(null, P)).toBe(false);
  });
});

describe("14 — VGV de Obras e Ticket Médio", () => {
  it("soma o VGV simulado: obra com lead usa o valor do lead; sem lead, o VGV da obra", () => {
    const r = indicadoresDeObras([
      obra({ id: 1 }),
      obra({ id: 2, leadId: 9, vgvLead: "300000.00", vgv: "1.00" }),
    ], P);
    expect(r.vgvTotal).toBe(500000);
    expect(r.obrasElegiveis).toBe(2);
    expect(r.ticketMedio).toBe(250000);
  });

  it("fora: cancelada, distrato, VGV zero/vazio, lead sem VGV simulado; obra repetida conta uma vez", () => {
    const r = indicadoresDeObras([
      obra({ id: 1 }),
      obra({ id: 1 }),
      obra({ id: 2, status: "cancelled" }),
      obra({ id: 3, status: "cancelada" }),
      obra({ id: 4, status: "distrato" }),
      obra({ id: 5, vgv: "0" }),
      obra({ id: 6, vgv: null }),
      obra({ id: 7, leadId: 3, vgvLead: null, vgv: "999999.00" }),
    ], P);
    expect(r.obrasElegiveis).toBe(1);
    expect(r.vgvTotal).toBe(200000);
  });

  it("período pela data de início; sem início, pela data de criação", () => {
    const r = indicadoresDeObras([
      obra({ id: 1, dataInicio: "2025-06-01", criadoEm: "2026-02-01" }), // início fora → fora
      obra({ id: 2, dataInicio: null, criadoEm: new Date("2026-05-05T10:00:00Z") }), // criação dentro
      obra({ id: 3, dataInicio: null, criadoEm: "2025-05-05" }),
    ], P);
    expect(r.obrasElegiveis).toBe(1);
  });

  it("sem obras elegíveis: VGV 0 e ticket médio null (tela mostra —)", () => {
    const r = indicadoresDeObras([], P);
    expect(r.vgvTotal).toBe(0);
    expect(r.ticketMedio).toBeNull();
  });

  it("ticket médio arredonda em centavos", () => {
    const r = indicadoresDeObras([obra({ id: 1, vgv: "100000.00" }), obra({ id: 2, vgv: "100000.00" }), obra({ id: 3, vgv: "100000.01" })], P);
    expect(r.ticketMedio).toBe(100000);
  });
});

describe("18.1 — Números de Obra", () => {
  it("totaliza financiado, subsídio e entrada (VGV − financiamento − FGTS − subsídio)", () => {
    const r = indicadoresDeObras([
      obra({ id: 1 }),
      obra({ id: 2, fgts: null, financiamento: "100000.00", subsidio: "5000.00" }),
    ], P);
    expect(r.financiadoTotal).toBe(250000);
    expect(r.subsidioTotal).toBe(25000);
    expect(r.entradaTotal).toBe(20000); // só a obra 1 tem os quatro valores
    expect(r.obrasSemEntrada).toBe(1);
    const fatias = numerosDeObra(r);
    expect(fatias.map((f) => f.nome)).toEqual(["VGV total simulado", "Financiado total", "Subsídio total", "Entrada total dos clientes"]);
    expect(fatias[0].valor).toBe(400000);
  });

  it("entrada negativa não vira fatia negativa", () => {
    const r = indicadoresDeObras([obra({ financiamento: "250000.00" })], P);
    expect(r.entradaTotal).toBe(-80000);
    expect(numerosDeObra(r)[3].fatia).toBe(0);
  });
});

describe("18.2 — Funil de Leads", () => {
  const etapas = [{ key: "a", label: "Lead Novo" }, { key: "b", label: "Em Atendimento" }, { key: "c", label: "Medições" }];
  it("usa as etapas do CRM, na ordem, com zeros, % e total", () => {
    const f = funilDeLeads(etapas, [{ etapa: "b" }, { etapa: "a" }, { etapa: "b" }, { etapa: "b" }]);
    expect(f.total).toBe(4);
    expect(f.etapas).toEqual([
      { key: "a", label: "Lead Novo", n: 1, pct: 25 },
      { key: "b", label: "Em Atendimento", n: 3, pct: 75 },
      { key: "c", label: "Medições", n: 0, pct: 0 },
    ]);
  });
  it("etapa desconhecida ou ausente vai para Aguardando classificação (nunca nome técnico)", () => {
    const f = funilDeLeads(etapas, [{ etapa: "measurements_x" }, { etapa: null }, { etapa: "a" }]);
    expect(f.etapas.at(-1)).toEqual({ ...ETAPA_SEM_CLASSIFICACAO, n: 2, pct: 67 });
    expect(f.etapas.map((e) => e.label)).not.toContain("measurements_x");
  });
  it("sem leads: total 0 e % 0", () => {
    const f = funilDeLeads(etapas, []);
    expect(f.total).toBe(0);
    expect(f.etapas.every((e) => e.pct === 0)).toBe(true);
  });
});

describe("18.3 — Ranking de corretores", () => {
  it("soma pagamentos de comissão das obras e comissões pagas cadastradas, no período, ordenado antes do limite", () => {
    const r = rankingDeCorretores(
      [
        { obraId: 1, corretorId: 10, corretor: "Ana", valor: "1000.00", data: "2026-02-01" },
        { obraId: 1, corretorId: 10, corretor: "Ana", valor: "500.00", data: "2026-03-01" },
        { obraId: 2, corretorId: 11, corretor: "Bruno", valor: "9000.00", data: "2025-12-31" }, // fora do período
      ],
      [
        { obraId: null, corretorId: 12, corretor: "Carla", valor: "2000.00", status: "paga", pagoEm: new Date("2026-06-01T12:00:00Z") },
        { obraId: null, corretorId: 13, corretor: "Davi", valor: "5000.00", status: "pendente", pagoEm: null },
        { obraId: null, corretorId: 14, corretor: "Eva", valor: "100.00", status: "paga", pagoEm: "2026-07-01" },
      ],
      P,
      2,
    );
    expect(r).toEqual([
      { nome: "Carla", totalPago: 2000, pagamentos: 1 },
      { nome: "Ana", totalPago: 1500, pagamentos: 2 },
    ]);
  });

  it("comissão cadastrada de obra que já tem pagamento de comissão não é contada de novo", () => {
    const r = rankingDeCorretores(
      [{ obraId: 7, corretorId: 10, corretor: "Ana", valor: "1000.00", data: "2026-02-01" }],
      [
        { obraId: 7, corretorId: 10, corretor: "Ana", valor: "1000.00", status: "paga", pagoEm: "2026-02-01" },
        { obraId: 8, corretorId: 10, corretor: "Ana", valor: "300.00", status: "paga", pagoEm: "2026-02-02" },
      ],
      P,
    );
    expect(r).toEqual([{ nome: "Ana", totalPago: 1300, pagamentos: 2 }]);
  });

  it("pagamento de obra sem corretor no lead aparece como Sem corretor vinculado; vazio → lista vazia", () => {
    expect(rankingDeCorretores([{ obraId: 1, corretorId: null, corretor: null, valor: "10.00", data: "2026-01-02" }], [], P)[0].nome)
      .toBe("Sem corretor vinculado");
    expect(rankingDeCorretores([], [], P)).toEqual([]);
  });
});

describe("18.4 — Unidades Disponíveis", () => {
  it("mapeia os status dos dois sistemas", () => {
    expect(situacaoUnidadeIncorporacao("disponivel")).toBe("disponivel");
    expect(situacaoUnidadeIncorporacao("reservada")).toBe("reservado");
    expect(situacaoUnidadeIncorporacao("vendida")).toBe("vendido");
    expect(situacaoImovelCatalogo("venda")).toBe("disponivel");
    expect(situacaoImovelCatalogo("lancamento")).toBe("disponivel");
    expect(situacaoImovelCatalogo("locacao")).toBe("disponivel");
    expect(situacaoImovelCatalogo("vendido")).toBe("vendido");
    expect(situacaoImovelCatalogo("locado")).toBe("vendido");
    expect(situacaoImovelCatalogo("alugado")).toBe("vendido");
    expect(situacaoImovelCatalogo("reservado")).toBe("reservado");
    expect(situacaoImovelCatalogo("xyz")).toBeNull();
  });

  it("conta incorporação e catálogo; exclui tombstone, não aprovados, pontos de obra e imóveis vinculados a unidade", () => {
    const { barras, naoClassificadas } = unidadesDisponiveis(
      [
        { status: "disponivel", excluida: false },
        { status: "disponivel", excluida: true },
        { status: "reservada", excluida: false },
        { status: "vendida", excluida: false },
        { status: "vendida", excluida: false },
      ],
      [
        { status: "disponivel", aprovado: true, pontoDeObra: false },
        { status: "venda", aprovado: true, pontoDeObra: true },
        { status: "disponivel", aprovado: false, pontoDeObra: false },
        { status: "vendido", aprovado: true, pontoDeObra: false },
        { status: "reservado", aprovado: true, pontoDeObra: false, vinculadoAUnidade: true },
        { status: "estranho", aprovado: true, pontoDeObra: false },
      ],
    );
    expect(barras.map((b) => [b.chave, b.disponiveis, b.reservados, b.vendidos, b.total])).toEqual([
      ["incorporacao_disponiveis", 1, 0, 0, 1],
      ["incorporacao_ocupadas", 0, 1, 2, 3],
      ["catalogo_disponiveis", 1, 0, 0, 1],
      ["catalogo_ocupados", 0, 0, 1, 1],
    ]);
    expect(naoClassificadas).toBe(1);
  });
});
