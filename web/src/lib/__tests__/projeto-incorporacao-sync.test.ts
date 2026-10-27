// Lote 2, correção 07 (AD-07): regras puras da sincronização Projeto Aprovado ↔ Projetos
// (mesmos casos do Prospecta: server/projeto-incorporacao-sync.test.ts).
import { describe, expect, it } from "vitest";
import {
  lerProcessosAprovacao,
  normalizarProcessos,
  planejarSincronizacao,
  processoComDadosDoProjeto,
  statusInternoAposSituacaoExterna,
  TIPOS_POR_ORGAO,
} from "@/lib/incorporacao/projeto-sincronizacao";
import { PROJETO_STATUS_CONFIG, PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";

describe("correção 07 — regras puras", () => {
  it("mapeamento externo → interno: só exigência e aprovado, e nunca sobre entregue/cancelado", () => {
    expect(statusInternoAposSituacaoExterna("em_elaboracao", "em_analise", "exigencia")).toBe("revisao");
    expect(statusInternoAposSituacaoExterna("revisao", "exigencia", "aprovado")).toBe("aprovado");
    expect(statusInternoAposSituacaoExterna("em_elaboracao", "nao_protocolado", "protocolado")).toBe("em_elaboracao");
    expect(statusInternoAposSituacaoExterna("em_elaboracao", "exigencia", "exigencia")).toBe("em_elaboracao");
    expect(statusInternoAposSituacaoExterna("entregue", "em_analise", "exigencia")).toBe("entregue");
    expect(statusInternoAposSituacaoExterna("cancelado", "em_analise", "aprovado")).toBe("cancelado");
  });

  it("status e tipos usados existem no módulo Projetos do Santa Fé", () => {
    for (const s of ["solicitado", "revisao", "aprovado", "entregue", "cancelado"]) expect(s in PROJETO_STATUS_CONFIG).toBe(true);
    for (const tipos of Object.values(TIPOS_POR_ORGAO)) for (const t of tipos) expect(t in PROJETO_TIPO_CONFIG).toBe(true);
  });

  it("normaliza processos (ids repetidos, órgão/status inválidos, datas) e planeja sem duplicar", () => {
    const lista = normalizarProcessos([
      { id: "a", orgao: "Corpo de Bombeiros", status: "xx", prazoPrevisto: "31/12/2026" },
      { id: "a", orgao: "Outro", status: "aprovado" },
      { id: "", orgao: "Outro" },
      { id: "b", orgao: "?", status: "aprovado", engenheiroId: 5 },
    ]);
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({ id: "a", orgao: "Corpo de Bombeiros", status: "nao_protocolado", prazoPrevisto: undefined });
    expect(lista[1]).toMatchObject({ id: "b", orgao: "Outro", status: "aprovado", engenheiroId: undefined });
    const plano = planejarSincronizacao(lista, [{ id: "10", processoAprovacaoId: "a" }, { id: "11", processoAprovacaoId: "z" }]);
    expect(plano.criar.map((p) => p.id)).toEqual(["b"]);
    expect(plano.atualizar.map((u) => u.projeto.id)).toEqual(["10"]);
    expect(plano.desvincular.map((p) => p.id)).toEqual(["11"]);
    expect(lerProcessosAprovacao("{corrompido")).toEqual([]);
  });

  it("dados do projeto voltam ao processo sem perder id nem data de protocolo", () => {
    const p = processoComDadosDoProjeto(
      { id: "a", orgao: "Outro", status: "protocolado", dataProtocolo: "2026-01-02" },
      { aprovacaoOrgao: "Corpo de Bombeiros", aprovacaoProtocolo: " 123 ", aprovacaoStatus: "exigencia", aprovacaoObservacoes: "", prazoDia: "2026-12-01", engenheiroId: "u2", engenheiro: "Eng", engenheiroRegistro: "CREA-MA 1" },
    );
    expect(p).toEqual({ id: "a", orgao: "Corpo de Bombeiros", status: "exigencia", dataProtocolo: "2026-01-02", numeroProtocolo: "123", prazoPrevisto: "2026-12-01", observacoes: undefined, engenheiroId: "u2", engenheiro: "Eng", engenheiroRegistro: "CREA-MA 1" });
  });
});
