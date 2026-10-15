import { describe, expect, it } from "vitest";
import { montarDetalheObra } from "@/lib/financeiro/detalhe-obra";
import { calcularProgresso, itensProgressoIniciais } from "@/lib/financeiro/progresso";
import { calcularObra, type EntradasObra } from "@/lib/financeiro/obra";

// Pedido 15/10: detalhes da obra espelham o editor (etapas do progresso, valores da operação).
const entradas = (o: Partial<EntradasObra> = {}): EntradasObra => ({
  vgv: 18_000_000, financiamento: 12_000_000, fgts: 1_000_000, subsidio: 2_000_000, custoTerreno: 3_000_000,
  comissao: 720_000, orcamentoPrevisto: 10_000_000, taxaMensalPct: null, parcelas: null, dataInicio: null,
  dataTerminoPrevista: null, investidores: [], percentualEmpreiteiro: null,
  movimentos: [{ natureza: "recebimento_cef", valorCentavos: 4_000_000, status: "confirmado" }, { natureza: "pagamento", valorCentavos: 2_500_000, status: "confirmado" }],
  ...o,
}) as EntradasObra;

describe("detalhes da obra = editor da obra", () => {
  it("etapas são os serviços com incidência, com a execução lançada", () => {
    const itens = itensProgressoIniciais().map((i) => ({ ...i, execucao: i.chave === "preliminares" ? "100" : i.chave === "infraestrutura" ? "50" : "0" }));
    const d = montarDetalheObra(calcularProgresso(itens), calcularObra(entradas()), 3);
    const pre = d.etapas.find((e) => e.chave === "preliminares")!;
    expect(pre).toMatchObject({ nome: "Serviços Preliminares e Gerais", execucao: 100, situacao: "concluida" });
    expect(d.etapas.find((e) => e.chave === "infraestrutura")).toMatchObject({ execucao: 50, situacao: "em_andamento" });
    expect(d.etapas.some((e) => e.chave === "vidros")).toBe(false); // incidência padrão 0%
    expect(d.estatisticas).toEqual({ totalEtapas: 19, etapasConcluidas: 1, totalFotos: 3 });
  });

  it("resumo financeiro usa os mesmos indicadores do editor", () => {
    const fin = calcularObra(entradas());
    const d = montarDetalheObra(calcularProgresso(itensProgressoIniciais()), fin, 0);
    expect(d.financeiro.orcamentoPrevisto).toEqual({ ok: true, centavos: 10_000_000 });
    expect(d.financeiro.receberBanco).toEqual(fin.receberBanco);
    expect(d.financeiro.plsReal).toEqual(fin.plsReal);
    expect(d.financeiro.gastoObraRealizado).toEqual({ ok: true, centavos: 2_500_000 });
    expect(d.financeiro.saldoRestante).toEqual({ ok: true, centavos: 18_000_000 - 2_500_000 });
  });

  it("sem orçamento informado explica o que falta", () => {
    const d = montarDetalheObra(calcularProgresso(itensProgressoIniciais()), calcularObra(entradas({ orcamentoPrevisto: null })), 0);
    expect(d.financeiro.orcamentoPrevisto).toEqual({ ok: false, motivo: "Informe: Orçamento Previsto" });
  });
});
