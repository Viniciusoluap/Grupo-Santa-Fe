// Completude do relatório executivo da obra (EPIC-020, Lote 4, item 29).
// Mesmo conteúdo em Prospecta/server/relatorio-obra.test.ts.
import { describe, expect, it } from "vitest";
import { calcularObra } from "@/lib/financeiro/obra";
import { calcularComissaoObra } from "@/lib/financeiro/comissao";
import { calcularProgresso, itensProgressoIniciais } from "@/lib/financeiro/progresso";
import { CAMPOS_OBRIGATORIOS, montarRelatorioObra, verificarCompletude, type DadosRelatorioObra } from "@/lib/obras/relatorio";

function dados(parcial: Partial<DadosRelatorioObra> = {}): DadosRelatorioObra {
  const movimentos = [
    { data: "2026-03-01", natureza: "entrada" as const, categoria: null, descricao: "Sinal", valor: "5000.00", status: "confirmado" as const, origem: "manual" },
    { data: "2026-04-10", natureza: "recebimento_cef" as const, categoria: null, descricao: "PLS 1", valor: "40000.00", status: "confirmado" as const, origem: "bpo" },
    { data: "2026-04-15", natureza: "pagamento" as const, categoria: "empreiteiro", descricao: "Medição 1", valor: "30000.00", status: "confirmado" as const, origem: "bpo" },
  ];
  const calculo = calcularObra({
    vgv: 23_000_000, financiamento: 18_000_000, fgts: 1_000_000, subsidio: 1_500_000, custoTerreno: 4_000_000,
    comissao: 1_150_000, orcamentoPrevisto: 12_000_000, taxaMensalPct: "1.5", parcelas: 24,
    dataInicio: "2026-03-01", dataTerminoPrevista: "2026-12-01",
    investidores: [{ id: 1, percentual: "30" }], percentualEmpreiteiro: "10",
    movimentos: movimentos.map((m) => ({ natureza: m.natureza, valorCentavos: Math.round(Number(m.valor) * 100), status: m.status })),
  });
  return {
    empresa: "Empresa",
    geradoEm: new Date("2026-10-12T12:00:00Z"),
    info: {
      titulo: "Casa Teste", tipo: "Obra e reforma", cliente: "Cliente", corretor: "Corretor", endereco: "Rua A, 1",
      area: 47, status: "Em andamento", escritorioCef: "Agência 1", dataInicio: "2026-03-01", previsaoTermino: "2026-12-01",
      terminoReal: null, observacoes: null,
    },
    valores: {
      vgv: "230000.00", financiamento: "180000.00", fgts: "10000.00", subsidio: "15000.00", custoTerreno: "40000.00",
      comissao: "11500.00", orcamentoPrevisto: "120000.00", taxaMensalPct: "1.5", parcelas: 24, percentualEmpreiteiro: "10",
    },
    calculo,
    empreiteiro: "Empreiteiro",
    investidores: [{ nome: "Investidor", percentual: "30", lucro: calculo.investidores[0].lucro }],
    comissao: calcularComissaoObra({ corretor: { id: 1, nome: "Corretor", percentualPadrao: null }, vgvCentavos: 23_000_000, percentualObra: "5", pagoCentavos: 0 }),
    movimentos,
    progresso: calcularProgresso(itensProgressoIniciais()),
    fotos: [{ legenda: "Fundação", data: "2026-04-01" }],
    ...parcial,
  };
}

describe("relatório executivo — completude", () => {
  it("obra completa: nenhum campo obrigatório faltando", () => {
    const r = montarRelatorioObra(dados());
    expect(verificarCompletude(r)).toEqual([]);
    const operacao = r.secoes.find((s) => s.id === "operacao")!;
    expect(operacao.campos.find((c) => c.rotulo === "VGV")!.valor).toBe("R$ 230.000,00");
    expect(operacao.campos.find((c) => c.rotulo === "Entrada total")!.valor).toBe("R$ 25.000,00");
    expect(r.secoes.find((s) => s.id === "custos")!.campos.find((c) => c.rotulo === "Comissão")!.valor).toBe("R$ 11.500,00");
  });

  it("o teste falha quando um campo obrigatório some", () => {
    const r = montarRelatorioObra(dados());
    const info = r.secoes.find((s) => s.id === "info")!;
    info.campos = info.campos.filter((c) => c.rotulo !== "Cliente");
    expect(verificarCompletude(r)).toEqual(['Informações: falta "Cliente"']);
  });

  it("todas as seções obrigatórias existem", () => {
    const ids = montarRelatorioObra(dados()).secoes.map((s) => s.id);
    for (const id of Object.keys(CAMPOS_OBRIGATORIOS)) expect(ids).toContain(id);
  });

  it("sem dados fictícios: ausente vira 'Não informado' e indicador mostra o motivo", () => {
    const base = dados();
    const calculo = calcularObra({
      vgv: null, financiamento: null, fgts: null, subsidio: null, custoTerreno: null, comissao: null, orcamentoPrevisto: null,
      taxaMensalPct: null, parcelas: null, dataInicio: null, dataTerminoPrevista: null, investidores: [], percentualEmpreiteiro: null, movimentos: [],
    });
    const r = montarRelatorioObra({
      ...base,
      calculo,
      valores: { vgv: null, financiamento: null, fgts: null, subsidio: null, custoTerreno: null, comissao: null, orcamentoPrevisto: null, taxaMensalPct: null, parcelas: null, percentualEmpreiteiro: null },
      investidores: [], movimentos: [], empreiteiro: null, comissao: null,
    });
    expect(verificarCompletude(r)).toEqual([]);
    const op = r.secoes.find((s) => s.id === "operacao")!;
    expect(op.campos.find((c) => c.rotulo === "VGV")!.valor).toBe("Não informado");
    expect(op.campos.find((c) => c.rotulo === "Lucro estimado")!.valor).toMatch(/^Não calculado — Informe/);
    expect(op.graficos).toEqual([]);
    expect(op.tabelas.every((t) => t.linhas.length === 0)).toBe(true);
  });

  it("progresso traz os 20 serviços e o Teste E aparece como 28,20%", () => {
    const execucoes: Record<string, string> = { preliminares: "100", infraestrutura: "100", supraestrutura: "50", impermeabilizacoes: "50", eletricas: "20", hidraulicas: "20", esgoto: "50", outros: "40" };
    const progresso = calcularProgresso(itensProgressoIniciais().map((i) => ({ ...i, execucao: execucoes[i.chave] ?? "0" })));
    const r = montarRelatorioObra(dados({ progresso }));
    const secao = r.secoes.find((s) => s.id === "progresso")!;
    expect(secao.campos[0].valor).toBe("28,20%");
    expect(secao.tabelas[0].linhas).toHaveLength(20);
    expect(secao.graficos[0].itens.length).toBe(8);
  });

  it("históricos separados por natureza, com origem manual/BPO", () => {
    const r = montarRelatorioObra(dados());
    const custos = r.secoes.find((s) => s.id === "custos")!;
    expect(custos.tabelas[0].linhas).toEqual([["15/04/2026", "Empreiteiro", "Medição 1", "R$ 30.000,00", "BPO", "Confirmado"]]);
    const op = r.secoes.find((s) => s.id === "operacao")!;
    expect(op.tabelas.find((t) => t.titulo === "Histórico de entradas")!.linhas[0][3]).toBe("Manual");
  });
});
