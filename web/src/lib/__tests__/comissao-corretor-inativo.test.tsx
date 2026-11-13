// Paridade 13/11 — EPIC-018 2.2 da Prospecta: seletor de corretor da comissão com
// inativos marcados "(inativo)" e aviso quando não há corretores cadastrados.
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { rotuloCorretorComissao, SEM_CORRETORES_CADASTRADOS } from "@/lib/comissoes/calculo";

vi.mock("@/lib/actions/comissoes", () => ({ criarComissao: async () => {}, editarComissao: async () => {} }));

describe("rotuloCorretorComissao", () => {
  it("marca só o corretor inativo", () => {
    expect(rotuloCorretorComissao({ nome: "Paulo", ativo: true })).toBe("Paulo");
    expect(rotuloCorretorComissao({ nome: "Paulo" })).toBe("Paulo");
    expect(rotuloCorretorComissao({ nome: "Ana", ativo: false })).toBe("Ana (inativo)");
  });
});

describe("ComissaoForm — corretores", () => {
  const comissao = { id: "c1", beneficiario: "corretor", tipoNegocio: "extra", corretorId: "k2", imovel: "Bônus", negocioId: null, valor: 100, percentual: 5, status: "pendente", vencimento: new Date("2026-11-30"), pagamentoEm: null, notas: "" };

  it("comissão de corretor inativo abre com ele selecionado e marcado", async () => {
    const { ComissaoForm } = await import("@/app/admin/comissoes/_components/comissao-form");
    const html = renderToString(<ComissaoForm corretores={[{ id: "k1", nome: "Paulo", ativo: true }, { id: "k2", nome: "Ana", ativo: false }]} comissao={comissao} negociosPorTipo={{}} onClose={() => {}} />);
    expect(html).toContain("Ana (inativo)");
    expect(html).toMatch(/<option value="k2" selected="">Ana \(inativo\)<\/option>/);
    expect(html).toContain(">Paulo</option>");
    expect(html).toContain("Selecione o corretor");
  });

  it("sem corretores cadastrados mostra o aviso", async () => {
    const { ComissaoForm } = await import("@/app/admin/comissoes/_components/comissao-form");
    const html = renderToString(<ComissaoForm corretores={[]} negociosPorTipo={{}} onClose={() => {}} />);
    expect(html).toContain(SEM_CORRETORES_CADASTRADOS);
  });
});
