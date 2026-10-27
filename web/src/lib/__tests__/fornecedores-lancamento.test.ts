import { describe, expect, it } from "vitest";
import {
  fornecedoresTodosContratadosDoJson,
  resumoFornecedoresLancamento,
  type FornecedorLancamento,
} from "@/lib/incorporacao/fornecedores-lancamento";

function fornecedor(overrides: Partial<FornecedorLancamento>): FornecedorLancamento {
  return {
    id: "1",
    categoria: "Agência de Publicidade",
    nome: "Fornecedor X",
    valorContratado: 0,
    status: "nao_contratado",
    ...overrides,
  };
}

describe("resumoFornecedoresLancamento", () => {
  it("conta totais, percentual contratado e valor total contratado", () => {
    const r = resumoFornecedoresLancamento([
      fornecedor({ id: "1", status: "contratado", valorContratado: 10_000 }),
      fornecedor({ id: "2", status: "entregue", valorContratado: 5_000 }),
      fornecedor({ id: "3", status: "orcamento", valorContratado: 0 }),
      fornecedor({ id: "4", status: "nao_contratado", valorContratado: 0 }),
    ]);
    expect(r.total).toBe(4);
    expect(r.contratados).toBe(2);
    expect(r.pctContratado).toBe(50);
    expect(r.valorTotalContratado).toBe(10_000);
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoFornecedoresLancamento([]);
    expect(r.total).toBe(0);
    expect(r.pctContratado).toBe(0);
    expect(r.valorTotalContratado).toBe(0);
  });
});

describe("fornecedoresTodosContratadosDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(fornecedoresTodosContratadosDoJson(null)).toBe(false);
    expect(fornecedoresTodosContratadosDoJson("{invalido")).toBe(false);
    expect(fornecedoresTodosContratadosDoJson(JSON.stringify({ fornecedores: [] }))).toBe(false);
  });

  it("retorna true apenas quando todos os fornecedores estão contratados ou entregues", () => {
    expect(
      fornecedoresTodosContratadosDoJson(JSON.stringify({ fornecedores: [fornecedor({ status: "contratado" })] }))
    ).toBe(true);
    expect(
      fornecedoresTodosContratadosDoJson(
        JSON.stringify({
          fornecedores: [fornecedor({ id: "1", status: "contratado" }), fornecedor({ id: "2", status: "orcamento" })],
        })
      )
    ).toBe(false);
  });
});

// Lote 2: orçamento inclui todos os status; contrato considera apenas Contratado.
it("separa orçamento e contrato, preserva valor legado e acompanha edição/exclusão/status", () => {
  const lista = [
    fornecedor({ id: "1", status: "contratado", valorOrcado: 2000.25, valorContratado: 1800.50 }),
    fornecedor({ id: "2", status: "orcamento", valorOrcado: 500.10, valorContratado: 999 }),
    fornecedor({ id: "3", status: "entregue", valorContratado: 250.20 }),
  ];
  expect(resumoFornecedoresLancamento(lista)).toMatchObject({ valorTotalOrcado: 2750.55, valorTotalContratado: 1800.50 });
  expect(resumoFornecedoresLancamento(lista.slice(1))).toMatchObject({ valorTotalOrcado: 750.30, valorTotalContratado: 0 });
  lista[1].status = "contratado";
  lista[1].valorContratado = 450.25;
  expect(resumoFornecedoresLancamento(lista)).toMatchObject({ valorTotalOrcado: 2750.55, valorTotalContratado: 2250.75 });
  expect(resumoFornecedoresLancamento([fornecedor({ valorOrcado: Number.NaN, valorContratado: Infinity, status: "contratado" })])).toMatchObject({ valorTotalOrcado: 0, valorTotalContratado: 0 });
});
