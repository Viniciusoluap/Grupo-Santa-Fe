import { describe, expect, it } from "vitest";
import {
  negociacaoFechadaDoJson,
  resumoNegociacao,
  valorEstimadoProposta,
  type DadosNegociacao,
  type Proposta,
} from "@/lib/incorporacao/negociacao";

function proposta(overrides: Partial<Proposta>): Proposta {
  return {
    id: "1",
    data: "2026-01-01",
    autor: "grupo_santa_fe",
    tipo: "compra_avista",
    status: "enviada",
    ...overrides,
  };
}

describe("valorEstimadoProposta", () => {
  it("usa o valorTotal para compra à vista", () => {
    expect(valorEstimadoProposta(proposta({ tipo: "compra_avista", valorTotal: 500_000 }), 0)).toBe(500_000);
  });

  it("calcula o valor da permuta financeira a partir do VGV bruto", () => {
    const p = proposta({ tipo: "permuta_financeira", permutaPctVgv: 40 });
    expect(valorEstimadoProposta(p, 10_000_000)).toBe(4_000_000);
  });

  it("retorna 0 para permuta financeira sem VGV disponível", () => {
    const p = proposta({ tipo: "permuta_financeira", permutaPctVgv: 40 });
    expect(valorEstimadoProposta(p, 0)).toBe(0);
  });

  it("usa o valorTotal para permuta física/mista", () => {
    expect(valorEstimadoProposta(proposta({ tipo: "permuta_fisica", valorTotal: 300_000 }), 0)).toBe(300_000);
  });
});

describe("resumoNegociacao", () => {
  it("sem propostas retorna resumo vazio e não fechada", () => {
    const dados: DadosNegociacao = { proprietarioNome: "", proprietarioContato: "", propostas: [] };
    const r = resumoNegociacao(dados);
    expect(r.totalPropostas).toBe(0);
    expect(r.propostaAtual).toBeNull();
    expect(r.fechada).toBe(false);
  });

  it("identifica a proposta mais recente por data", () => {
    const dados: DadosNegociacao = {
      proprietarioNome: "João",
      proprietarioContato: "",
      propostas: [
        proposta({ id: "1", data: "2026-01-01", valorTotal: 100 }),
        proposta({ id: "2", data: "2026-03-01", valorTotal: 200 }),
        proposta({ id: "3", data: "2026-02-01", valorTotal: 150 }),
      ],
    };
    const r = resumoNegociacao(dados);
    expect(r.propostaAtual?.id).toBe("2");
    expect(r.totalPropostas).toBe(3);
  });

  it("marca como fechada quando existe proposta aceita", () => {
    const dados: DadosNegociacao = {
      proprietarioNome: "João",
      proprietarioContato: "",
      propostas: [proposta({ id: "1", status: "recusada" }), proposta({ id: "2", status: "aceita" })],
    };
    expect(resumoNegociacao(dados).fechada).toBe(true);
  });
});

describe("negociacaoFechadaDoJson", () => {
  it("retorna false para JSON nulo ou corrompido", () => {
    expect(negociacaoFechadaDoJson(null)).toBe(false);
    expect(negociacaoFechadaDoJson("{invalido")).toBe(false);
  });

  it("retorna true quando alguma proposta está aceita", () => {
    const dados: DadosNegociacao = {
      proprietarioNome: "João",
      proprietarioContato: "",
      propostas: [proposta({ status: "aceita" })],
    };
    expect(negociacaoFechadaDoJson(JSON.stringify(dados))).toBe(true);
  });

  it("retorna false quando nenhuma proposta está aceita", () => {
    const dados: DadosNegociacao = {
      proprietarioNome: "João",
      proprietarioContato: "",
      propostas: [proposta({ status: "em_analise" })],
    };
    expect(negociacaoFechadaDoJson(JSON.stringify(dados))).toBe(false);
  });
});
