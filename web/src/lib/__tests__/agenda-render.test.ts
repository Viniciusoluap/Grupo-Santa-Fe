import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", { href, ...props }, children) }));
vi.mock("@/lib/actions/agenda", () => ({
  criarVisita: vi.fn(), editarVisita: vi.fn(), excluirVisita: vi.fn(), atualizarStatusVisita: vi.fn(),
}));
vi.mock("@/lib/actions/tarefas-crm", () => ({ editarTarefaCrm: vi.fn() }));

import { AgendaClient } from "@/app/admin/agenda/_components/agenda-client";

describe("agenda renderizada: registros abaixo do calendário", () => {
  beforeEach(() => { vi.useFakeTimers(); Object.assign(globalThis, { React }); });
  afterEach(() => vi.useRealTimers());
  const base = { visitas: [], corretores: [], imoveis: [], leads: [], vencimentos: [], tarefas: [] };

  it("renderiza os nove leads na lista selecionada sem estado vazio ou lista duplicada", () => {
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    const html = renderToStaticMarkup(React.createElement(AgendaClient, {
      ...base,
      vencimentos: Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), nome: `Cliente único ${i + 1}`, vencimentoCard: "2026-10-22" })),
    }));
    const list = html.split('aria-label="Registros da agenda"')[1] || "";
    expect((list.match(/href="\/admin\/leads\//g) || []).length).toBe(9);
    for (let i = 1; i <= 9; i++) expect(list).toContain(`Cliente único ${i}`);
    expect(html).toContain("9 leads");
    expect(list).not.toContain("Nenhum registro encontrado");
    expect(html).not.toContain("Histórico Completo");
    expect(html).not.toContain("Vencimentos dos cards");
    expect(html).not.toContain("Tarefas e SLA");
  });

  it("renderiza leads, tarefa editável e agendamento juntos; tarefas sem prazo não aparecem automaticamente", () => {
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    const html = renderToStaticMarkup(React.createElement(AgendaClient, {
      ...base,
      vencimentos: Array.from({ length: 4 }, (_, i) => ({ id: String(i + 1), nome: `Lead de outubro ${i + 1}`, vencimentoCard: "2026-10-30" })),
      tarefas: [
        { id: "task-1", titulo: "Tarefa visível do dia", prazo: new Date("2026-10-30T12:00:00Z"), status: "pendente", leadId: "1", lead: { nome: "Cliente" } },
        { id: "task-2", titulo: "Tarefa sem prazo escondida", prazo: null, status: "pendente", leadId: "2", lead: { nome: "Cliente" } },
      ],
      visitas: [{ id: "visit-1", tipoVisita: "obra", clienteNome: "Visita visível do dia", clienteTel: "", agendadaPara: new Date("2026-10-30T15:00:00Z"), status: "agendada", notas: "", corretorId: null, corretor: null, colaboradorNome: null, imovelId: null, imovel: null, leadId: "1" }],
    }));
    const list = html.split('aria-label="Registros da agenda"')[1] || "";
    expect(list).toContain("6 registro(s)");
    expect(list).toContain("Tarefa visível do dia");
    expect(list).toContain("Visita visível do dia");
    expect(list).toContain('aria-label="Status de Tarefa visível do dia"');
    expect(list).toContain('aria-label="Prazo de Tarefa visível do dia"');
    expect(list).toContain("Editar");
    expect(list).toContain('title="Excluir visita"');
    expect(list).not.toContain("Tarefa sem prazo escondida");
    expect(list).not.toContain("Nenhum registro encontrado");
    expect(html).toContain("4 leads");
    expect(html).toContain("1 tarefa");
  });
});
