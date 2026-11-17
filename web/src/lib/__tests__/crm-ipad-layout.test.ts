// Paridade 17/11, bloco 1 — EPIC-023 S-A (correção 1) da Prospecta: CRM no iPad.
// Prospecta: commits 204ac53 (tela com a altura do viewport), 2cf71ba (arrasto lateral sobre o cartão volta a rolar
// o quadro) e 8aacdcd (`relative` nos contêineres de rolagem: textos sr-only esticavam a página).
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", { href, ...props }, children) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/leads", () => ({ alterarEtapaLead: vi.fn(), excluirLead: vi.fn(), alterarVencimentoCard: vi.fn() }));

import { LeadKanban, type KanbanLead } from "@/components/crm/lead-kanban";
import { LeadsClient, type LeadListItem } from "@/app/admin/leads/_components/leads-client";
import { LEAD_STAGES } from "@/lib/types/crm";

function lead(i: number, extra: Partial<KanbanLead> = {}): LeadListItem {
  return {
    id: `L${i}`, nome: `Cliente ${i}`, telefone: "94999990000", email: null, servico: "[]", status: "novo",
    temperatura: "morno", etapaOperacional: LEAD_STAGES[0], arquivadoEm: null, excluidoEm: null,
    atualizadoEm: new Date("2026-11-17T12:00:00Z"), vencimentoCard: null, origem: "site", orcamento: null, notas: "",
    corretor: null, responsavel: null, visitas: [], responsavelId: null, criadoEm: new Date("2026-11-17T12:00:00Z"), ...extra,
  };
}

/** Classes do primeiro elemento cujo trecho de abertura contém o marcador. */
function classesDe(html: string, marcador: string): string[] {
  const i = html.indexOf(marcador);
  expect(i).toBeGreaterThanOrEqual(0);
  const abertura = html.lastIndexOf("<", i);
  const tag = html.slice(abertura, html.indexOf(">", i) + 1);
  return (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
}

describe("CRM no iPad (paridade EPIC-023 S-A)", () => {
  beforeEach(() => { Object.assign(globalThis, { React }); });

  it("o trilho rola só de lado e cada coluna rola os próprios cartões, sem altura fixa", () => {
    const html = renderToStaticMarkup(React.createElement(LeadKanban, { leads: Array.from({ length: 30 }, (_, i) => lead(i)) }));
    const trilho = classesDe(html, 'aria-label="Pipeline de sete etapas"');
    expect(trilho).toEqual(expect.arrayContaining(["relative", "min-h-0", "flex-1", "touch-pan-x", "overflow-x-auto", "overflow-y-hidden", "overscroll-contain"]));
    // Lista de cartões: rolagem vertical própria, `relative` (sr-only não escapa) e SEM touch-action (2cf71ba).
    const listas = [...html.matchAll(/<div class="([^"]*overflow-y-auto[^"]*)"/g)].map((m) => m[1].split(/\s+/));
    expect(listas).toHaveLength(LEAD_STAGES.length);
    for (const lista of listas) {
      expect(lista).toEqual(expect.arrayContaining(["relative", "min-h-0", "flex-1", "overflow-y-auto", "overscroll-y-contain"]));
      expect(lista.some((c) => c.startsWith("touch-"))).toBe(false);
      expect(lista.some((c) => /^max-h-\[\d+px\]$/.test(c))).toBe(false);
    }
    expect(html).not.toContain("max-h-[600px]");
  });

  it("no quadro, a tela tem a altura do viewport e a página não rola por baixo das colunas", () => {
    const leads = [lead(1), lead(2)];
    const html = renderToStaticMarkup(React.createElement(LeadsClient, { leads }));
    const raiz = (html.match(/^<div class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
    expect(raiz).toEqual(expect.arrayContaining(["relative", "flex", "flex-col", "h-[calc(100dvh-5.5rem)]", "md:h-[calc(100dvh-6.5rem)]", "overflow-y-auto", "overscroll-none", "overflow-x-hidden"]));
    // O quadro ocupa o resto da tela (flex-1) com altura mínima utilizável.
    expect(html).toContain('class="flex min-h-[340px] flex-1 flex-col gap-3"');
  });

  it("leads a classificar ficam numa faixa com rolagem própria, sem empurrar o quadro para fora da tela", () => {
    const html = renderToStaticMarkup(React.createElement(LeadKanban, { leads: [lead(1, { etapaOperacional: null, status: "qualificado" }), lead(2)] }));
    expect(html).toContain("A CLASSIFICAR · 1");
    const secao = html.slice(html.lastIndexOf("<section", html.indexOf("A CLASSIFICAR")), html.indexOf("A CLASSIFICAR"));
    expect(secao).toMatch(/class="[^"]*relative[^"]*max-h-\[40%\][^"]*shrink-0[^"]*overflow-y-auto/);
  });
});
