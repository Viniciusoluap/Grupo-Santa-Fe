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
    expect(r.valorTotalContratado).toBe(15_000);
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
