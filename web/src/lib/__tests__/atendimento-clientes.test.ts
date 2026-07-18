import { describe, expect, it } from "vitest";
import {
  atendimentoTodosConcluidosDoJson,
  resumoAtendimentoClientes,
  type ChamadoAtendimento,
} from "@/lib/incorporacao/atendimento-clientes";

function chamado(overrides: Partial<ChamadoAtendimento>): ChamadoAtendimento {
  return { id: "1", cliente: "Fulano", tipo: "Entrega de Chaves", status: "aberto", ...overrides };
}

describe("resumoAtendimentoClientes", () => {
  it("conta totais por status e percentual concluído", () => {
    const r = resumoAtendimentoClientes([
      chamado({ id: "1", status: "concluido" }),
      chamado({ id: "2", status: "em_andamento" }),
      chamado({ id: "3", status: "aberto" }),
      chamado({ id: "4", status: "aberto" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.abertos).toBe(2);
    expect(r.emAndamento).toBe(1);
    expect(r.concluidos).toBe(1);
    expect(r.pctConcluido).toBe(25);
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoAtendimentoClientes([]);
    expect(r.total).toBe(0);
    expect(r.pctConcluido).toBe(0);
  });
});

describe("atendimentoTodosConcluidosDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(atendimentoTodosConcluidosDoJson(null)).toBe(false);
    expect(atendimentoTodosConcluidosDoJson("{invalido")).toBe(false);
    expect(atendimentoTodosConcluidosDoJson(JSON.stringify({ chamados: [] }))).toBe(false);
  });

  it("retorna true apenas quando todos os chamados estão concluídos", () => {
    expect(atendimentoTodosConcluidosDoJson(JSON.stringify({ chamados: [chamado({ status: "concluido" })] }))).toBe(true);
    expect(
      atendimentoTodosConcluidosDoJson(
        JSON.stringify({ chamados: [chamado({ id: "1", status: "concluido" }), chamado({ id: "2", status: "aberto" })] })
      )
    ).toBe(false);
  });
});
