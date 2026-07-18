import { describe, expect, it } from "vitest";
import {
  projetoTotalmenteAprovadoDoJson,
  resumoAprovacaoProjeto,
  type ProcessoAprovacao,
} from "@/lib/incorporacao/aprovacao-projeto";

function processo(overrides: Partial<ProcessoAprovacao>): ProcessoAprovacao {
  return {
    id: "1",
    orgao: "Prefeitura (projeto arquitetônico)",
    status: "protocolado",
    ...overrides,
  };
}

describe("resumoAprovacaoProjeto", () => {
  it("conta totais e percentual de aprovação", () => {
    const r = resumoAprovacaoProjeto([
      processo({ id: "1", status: "aprovado" }),
      processo({ id: "2", status: "em_analise" }),
      processo({ id: "3", status: "nao_protocolado" }),
      processo({ id: "4", status: "exigencia" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.protocolados).toBe(3);
    expect(r.aprovados).toBe(1);
    expect(r.pctAprovado).toBe(25);
    expect(r.comExigencia).toHaveLength(1);
  });

  it("identifica processos atrasados (prazo vencido e ainda não aprovado)", () => {
    const hoje = new Date("2026-07-18");
    const r = resumoAprovacaoProjeto(
      [
        processo({ id: "1", prazoPrevisto: "2026-07-01", status: "em_analise" }),
        processo({ id: "2", prazoPrevisto: "2026-08-01", status: "em_analise" }),
        processo({ id: "3", prazoPrevisto: "2026-07-01", status: "aprovado" }),
      ],
      hoje
    );
    expect(r.atrasados).toHaveLength(1);
    expect(r.atrasados[0].id).toBe("1");
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoAprovacaoProjeto([]);
    expect(r.total).toBe(0);
    expect(r.pctAprovado).toBe(0);
  });
});

describe("projetoTotalmenteAprovadoDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(projetoTotalmenteAprovadoDoJson(null)).toBe(false);
    expect(projetoTotalmenteAprovadoDoJson("{invalido")).toBe(false);
    expect(projetoTotalmenteAprovadoDoJson(JSON.stringify({ processos: [] }))).toBe(false);
  });

  it("retorna true apenas quando todos os processos estão aprovados", () => {
    expect(
      projetoTotalmenteAprovadoDoJson(JSON.stringify({ processos: [processo({ status: "aprovado" })] }))
    ).toBe(true);
    expect(
      projetoTotalmenteAprovadoDoJson(
        JSON.stringify({
          processos: [processo({ id: "1", status: "aprovado" }), processo({ id: "2", status: "em_analise" })],
        })
      )
    ).toBe(false);
  });
});
