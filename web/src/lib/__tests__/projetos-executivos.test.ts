import { describe, expect, it } from "vitest";
import {
  projetosExecutivosTodosLiberadosDoJson,
  resumoProjetosExecutivos,
  type ProjetoExecutivo,
} from "@/lib/incorporacao/projetos-executivos";

function projeto(overrides: Partial<ProjetoExecutivo>): ProjetoExecutivo {
  return { id: "1", disciplina: "Estrutural Executivo", status: "nao_iniciado", ...overrides };
}

describe("resumoProjetosExecutivos", () => {
  it("conta totais e percentual liberado", () => {
    const r = resumoProjetosExecutivos([
      projeto({ id: "1", status: "liberado_para_obra" }),
      projeto({ id: "2", status: "em_revisao" }),
      projeto({ id: "3", status: "em_elaboracao" }),
      projeto({ id: "4", status: "nao_iniciado" }),
    ]);
    expect(r.total).toBe(4);
    expect(r.liberados).toBe(1);
    expect(r.pctLiberado).toBe(25);
  });

  it("lista vazia retorna zeros sem dividir por zero", () => {
    const r = resumoProjetosExecutivos([]);
    expect(r.total).toBe(0);
    expect(r.pctLiberado).toBe(0);
  });
});

describe("projetosExecutivosTodosLiberadosDoJson", () => {
  it("retorna false para JSON nulo, vazio ou corrompido", () => {
    expect(projetosExecutivosTodosLiberadosDoJson(null)).toBe(false);
    expect(projetosExecutivosTodosLiberadosDoJson("{invalido")).toBe(false);
    expect(projetosExecutivosTodosLiberadosDoJson(JSON.stringify({ projetos: [] }))).toBe(false);
  });

  it("retorna true apenas quando todos os projetos estão liberados", () => {
    expect(
      projetosExecutivosTodosLiberadosDoJson(JSON.stringify({ projetos: [projeto({ status: "liberado_para_obra" })] }))
    ).toBe(true);
    expect(
      projetosExecutivosTodosLiberadosDoJson(
        JSON.stringify({
          projetos: [projeto({ id: "1", status: "liberado_para_obra" }), projeto({ id: "2", status: "em_revisao" })],
        })
      )
    ).toBe(false);
  });
});
