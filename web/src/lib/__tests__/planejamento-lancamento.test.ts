import { describe, expect, it } from "vitest";
import {
  planejamentoLancamentoCompletoDoJson,
  resumoPlanejamentoLancamento,
  type MarcoLancamento,
} from "@/lib/incorporacao/planejamento-lancamento";

function marco(overrides: Partial<MarcoLancamento>): MarcoLancamento {
  return { id: "1", nome: "Evento de lançamento", status: "pendente", ...overrides };
}

describe("resumoPlanejamentoLancamento", () => {
  it("conta totais e percentual de conclusão", () => {
    const r = resumoPlanejamentoLancamento([
      marco({ id: "1", status: "concluido" }),
      marco({ id: "2", status: "em_andamento" }),
      marco({ id: "3", status: "pendente" }),
      marco({ id: "4", status: "pendente" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.concluidos).toBe(1);
    expect(r.pctConcluido).toBe(25);
  });

  it("identifica marcos atrasados (data prevista vencida e não concluído)", () => {
    const hoje = new Date("2026-07-18");
    const r = resumoPlanejamentoLancamento(
      [
        marco({ id: "1", dataPrevista: "2026-07-01", status: "pendente" }),
        marco({ id: "2", dataPrevista: "2026-08-01", status: "pendente" }),
        marco({ id: "3", dataPrevista: "2026-07-01", status: "concluido" }),
      ],
      hoje
    );
    expect(r.atrasados).toHaveLength(1);
    expect(r.atrasados[0].id).toBe("1");
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoPlanejamentoLancamento([]);
    expect(r.total).toBe(0);
    expect(r.pctConcluido).toBe(0);
  });
});

describe("planejamentoLancamentoCompletoDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(planejamentoLancamentoCompletoDoJson(null)).toBe(false);
    expect(planejamentoLancamentoCompletoDoJson("{invalido")).toBe(false);
    expect(planejamentoLancamentoCompletoDoJson(JSON.stringify({ marcos: [] }))).toBe(false);
  });

  it("retorna true apenas quando todos os marcos estão concluídos", () => {
    expect(planejamentoLancamentoCompletoDoJson(JSON.stringify({ marcos: [marco({ status: "concluido" })] }))).toBe(true);
    expect(
      planejamentoLancamentoCompletoDoJson(
        JSON.stringify({ marcos: [marco({ id: "1", status: "concluido" }), marco({ id: "2", status: "pendente" })] })
      )
    ).toBe(false);
  });
});
